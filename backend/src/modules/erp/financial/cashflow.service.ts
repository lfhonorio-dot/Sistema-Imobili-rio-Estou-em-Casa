// Fase 5 — fluxo de caixa (realizado x projetado, diário/mensal, por conta
// bancária, com saldo inicial), DRE gerencial por regime de caixa e
// exportação para Excel (.xlsx).

import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialConfigService } from './financial-config.service';
import { buildCashFlow, buildDre, Granularity, Movement } from './cashflow';
import { fromCents, toCents } from './settlement-math';

export interface CashFlowQuery {
  from?: string;
  to?: string;
  granularity?: Granularity;
  bankAccountId?: string;
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONEY_FMT = '"R$" #,##0.00;[Red]-"R$" #,##0.00';

@Injectable()
export class CashflowService {
  constructor(
    private prisma: PrismaService,
    private config: FinancialConfigService,
  ) {}

  private range(q: CashFlowQuery) {
    const now = new Date();
    const g: Granularity = q.granularity === 'day' ? 'day' : 'month';
    const from = q.from ? new Date(`${q.from.slice(0, 10)}T00:00:00Z`)
      : g === 'day' ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      : new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const to = q.to ? new Date(`${q.to.slice(0, 10)}T23:59:59Z`)
      : g === 'day' ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59))
      : new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59));
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new BadRequestException('Período inválido.');
    if (to < from) throw new BadRequestException('A data final é anterior à inicial.');
    const days = (to.getTime() - from.getTime()) / 86_400_000;
    if (g === 'day' && days > 370) throw new BadRequestException('No modo diário, escolha um período de até 12 meses.');
    if (days > 3700) throw new BadRequestException('Escolha um período de até 10 anos.');
    return { from, to, g };
  }

  async cashFlow(workspaceId: string, q: CashFlowQuery) {
    const { from, to, g } = this.range(q);
    const accounts = await this.prisma.bankAccount.findMany({
      where: { workspaceId, deletedAt: null, ...(q.bankAccountId && { id: q.bankAccountId }) },
      select: { id: true, name: true, openingBalance: true, openingDate: true },
    });
    if (q.bankAccountId && accounts.length === 0) throw new BadRequestException('Conta bancária não encontrada neste workspace.');
    const accById = new Map(accounts.map((a) => [a.id, a]));

    // baixas efetivas até o fim do período (antes de `from` entram no saldo inicial)
    const pays = await this.prisma.financialPayment.findMany({
      where: {
        workspaceId, reversedAt: null, paidAt: { lte: to },
        ...(q.bankAccountId && { bankAccountId: q.bankAccountId }),
      },
      select: { paidAt: true, total: true, bankAccountId: true, entryId: true },
    });
    const entryIds = [...new Set(pays.map((p) => p.entryId))];
    const entries = entryIds.length
      ? await this.prisma.financialEntry.findMany({ where: { workspaceId, id: { in: entryIds } }, select: { id: true, type: true } })
      : [];
    const typeById = new Map(entries.map((e) => [e.id, e.type]));

    let openingCents = accounts.reduce((s, a) => s + toCents(a.openingBalance as unknown as number), 0);
    const realized: Movement[] = [];
    for (const p of pays) {
      const acc = p.bankAccountId ? accById.get(p.bankAccountId) : undefined;
      // o saldo inicial da conta já inclui o que aconteceu antes da data dele
      if (acc?.openingDate && p.paidAt < acc.openingDate) continue;
      const signed = (typeById.get(p.entryId) === 'PAYABLE' ? -1 : 1) * Number(p.total);
      if (p.paidAt < from) openingCents += toCents(signed);
      else realized.push({ date: p.paidAt, amount: signed });
    }

    // projeção: saldo em aberto no vencimento (só sem filtro de conta: o
    // lançamento em aberto ainda não tem conta definida)
    const projected: Movement[] = [];
    if (!q.bankAccountId) {
      const open = await this.prisma.financialEntry.findMany({
        where: { workspaceId, deletedAt: null, status: { in: ['PENDING', 'OVERDUE'] }, dueDate: { lte: to } },
        select: { type: true, amount: true, paidAmount: true, dueDate: true },
      });
      for (const e of open) {
        const rest = toCents(e.amount as unknown as number) - toCents(e.paidAmount as unknown as number);
        if (rest <= 0) continue;
        projected.push({ date: e.dueDate, amount: (e.type === 'PAYABLE' ? -1 : 1) * fromCents(rest) });
      }
    }

    const flow = buildCashFlow({ from, to, granularity: g, today: new Date(), openingBalance: fromCents(openingCents), realized, projected });
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      granularity: g,
      bankAccount: q.bankAccountId ? { id: accounts[0].id, name: accounts[0].name } : null,
      projectionIncluded: !q.bankAccountId,
      ...flow,
    };
  }

  async dre(workspaceId: string, year?: number) {
    const y = year && year > 2000 && year < 2200 ? year : new Date().getUTCFullYear();
    const pays = await this.prisma.financialPayment.findMany({
      where: {
        workspaceId, reversedAt: null,
        paidAt: { gte: new Date(Date.UTC(y, 0, 1)), lt: new Date(Date.UTC(y + 1, 0, 1)) },
      },
      select: { paidAt: true, total: true, entryId: true },
    });
    const ids = [...new Set(pays.map((p) => p.entryId))];
    const entries = ids.length
      ? await this.prisma.financialEntry.findMany({ where: { workspaceId, id: { in: ids } }, select: { id: true, type: true, category: true } })
      : [];
    const byId = new Map(entries.map((e) => [e.id, e]));
    const rows = pays
      .map((p) => ({ paidAt: p.paidAt, total: Number(p.total), type: byId.get(p.entryId)?.type ?? 'RECEIVABLE', category: byId.get(p.entryId)?.category ?? 'OTHER' }));
    return buildDre(y, rows, await this.config.categoryNames(workspaceId));
  }

  // ── Excel ──────────────────────────────────────────────

  async cashFlowXlsx(workspaceId: string, q: CashFlowQuery): Promise<Buffer> {
    const f = await this.cashFlow(workspaceId, q);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Estou em Casa';
    const ws = wb.addWorksheet('Fluxo de caixa');
    ws.addRow([`Fluxo de caixa — ${f.from} a ${f.to}${f.bankAccount ? ` — conta ${f.bankAccount.name}` : ' — todas as contas'}`]).font = { bold: true, size: 13 };
    ws.addRow([`Saldo inicial: ${f.openingBalance.toFixed(2)}`]);
    if (!f.projectionIncluded) ws.addRow(['Projeção não incluída: contas em aberto ainda não têm conta bancária definida.']);
    ws.addRow([]);
    const header = ws.addRow(['Período', 'Entradas realizadas', 'Saídas realizadas', 'Saldo realizado', 'Entradas projetadas', 'Saídas projetadas', 'Saldo projetado']);
    header.font = { bold: true };
    for (const r of f.rows) {
      ws.addRow([r.period, r.realizedIn, r.realizedOut, r.realizedBalance, r.projectedIn, r.projectedOut, r.projectedBalance]);
    }
    const t = f.totals;
    ws.addRow(['Total', t.realizedIn, t.realizedOut, t.closingRealized, t.projectedIn, t.projectedOut, t.closingProjected]).font = { bold: true };
    ws.columns.forEach((c, i) => { c.width = i === 0 ? 14 : 20; if (i > 0) c.numFmt = MONEY_FMT; });
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async dreXlsx(workspaceId: string, year?: number): Promise<Buffer> {
    const d = await this.dre(workspaceId, year);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Estou em Casa';
    const ws = wb.addWorksheet(`DRE ${d.year}`);
    ws.addRow([`DRE gerencial (regime de caixa) — ${d.year}`]).font = { bold: true, size: 13 };
    ws.addRow([]);
    ws.addRow(['Categoria', ...MONTHS, 'Total']).font = { bold: true };
    ws.addRow(['RECEITAS']).font = { bold: true };
    for (const l of d.revenue) ws.addRow([l.name, ...l.months, l.total]);
    ws.addRow(['Total de receitas', ...d.totalRevenue, d.totals.revenue]).font = { bold: true };
    ws.addRow(['DESPESAS']).font = { bold: true };
    for (const l of d.expenses) ws.addRow([l.name, ...l.months, l.total]);
    ws.addRow(['Total de despesas', ...d.totalExpenses, d.totals.expenses]).font = { bold: true };
    ws.addRow(['RESULTADO', ...d.result, d.totals.result]).font = { bold: true };
    ws.columns.forEach((c, i) => { c.width = i === 0 ? 34 : 14; if (i > 0) c.numFmt = MONEY_FMT; });
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
