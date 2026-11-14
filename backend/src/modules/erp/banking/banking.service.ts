// Serviço Bancário — contas, extrato (OFX/CSV/Excel), razão bancário e conciliação.
//
// Fase 5: conciliar um lançamento do extrato com uma conta a pagar/receber
// gera a BAIXA de verdade (financial_payments) na mesma transação; desfazer a
// conciliação estorna essa baixa. Se a conta já foi baixada (ex.: pelo
// webhook do Asaas), a conciliação apenas liga o extrato à baixa existente.
import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from '../financial/payments.service';
import { fromCents, toCents } from '../financial/settlement-math';
import { parseCsv, parseOfx, parseXlsx, StatementLine } from './statement-parser';
import {
  CreateBankAccountDto, ImportOfxDto, ImportStatementDto, BankTransactionQueryDto,
  ReconcileDto, ManualTransactionDto, LedgerQueryDto,
} from './banking.dto';

@Injectable()
export class BankingService {
  private readonly logger = new Logger(BankingService.name);

  constructor(
    private prisma: PrismaService,
    private payments: PaymentsService,
  ) {}

  // ── CONTAS BANCÁRIAS ──────────────────────────────────────

  /** Saldo = saldo inicial + movimentos do extrato a partir da data do saldo inicial. */
  private async computedBalance(acc: { id: string; openingBalance: unknown; openingDate: Date | null }, until?: Date) {
    const agg = await this.prisma.bankTransaction.aggregate({
      where: {
        bankAccountId: acc.id,
        ...((acc.openingDate || until) && {
          date: { ...(acc.openingDate && { gte: acc.openingDate }), ...(until && { lt: until }) },
        }),
      },
      _sum: { amount: true },
    });
    return fromCents(toCents(acc.openingBalance as number) + toCents(agg._sum.amount as unknown as number));
  }

  async findAccounts(workspaceId: string) {
    const accounts = await this.prisma.bankAccount.findMany({
      where: { workspaceId, deletedAt: null },
      include: { _count: { select: { transactions: true } } },
      orderBy: { isDefault: 'desc' },
    });
    const pending = await this.prisma.bankTransaction.groupBy({
      by: ['bankAccountId'], where: { workspaceId, reconciled: false }, _count: true,
    });
    const pendingBy = new Map(pending.map((p) => [p.bankAccountId, p._count]));
    return Promise.all(accounts.map(async (a) => ({
      ...a,
      currentBalance: await this.computedBalance(a),
      pendingReconciliation: pendingBy.get(a.id) ?? 0,
    })));
  }

  async findOneAccount(workspaceId: string, id: string) {
    const acc = await this.prisma.bankAccount.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!acc) throw new NotFoundException('Conta bancária não encontrada');
    return acc;
  }

  async createAccount(workspaceId: string, dto: CreateBankAccountDto) {
    if (!dto.name?.trim()) throw new BadRequestException('Informe o nome da conta.');
    if (dto.isDefault) {
      await this.prisma.bankAccount.updateMany({
        where: { workspaceId }, data: { isDefault: false },
      });
    }
    return this.prisma.bankAccount.create({
      data: {
        workspaceId,
        name: dto.name.trim(),
        bankCode: dto.bankCode,
        bankName: dto.bankName,
        agency: dto.agency,
        accountNumber: dto.accountNumber,
        accountType: dto.accountType ?? 'CHECKING',
        pixKey: dto.pixKey,
        isDefault: dto.isDefault ?? false,
        balance: 0,
        openingBalance: dto.openingBalance ?? 0,
        openingDate: dto.openingDate ? new Date(`${dto.openingDate.slice(0, 10)}T00:00:00Z`) : null,
      },
    });
  }

  async updateAccount(workspaceId: string, id: string, dto: Partial<CreateBankAccountDto>) {
    await this.findOneAccount(workspaceId, id);
    if (dto.isDefault) {
      await this.prisma.bankAccount.updateMany({
        where: { workspaceId }, data: { isDefault: false },
      });
    }
    const { openingDate, ...rest } = dto;
    return this.prisma.bankAccount.update({
      where: { id },
      data: {
        ...rest,
        ...(openingDate !== undefined && { openingDate: openingDate ? new Date(`${openingDate.slice(0, 10)}T00:00:00Z`) : null }),
      },
    });
  }

  async deleteAccount(workspaceId: string, id: string) {
    await this.findOneAccount(workspaceId, id);
    await this.prisma.bankAccount.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Conta bancária removida com sucesso' };
  }

  // ── IMPORTAÇÃO DE EXTRATO (OFX / CSV / XLSX) ──────────────

  /** Compatibilidade: POST /banking/ofx/import */
  importOfx(workspaceId: string, dto: ImportOfxDto) {
    return this.importStatement(workspaceId, { bankAccountId: dto.bankAccountId, content: dto.content, fileName: 'extrato.ofx' });
  }

  async importStatement(workspaceId: string, dto: ImportStatementDto) {
    await this.findOneAccount(workspaceId, dto.bankAccountId);
    const buf = Buffer.from(dto.content ?? '', 'base64');
    if (!buf.length) throw new BadRequestException('Arquivo vazio.');
    if (buf.length > 5 * 1024 * 1024) throw new BadRequestException('Arquivo muito grande (limite 5 MB).');
    const name = (dto.fileName ?? '').toLowerCase();
    const text = () => buf.toString('utf-8');

    let lines: StatementLine[];
    let source: string;
    try {
      if (name.endsWith('.xlsx')) { lines = await parseXlsx(buf); source = 'XLSX'; }
      else if (name.endsWith('.csv') || name.endsWith('.txt')) { lines = parseCsv(text()); source = 'CSV'; }
      else if (name.endsWith('.ofx') || /<OFX>/i.test(text())) { lines = parseOfx(text()); source = 'OFX'; }
      else throw new Error('Formato não reconhecido. Envie OFX, CSV ou planilha Excel (.xlsx).');
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    if (!lines.length) throw new BadRequestException('Nenhum lançamento encontrado no arquivo.');

    let imported = 0;
    let duplicates = 0;
    for (const tx of lines) {
      const exists = await this.prisma.bankTransaction.findFirst({
        where: { workspaceId, bankAccountId: dto.bankAccountId, externalId: tx.externalId },
        select: { id: true },
      });
      if (exists) { duplicates++; continue; }
      await this.prisma.bankTransaction.create({
        data: {
          workspaceId,
          bankAccountId: dto.bankAccountId,
          externalId: tx.externalId,
          amount: tx.amount,
          date: tx.date,
          description: tx.description,
          importSource: source,
          reconciled: false,
        },
      });
      imported++;
    }

    this.logger.log(`Extrato ${source} importado: conta=${dto.bankAccountId} novas=${imported} duplicatas=${duplicates}`);
    return { format: source, imported, duplicates, total: lines.length };
  }

  // ── TRANSAÇÕES E RAZÃO ────────────────────────────────────

  async findTransactions(workspaceId: string, query: BankTransactionQueryDto) {
    const { page = 1, limit = 20, bankAccountId, reconciled, startDate, endDate } = query;
    const skip = (page - 1) * limit;
    const rec = reconciled === undefined || reconciled === '' ? undefined : String(reconciled) === 'true';
    const where = {
      workspaceId,
      bankAccount: { deletedAt: null },
      ...(bankAccountId && { bankAccountId }),
      ...(rec !== undefined && { reconciled: rec }),
      ...((startDate || endDate) && {
        date: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(`${endDate.slice(0, 10)}T23:59:59Z`) }),
        },
      }),
    };
    const [items, total] = await Promise.all([
      this.prisma.bankTransaction.findMany({
        where, skip, take: limit,
        orderBy: { date: 'desc' },
        include: {
          bankAccount: { select: { id: true, name: true, bankName: true, accountNumber: true } },
        },
      }),
      this.prisma.bankTransaction.count({ where }),
    ]);
    const entryIds = [...new Set(items.map((i) => i.financialEntryId).filter((v): v is string => !!v))];
    const entries = entryIds.length
      ? await this.prisma.financialEntry.findMany({ where: { workspaceId, id: { in: entryIds } }, select: { id: true, description: true, type: true } })
      : [];
    const byId = new Map(entries.map((e) => [e.id, e]));
    return {
      items: items.map((i) => ({ ...i, entry: i.financialEntryId ? byId.get(i.financialEntryId) ?? null : null })),
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  /** Razão bancário: saldo inicial do período + cada movimento com saldo acumulado. */
  async ledger(workspaceId: string, accountId: string, q: LedgerQueryDto) {
    const acc = await this.findOneAccount(workspaceId, accountId);
    const now = new Date();
    const from = q.from ? new Date(`${q.from.slice(0, 10)}T00:00:00Z`) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = new Date(`${(q.to ?? now.toISOString()).slice(0, 10)}T23:59:59.999Z`); // até o fim do dia
    if (to < from) throw new BadRequestException('A data final é anterior à inicial.');
    const effFrom = acc.openingDate && acc.openingDate > from ? acc.openingDate : from;
    const opening = await this.computedBalance(acc, effFrom);
    const txs = await this.prisma.bankTransaction.findMany({
      where: { workspaceId, bankAccountId: accountId, date: { gte: effFrom, lte: to } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      take: 5000,
    });
    let bal = toCents(opening);
    let credits = 0;
    let debits = 0;
    const rows = txs.map((t) => {
      const c = toCents(t.amount as unknown as number);
      bal += c;
      if (c >= 0) credits += c; else debits += -c;
      return {
        id: t.id, date: t.date, description: t.description, amount: fromCents(c), balance: fromCents(bal),
        reconciled: t.reconciled, financialEntryId: t.financialEntryId, importSource: t.importSource,
      };
    });
    return {
      account: { id: acc.id, name: acc.name, openingBalance: Number(acc.openingBalance), openingDate: acc.openingDate },
      from: effFrom.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10),
      openingBalance: opening, credits: fromCents(credits), debits: fromCents(debits), closingBalance: fromCents(bal),
      rows,
    };
  }

  /** Lançamento avulso no extrato (ex.: saque, tarifa). Com conta vinculada, já concilia. */
  async createManualTransaction(workspaceId: string, dto: ManualTransactionDto, userId?: string) {
    await this.findOneAccount(workspaceId, dto.bankAccountId);
    if (!dto.amount) throw new BadRequestException('Informe o valor (positivo = entrada, negativo = saída).');
    const tx = await this.prisma.bankTransaction.create({
      data: {
        workspaceId,
        bankAccountId: dto.bankAccountId,
        externalId: `MANUAL_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        amount: dto.amount,
        date: new Date(dto.date),
        description: dto.description,
        type: dto.type,
        importSource: 'MANUAL',
        reconciled: false,
      },
    });
    if (dto.financialEntryId) {
      await this.reconcileTransaction(workspaceId, { bankTransactionId: tx.id, financialEntryId: dto.financialEntryId, notes: 'Lançamento manual' }, userId);
    }
    return this.prisma.bankTransaction.findUnique({ where: { id: tx.id } });
  }

  // ── CONCILIAÇÃO ───────────────────────────────────────────

  async findReconciliations(workspaceId: string) {
    return this.prisma.bankReconciliation.findMany({
      where: { workspaceId },
      include: {
        bankAccount: { select: { id: true, name: true, bankName: true, accountNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** Sugestões para conciliar um movimento: baixas já feitas sem extrato e contas em aberto de valor compatível. */
  async suggestions(workspaceId: string, bankTransactionId: string) {
    const tx = await this.prisma.bankTransaction.findFirst({ where: { id: bankTransactionId, workspaceId } });
    if (!tx) throw new NotFoundException('Transação bancária não encontrada');
    const amount = Math.abs(Number(tx.amount));
    const type = Number(tx.amount) >= 0 ? 'RECEIVABLE' : 'PAYABLE';
    const from = new Date(tx.date.getTime() - 10 * 86_400_000);
    const to = new Date(tx.date.getTime() + 10 * 86_400_000);
    const linked = await this.prisma.bankTransaction.findMany({ where: { workspaceId, paymentId: { not: null } }, select: { paymentId: true } });
    const linkedIds = linked.map((l) => l.paymentId as string);
    const pays = await this.prisma.financialPayment.findMany({
      where: { workspaceId, reversedAt: null, total: amount, paidAt: { gte: from, lte: to }, id: { notIn: linkedIds } },
      take: 10,
    });
    const payEntries = pays.length
      ? await this.prisma.financialEntry.findMany({ where: { workspaceId, id: { in: pays.map((p) => p.entryId) }, type }, select: { id: true, description: true } })
      : [];
    const peById = new Map(payEntries.map((e) => [e.id, e]));
    const open = await this.prisma.financialEntry.findMany({
      where: { workspaceId, deletedAt: null, type, status: { in: ['PENDING', 'OVERDUE'] } },
      orderBy: { dueDate: 'asc' },
      take: 300,
      select: { id: true, description: true, amount: true, paidAmount: true, dueDate: true },
    });
    const entries = open
      .map((e) => ({ ...e, openAmount: PaymentsService.openAmount(e) }))
      .filter((e) => Math.abs(e.openAmount - amount) < 0.005 || e.openAmount > amount)
      .sort((a, b) => Number(Math.abs(a.openAmount - amount) >= 0.005) - Number(Math.abs(b.openAmount - amount) >= 0.005)
        || Math.abs(a.dueDate.getTime() - tx.date.getTime()) - Math.abs(b.dueDate.getTime() - tx.date.getTime()))
      .slice(0, 15);
    return {
      type,
      payments: pays.filter((p) => peById.has(p.entryId)).map((p) => ({ ...p, entryDescription: peById.get(p.entryId)!.description })),
      entries,
    };
  }

  async reconcileTransaction(workspaceId: string, dto: ReconcileDto, userId?: string) {
    const tx = await this.prisma.bankTransaction.findFirst({
      where: { id: dto.bankTransactionId, workspaceId },
    });
    if (!tx) throw new NotFoundException('Transação bancária não encontrada');
    if (tx.reconciled) throw new BadRequestException('Transação já conciliada');
    const amount = Number(tx.amount);
    const expectedType = amount >= 0 ? 'RECEIVABLE' : 'PAYABLE';

    return this.prisma.$transaction(async (db) => {
      let paymentId: string | null = null;
      let entryId: string | null = dto.financialEntryId ?? null;

      if (dto.paymentId) {
        // liga a uma baixa já existente (ex.: boleto baixado pelo webhook)
        const p = await db.financialPayment.findFirst({ where: { id: dto.paymentId, workspaceId, reversedAt: null } });
        if (!p) throw new BadRequestException('Baixa não encontrada (ou estornada).');
        const used = await db.bankTransaction.findFirst({ where: { workspaceId, paymentId: p.id }, select: { id: true } });
        if (used) throw new BadRequestException('Esta baixa já está conciliada com outro movimento do extrato.');
        const e = await db.financialEntry.findFirst({ where: { id: p.entryId, workspaceId }, select: { type: true } });
        if (e?.type !== expectedType) throw new BadRequestException(amount >= 0 ? 'Entrada no extrato só concilia com conta a receber.' : 'Saída no extrato só concilia com conta a pagar.');
        if (toCents(p.total as unknown as number) !== toCents(Math.abs(amount))) {
          throw new BadRequestException('O valor da baixa é diferente do valor do extrato.');
        }
        paymentId = p.id;
        entryId = p.entryId;
        if (!p.bankAccountId) await db.financialPayment.update({ where: { id: p.id }, data: { bankAccountId: tx.bankAccountId } });
      } else if (dto.financialEntryId) {
        const entry = await db.financialEntry.findFirst({ where: { id: dto.financialEntryId, workspaceId, deletedAt: null } });
        if (!entry) throw new BadRequestException('Lançamento financeiro não encontrado neste workspace.');
        if (entry.type !== expectedType) {
          throw new BadRequestException(amount >= 0 ? 'Entrada no extrato só concilia com conta a receber.' : 'Saída no extrato só concilia com conta a pagar.');
        }
        const open = PaymentsService.openAmount(entry);
        const abs = Math.abs(amount);
        const principal = Math.min(open, abs);
        const { payment } = await this.payments.register(workspaceId, entry.id, {
          principal,
          interest: abs > open ? fromCents(toCents(abs) - toCents(open)) : 0,
          paidAt: tx.date,
          method: 'TRANSFER',
          bankAccountId: tx.bankAccountId,
          source: 'RECONCILIATION',
          notes: dto.notes ?? 'Conciliação bancária',
        }, userId, db);
        paymentId = payment.id;
      } else if (!dto.notes?.trim()) {
        throw new BadRequestException('Para conciliar sem conta vinculada (ex.: tarifa), informe uma observação.');
      }

      const flip = await db.bankTransaction.updateMany({
        where: { id: tx.id, reconciled: false },
        data: { reconciled: true, financialEntryId: entryId, paymentId },
      });
      if (flip.count !== 1) throw new BadRequestException('Transação já conciliada');

      await db.bankReconciliation.create({
        data: {
          workspaceId,
          bankAccountId: tx.bankAccountId,
          bankTransactionId: tx.id,
          financialEntryId: entryId,
          status: 'MANUAL',
          confidence: 1.0,
          notes: dto.notes,
          reconciledAt: new Date(),
          reconciledBy: userId,
        },
      });
      return { message: 'Transação conciliada com sucesso', paymentId, financialEntryId: entryId };
    });
  }

  /** Desfaz a conciliação. A baixa criada pela conciliação é estornada. */
  async unreconcile(workspaceId: string, bankTransactionId: string, userId?: string) {
    const tx = await this.prisma.bankTransaction.findFirst({ where: { id: bankTransactionId, workspaceId } });
    if (!tx) throw new NotFoundException('Transação bancária não encontrada');
    if (!tx.reconciled) throw new BadRequestException('Esta transação não está conciliada.');
    return this.prisma.$transaction(async (db) => {
      if (tx.paymentId) {
        const p = await db.financialPayment.findFirst({ where: { id: tx.paymentId, workspaceId } });
        if (p && !p.reversedAt && p.source === 'RECONCILIATION') {
          await this.payments.reverse(workspaceId, p.id, 'Conciliação bancária desfeita', userId, db);
        }
      }
      await db.bankTransaction.update({ where: { id: tx.id }, data: { reconciled: false, paymentId: null, financialEntryId: null } });
      await db.bankReconciliation.updateMany({
        where: { workspaceId, bankTransactionId: tx.id, status: { in: ['MANUAL', 'AUTO'] } },
        data: { status: 'IGNORED', notes: 'Conciliação desfeita' },
      });
      return { message: 'Conciliação desfeita' };
    });
  }

  /**
   * Conciliação automática (conservadora): só concilia quando há UM único
   * candidato de valor exato — primeiro baixas já feitas sem extrato, depois
   * contas em aberto com saldo igual e vencimento até 5 dias de distância.
   */
  async autoReconcile(workspaceId: string, bankAccountId: string, userId?: string) {
    await this.findOneAccount(workspaceId, bankAccountId);
    const pendingTx = await this.prisma.bankTransaction.findMany({
      where: { workspaceId, bankAccountId, reconciled: false },
      orderBy: { date: 'asc' },
    });

    let matched = 0;
    for (const tx of pendingTx) {
      const s = await this.suggestions(workspaceId, tx.id);
      const amount = Math.abs(Number(tx.amount));
      const exactPays = s.payments;
      const exactEntries = s.entries.filter((e) =>
        Math.abs(e.openAmount - amount) < 0.005 && Math.abs(e.dueDate.getTime() - tx.date.getTime()) <= 5 * 86_400_000);
      try {
        if (exactPays.length === 1) {
          await this.reconcileTransaction(workspaceId, { bankTransactionId: tx.id, paymentId: exactPays[0].id, notes: 'Conciliação automática' }, userId);
          matched++;
        } else if (exactPays.length === 0 && exactEntries.length === 1) {
          await this.reconcileTransaction(workspaceId, { bankTransactionId: tx.id, financialEntryId: exactEntries[0].id, notes: 'Conciliação automática' }, userId);
          matched++;
        }
      } catch (e) {
        this.logger.warn(`Conciliação automática pulou ${tx.id}: ${(e as Error).message}`);
      }
    }

    this.logger.log(`Conciliação automática: conta=${bankAccountId} casadas=${matched}/${pendingTx.length}`);
    return { matched, total: pendingTx.length };
  }

  // ── SALDO ─────────────────────────────────────────────────

  async getAccountSummary(workspaceId: string, bankAccountId: string) {
    const account = await this.findOneAccount(workspaceId, bankAccountId);
    const pending = await this.prisma.bankTransaction.count({
      where: { workspaceId, bankAccountId, reconciled: false },
    });
    return {
      balance: await this.computedBalance(account),
      openingBalance: Number(account.openingBalance),
      openingDate: account.openingDate,
      pendingReconciliation: pending,
    };
  }

  // ── OPEN FINANCE (stub) ───────────────────────────────────

  async getOpenFinanceConsent(workspaceId: string) {
    return {
      message: 'Open Finance em implementação',
      consentUrl: null,
      status: 'NOT_CONFIGURED',
    };
  }

}
