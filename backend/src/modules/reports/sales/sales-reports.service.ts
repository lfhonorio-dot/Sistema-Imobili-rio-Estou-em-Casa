// Fase 7 — relatórios de venda (todos com exportação Excel e PDF):
//  vgv              VGV vendido por período (mês a mês)
//  funnel           conversão por etapa do funil de venda
//  sales-time       tempo médio de venda (do lead ao negócio ganho)
//  lead-sources     origem dos leads (com quantos viraram venda)
//  broker-ranking   ranking de corretores
//  commissions      comissões a receber e a pagar (em aberto)
//  idle-properties  imóveis à venda sem movimento
//  authorizations   autorizações de venda a vencer (e vencidas)

import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { average, daysBetween, funnelConversion, median, period, round2 } from './calc';
import { tableToPdf, tableToXlsx, type ReportTable } from './report-table';

export const SALES_REPORTS = ['vgv', 'funnel', 'sales-time', 'lead-sources', 'broker-ranking', 'commissions', 'idle-properties', 'authorizations'] as const;
export type SalesReportKey = typeof SALES_REPORTS[number];

export interface ReportParams { from?: string; to?: string; days?: number }

const ORIGIN_LABELS: Record<string, string> = {
  WEBSITE: 'Site', PORTAL: 'Portal', INDICACAO: 'Indicação', REFERRAL: 'Indicação', WALK_IN: 'Visita à loja', PHONE: 'Telefone',
  WHATSAPP: 'WhatsApp', INSTAGRAM: 'Instagram', FACEBOOK: 'Facebook', GOOGLE: 'Google', PLACA: 'Placa', OTHER: 'Outro',
};
const fmtPeriod = (f: Date, t: Date) => `Período: ${f.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} a ${t.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`;

@Injectable()
export class SalesReportsService {
  constructor(private prisma: PrismaService) {}

  private range(p: ReportParams) {
    try {
      return period(p.from, p.to);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  private async memberNames(workspaceId: string): Promise<Map<string, string>> {
    const ms = await this.prisma.workspaceUser.findMany({ where: { workspaceId }, select: { id: true, user: { select: { name: true } } } });
    return new Map(ms.map((m) => [m.id, m.user.name]));
  }

  async build(workspaceId: string, key: string, p: ReportParams): Promise<ReportTable> {
    switch (key as SalesReportKey) {
      case 'vgv': return this.vgv(workspaceId, p);
      case 'funnel': return this.funnel(workspaceId, p);
      case 'sales-time': return this.salesTime(workspaceId, p);
      case 'lead-sources': return this.leadSources(workspaceId, p);
      case 'broker-ranking': return this.brokerRanking(workspaceId, p);
      case 'commissions': return this.commissions(workspaceId);
      case 'idle-properties': return this.idleProperties(workspaceId, p);
      case 'authorizations': return this.authorizations(workspaceId, p);
      default: throw new BadRequestException('Relatório não encontrado.');
    }
  }

  async export(workspaceId: string, key: string, p: ReportParams, format: string) {
    const t = await this.build(workspaceId, key, p);
    if (format === 'pdf') {
      const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } });
      return { buf: await tableToPdf(t, ws?.name ?? 'Imobiliária'), type: 'application/pdf', name: `${t.key}.pdf` };
    }
    if (format !== 'xlsx') throw new BadRequestException('Formato inválido: use xlsx ou pdf.');
    return { buf: await tableToXlsx(t), type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', name: `${t.key}.xlsx` };
  }

  /** Vendas ativadas no período (contratos antigos sem data de ativação: pela criação). Rescindidas ficam de fora. */
  private async soldContracts(workspaceId: string, from: Date, to: Date) {
    return this.prisma.contract.findMany({
      where: {
        workspaceId, deletedAt: null, type: { in: ['SALE', 'BROKERAGE'] }, status: 'ACTIVE',
        OR: [{ activatedAt: { gte: from, lte: to } }, { activatedAt: null, createdAt: { gte: from, lte: to } }],
      },
      select: { id: true, code: true, saleValue: true, commissionAmount: true, commissionRate: true, activatedAt: true, createdAt: true, dealId: true,
        property: { select: { code: true, city: true } } },
    });
  }

  // 1. VGV vendido por período
  private async vgv(workspaceId: string, p: ReportParams): Promise<ReportTable> {
    const { from, to } = this.range(p);
    const cs = await this.soldContracts(workspaceId, from, to);
    const byMonth = new Map<string, { count: number; vgv: number; commission: number }>();
    for (const c of cs) {
      const d = c.activatedAt ?? c.createdAt;
      const k = d.toISOString().slice(0, 7);
      const cur = byMonth.get(k) ?? { count: 0, vgv: 0, commission: 0 };
      cur.count++;
      cur.vgv += Number(c.saleValue ?? 0);
      cur.commission += Number(c.commissionAmount ?? (c.saleValue != null && c.commissionRate != null ? (Number(c.saleValue) * Number(c.commissionRate)) / 100 : 0));
      byMonth.set(k, cur);
    }
    const rows = [...byMonth.entries()].sort().map(([k, v]) => ({
      month: `${k.slice(5, 7)}/${k.slice(0, 4)}`, count: v.count, vgv: round2(v.vgv), commission: round2(v.commission),
      avgTicket: v.count ? round2(v.vgv / v.count) : null,
    }));
    const tv = rows.reduce((s, r) => s + r.vgv, 0);
    const tc = rows.reduce((s, r) => s + r.count, 0);
    return {
      key: 'vgv', title: 'VGV vendido', subtitle: fmtPeriod(from, to),
      columns: [
        { key: 'month', label: 'Mês', type: 'text' }, { key: 'count', label: 'Vendas', type: 'int' },
        { key: 'vgv', label: 'VGV vendido', type: 'money' }, { key: 'avgTicket', label: 'Ticket médio', type: 'money' },
        { key: 'commission', label: 'Comissão gerada', type: 'money' },
      ],
      rows,
      totals: { count: tc, vgv: round2(tv), avgTicket: tc ? round2(tv / tc) : null, commission: round2(rows.reduce((s, r) => s + r.commission, 0)) },
      notes: ['Vendas ativas; rescindidas não entram. VGV = valor de venda dos imóveis.'],
    };
  }

  // 2. Conversão por etapa do funil
  private async funnel(workspaceId: string, p: ReportParams): Promise<ReportTable> {
    const { from, to } = this.range(p);
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { workspaceId, deletedAt: null, type: { not: 'RENTAL' } }, orderBy: [{ isDefault: 'desc' }, { order: 'asc' }],
      include: { stages: true },
    });
    if (!pipeline) return { key: 'funnel', title: 'Conversão do funil', subtitle: 'Nenhum funil de venda cadastrado.', columns: [], rows: [] };
    const deals = await this.prisma.deal.findMany({
      where: { workspaceId, pipelineId: pipeline.id, deletedAt: null, createdAt: { gte: from, lte: to } },
      select: { id: true, stageId: true, stageHistory: { select: { stageId: true } } },
    });
    const order = new Map(pipeline.stages.map((s) => [s.id, s.order]));
    const reached = new Map<string, number>();
    let won = 0; let lost = 0;
    const wonIds = new Set(pipeline.stages.filter((s) => s.isWon).map((s) => s.id));
    const lostIds = new Set(pipeline.stages.filter((s) => s.isLost).map((s) => s.id));
    for (const d of deals) {
      // etapa mais avançada que o negócio alcançou (passar por uma etapa = alcançou as anteriores)
      const visited = [d.stageId, ...d.stageHistory.map((h) => h.stageId)].filter((id) => !lostIds.has(id));
      const maxOrder = Math.max(...visited.map((id) => order.get(id) ?? 0), pipeline.stages.find((s) => !s.isLost)?.order ?? 0);
      for (const s of pipeline.stages) if (!s.isLost && s.order <= maxOrder) reached.set(s.id, (reached.get(s.id) ?? 0) + 1);
      if (wonIds.has(d.stageId)) won++;
      if (lostIds.has(d.stageId)) lost++;
    }
    const rows = funnelConversion(pipeline.stages, reached).map((r) => ({ stage: r.stage, reached: r.reached, toNextPct: r.toNextPct, fromStartPct: r.fromStartPct }));
    return {
      key: 'funnel', title: `Conversão do funil — ${pipeline.name}`, subtitle: fmtPeriod(from, to),
      columns: [
        { key: 'stage', label: 'Etapa', type: 'text' }, { key: 'reached', label: 'Negócios que chegaram', type: 'int' },
        { key: 'toNextPct', label: 'Passaram para a próxima', type: 'pct' }, { key: 'fromStartPct', label: 'Do total de leads', type: 'pct' },
      ],
      rows,
      summary: [
        { label: 'Negócios criados no período', value: deals.length, type: 'int' },
        { label: 'Ganhos', value: won, type: 'int' }, { label: 'Perdidos', value: lost, type: 'int' },
        { label: 'Taxa de ganho', value: deals.length ? Math.round((won / deals.length) * 1000) / 10 : null, type: 'pct' },
      ],
    };
  }

  // 3. Tempo médio de venda
  private async salesTime(workspaceId: string, p: ReportParams): Promise<ReportTable> {
    const { from, to } = this.range(p);
    const names = await this.memberNames(workspaceId);
    const won = await this.prisma.deal.findMany({
      where: { workspaceId, deletedAt: null, stage: { isWon: true }, OR: [{ closedAt: { gte: from, lte: to } }, { closedAt: null, updatedAt: { gte: from, lte: to } }] },
      select: { id: true, title: true, createdAt: true, closedAt: true, updatedAt: true, assigneeId: true, value: true },
    });
    const rows = won.map((d) => {
      const end = d.closedAt ?? d.updatedAt;
      return { deal: d.title, broker: d.assigneeId ? names.get(d.assigneeId) ?? '—' : '—', start: d.createdAt.toISOString(), end: end.toISOString(), days: Math.round(daysBetween(d.createdAt, end)), value: Number(d.value ?? 0) };
    }).sort((a, b) => a.days - b.days);
    const days = rows.map((r) => r.days);
    return {
      key: 'sales-time', title: 'Tempo médio de venda', subtitle: fmtPeriod(from, to),
      columns: [
        { key: 'deal', label: 'Negócio', type: 'text' }, { key: 'broker', label: 'Corretor', type: 'text' },
        { key: 'start', label: 'Entrada do lead', type: 'date' }, { key: 'end', label: 'Ganho em', type: 'date' },
        { key: 'days', label: 'Tempo', type: 'days' }, { key: 'value', label: 'Valor', type: 'money' },
      ],
      rows,
      summary: [
        { label: 'Negócios ganhos', value: rows.length, type: 'int' },
        { label: 'Tempo médio', value: average(days), type: 'days' }, { label: 'Tempo mediano', value: median(days), type: 'days' },
      ],
    };
  }

  // 4. Origem dos leads
  private async leadSources(workspaceId: string, p: ReportParams): Promise<ReportTable> {
    const { from, to } = this.range(p);
    const deals = await this.prisma.deal.findMany({
      where: { workspaceId, deletedAt: null, createdAt: { gte: from, lte: to } },
      select: { origin: true, utmSource: true, contact: { select: { origin: true } }, stage: { select: { isWon: true } }, value: true },
    });
    const m = new Map<string, { leads: number; won: number; vgv: number }>();
    for (const d of deals) {
      const raw = (d.origin || d.contact?.origin || d.utmSource || 'Não informada').toString();
      const k = ORIGIN_LABELS[raw.toUpperCase()] ?? raw;
      const cur = m.get(k) ?? { leads: 0, won: 0, vgv: 0 };
      cur.leads++;
      if (d.stage.isWon) { cur.won++; cur.vgv += Number(d.value ?? 0); }
      m.set(k, cur);
    }
    const rows = [...m.entries()].map(([origin, v]) => ({
      origin, leads: v.leads, sharePct: deals.length ? Math.round((v.leads / deals.length) * 1000) / 10 : 0, won: v.won,
      convPct: v.leads ? Math.round((v.won / v.leads) * 1000) / 10 : 0, vgv: round2(v.vgv),
    })).sort((a, b) => b.leads - a.leads);
    return {
      key: 'lead-sources', title: 'Origem dos leads', subtitle: fmtPeriod(from, to),
      columns: [
        { key: 'origin', label: 'Origem', type: 'text' }, { key: 'leads', label: 'Leads', type: 'int' }, { key: 'sharePct', label: '% dos leads', type: 'pct' },
        { key: 'won', label: 'Viraram venda', type: 'int' }, { key: 'convPct', label: 'Conversão', type: 'pct' }, { key: 'vgv', label: 'Valor ganho', type: 'money' },
      ],
      rows,
      totals: { leads: deals.length, won: rows.reduce((s, r) => s + r.won, 0), vgv: round2(rows.reduce((s, r) => s + r.vgv, 0)) },
    };
  }

  // 5. Ranking de corretores
  private async brokerRanking(workspaceId: string, p: ReportParams): Promise<ReportTable> {
    const { from, to } = this.range(p);
    const names = await this.memberNames(workspaceId);
    const [cs, deals, visits, commissions] = await Promise.all([
      this.soldContracts(workspaceId, from, to),
      this.prisma.deal.findMany({ where: { workspaceId, deletedAt: null, createdAt: { gte: from, lte: to } }, select: { id: true, assigneeId: true } }),
      this.prisma.visit.groupBy({ by: ['brokerId'], where: { workspaceId, deletedAt: null, status: 'DONE', scheduledAt: { gte: from, lte: to } }, _count: true }),
      this.prisma.financialEntry.groupBy({
        by: ['beneficiaryUserId'],
        where: { workspaceId, deletedAt: null, type: 'PAYABLE', category: 'COMMISSION', status: { not: 'CANCELLED' }, createdAt: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
    ]);
    const dealOwner = new Map((await this.prisma.deal.findMany({ where: { workspaceId, id: { in: cs.map((c) => c.dealId).filter((v): v is string => !!v) } }, select: { id: true, assigneeId: true } })).map((d) => [d.id, d.assigneeId]));
    const agg = new Map<string, { leads: number; sales: number; vgv: number; visits: number; commission: number }>();
    const get = (id: string) => { const v = agg.get(id) ?? { leads: 0, sales: 0, vgv: 0, visits: 0, commission: 0 }; agg.set(id, v); return v; };
    for (const d of deals) if (d.assigneeId) get(d.assigneeId).leads++;
    for (const c of cs) { const o = c.dealId ? dealOwner.get(c.dealId) : null; if (o) { const v = get(o); v.sales++; v.vgv += Number(c.saleValue ?? 0); } }
    for (const v of visits) if (v.brokerId) get(v.brokerId).visits += v._count;
    for (const c of commissions) if (c.beneficiaryUserId) get(c.beneficiaryUserId).commission += Number(c._sum.amount ?? 0);
    const rows = [...agg.entries()].map(([id, v]) => ({
      broker: names.get(id) ?? 'Corretor removido', sales: v.sales, vgv: round2(v.vgv), leads: v.leads, visits: v.visits,
      convPct: v.leads ? Math.round((v.sales / v.leads) * 1000) / 10 : 0, commission: round2(v.commission),
    })).sort((a, b) => b.vgv - a.vgv || b.sales - a.sales).map((r, i) => ({ position: `${i + 1}º`, ...r }));
    return {
      key: 'broker-ranking', title: 'Ranking de corretores', subtitle: fmtPeriod(from, to),
      columns: [
        { key: 'position', label: 'Posição', type: 'text' }, { key: 'broker', label: 'Corretor', type: 'text' }, { key: 'sales', label: 'Vendas', type: 'int' },
        { key: 'vgv', label: 'VGV vendido', type: 'money' }, { key: 'leads', label: 'Leads', type: 'int' }, { key: 'visits', label: 'Visitas feitas', type: 'int' },
        { key: 'convPct', label: 'Conversão', type: 'pct' }, { key: 'commission', label: 'Comissão gerada', type: 'money' },
      ],
      rows,
      notes: ['Venda conta para o corretor responsável pelo negócio que gerou o contrato.'],
    };
  }

  // 6. Comissões a receber e a pagar (em aberto)
  private async commissions(workspaceId: string): Promise<ReportTable> {
    const names = await this.memberNames(workspaceId);
    const entries = await this.prisma.financialEntry.findMany({
      where: { workspaceId, deletedAt: null, category: 'COMMISSION', status: { in: ['PENDING', 'OVERDUE'] } },
      orderBy: [{ type: 'desc' }, { dueDate: 'asc' }],
      select: { type: true, description: true, dueDate: true, amount: true, paidAmount: true, status: true, beneficiaryUserId: true, contactId: true, contract: { select: { code: true } } },
    });
    const contacts = new Map((await this.prisma.contact.findMany({
      where: { workspaceId, id: { in: entries.map((e) => e.contactId).filter((v): v is string => !!v) } }, select: { id: true, name: true },
    })).map((c) => [c.id, c.name]));
    const rows = entries.map((e) => ({
      kind: e.type === 'RECEIVABLE' ? 'A receber' : 'A pagar',
      who: e.type === 'PAYABLE' ? (e.beneficiaryUserId ? names.get(e.beneficiaryUserId) : null) ?? (e.contactId ? contacts.get(e.contactId) : null) ?? '—' : (e.contactId ? contacts.get(e.contactId) ?? '—' : '—'),
      contract: e.contract?.code ?? '—', description: e.description, due: e.dueDate.toISOString(),
      open: round2(Number(e.amount) - Number(e.paidAmount ?? 0)), status: e.status === 'OVERDUE' ? 'Atrasada' : 'Em aberto',
    }));
    const sum = (k: string) => round2(rows.filter((r) => r.kind === k).reduce((s, r) => s + r.open, 0));
    return {
      key: 'commissions', title: 'Comissões a receber e a pagar', subtitle: `Em aberto em ${new Date().toLocaleDateString('pt-BR')}`,
      columns: [
        { key: 'kind', label: 'Tipo', type: 'text' }, { key: 'who', label: 'Pagador / corretor', type: 'text' }, { key: 'contract', label: 'Contrato', type: 'text' },
        { key: 'description', label: 'Descrição', type: 'text' }, { key: 'due', label: 'Vencimento', type: 'date' }, { key: 'open', label: 'Em aberto', type: 'money' },
        { key: 'status', label: 'Situação', type: 'text' },
      ],
      rows,
      summary: [{ label: 'Total a receber', value: sum('A receber'), type: 'money' }, { label: 'Total a pagar', value: sum('A pagar'), type: 'money' }],
    };
  }

  // 7. Imóveis sem movimento
  private async idleProperties(workspaceId: string, p: ReportParams): Promise<ReportTable> {
    const days = Math.min(Math.max(Number(p.days) || 60, 7), 730);
    const since = new Date(Date.now() - days * 86_400_000);
    const props = await this.prisma.property.findMany({
      where: { workspaceId, deletedAt: null, status: 'AVAILABLE', purpose: { in: ['SALE', 'SALE_RENTAL'] } },
      select: { id: true, code: true, street: true, number: true, city: true, salePrice: true, createdAt: true, updatedAt: true },
    });
    const ids = props.map((x) => x.id);
    const [visits, links, prices] = await Promise.all([
      this.prisma.visit.groupBy({ by: ['propertyId'], where: { workspaceId, propertyId: { in: ids }, deletedAt: null }, _max: { scheduledAt: true } }),
      this.prisma.dealProperty.findMany({ where: { propertyId: { in: ids } }, select: { propertyId: true, deal: { select: { createdAt: true, lastActivityAt: true } } } }),
      this.prisma.propertyPriceHistory.groupBy({ by: ['propertyId'], where: { workspaceId, propertyId: { in: ids } }, _max: { createdAt: true } }),
    ]);
    const last = new Map<string, Date>();
    const bump = (id: string | null, d: Date | null | undefined) => { if (id && d && (!last.has(id) || last.get(id)! < d)) last.set(id, d); };
    for (const v of visits) bump(v.propertyId, v._max.scheduledAt);
    for (const l of links) bump(l.propertyId, l.deal.lastActivityAt ?? l.deal.createdAt);
    for (const pr of prices) bump(pr.propertyId, pr._max.createdAt);
    const rows = props.map((x) => {
      const lm = last.get(x.id) ?? x.createdAt;
      return { code: x.code, address: [x.street, x.number].filter(Boolean).join(', ') || '—', city: x.city ?? '—', price: Number(x.salePrice ?? 0), lastMove: lm.toISOString(), idleDays: Math.floor(daysBetween(lm, new Date())) };
    }).filter((r) => new Date(r.lastMove) < since).sort((a, b) => b.idleDays - a.idleDays);
    return {
      key: 'idle-properties', title: `Imóveis sem movimento há mais de ${days} dias`,
      subtitle: 'Movimento = visita, interesse em negócio ou mudança de preço',
      columns: [
        { key: 'code', label: 'Código', type: 'text' }, { key: 'address', label: 'Endereço', type: 'text' }, { key: 'city', label: 'Cidade', type: 'text' },
        { key: 'price', label: 'Preço', type: 'money' }, { key: 'lastMove', label: 'Último movimento', type: 'date' }, { key: 'idleDays', label: 'Parado há', type: 'days' },
      ],
      rows,
      summary: [{ label: 'Imóveis à venda', value: props.length, type: 'int' }, { label: 'Sem movimento', value: rows.length, type: 'int' }],
    };
  }

  // 8. Autorizações de venda a vencer
  private async authorizations(workspaceId: string, p: ReportParams): Promise<ReportTable> {
    const days = Math.min(Math.max(Number(p.days) || 30, 1), 365);
    const until = new Date(Date.now() + days * 86_400_000);
    const names = await this.memberNames(workspaceId);
    const auths = await this.prisma.propertyAuthorization.findMany({
      where: { workspaceId, deletedAt: null, status: 'ACTIVE', validUntil: { lte: until }, property: { deletedAt: null, status: { notIn: ['SOLD', 'INACTIVE'] } } },
      orderBy: { validUntil: 'asc' },
      select: { validUntil: true, exclusive: true, captorUserId: true, property: { select: { code: true, street: true, number: true, city: true, owner: { select: { name: true } } } } },
    });
    const now = Date.now();
    const rows = auths.map((a) => {
      const left = Math.ceil((a.validUntil.getTime() - now) / 86_400_000);
      return {
        code: a.property.code, address: [a.property.street, a.property.number].filter(Boolean).join(', ') || '—', owner: a.property.owner?.name ?? '—',
        captor: a.captorUserId ? names.get(a.captorUserId) ?? '—' : '—', exclusive: a.exclusive ? 'Sim' : 'Não',
        validUntil: a.validUntil.toISOString(), situation: left < 0 ? `Vencida há ${-left} dia(s)` : left === 0 ? 'Vence hoje' : `Vence em ${left} dia(s)`,
      };
    });
    return {
      key: 'authorizations', title: `Autorizações de venda vencidas ou a vencer em ${days} dias`,
      columns: [
        { key: 'code', label: 'Imóvel', type: 'text' }, { key: 'address', label: 'Endereço', type: 'text' }, { key: 'owner', label: 'Proprietário', type: 'text' },
        { key: 'captor', label: 'Captador', type: 'text' }, { key: 'exclusive', label: 'Exclusiva', type: 'text' }, { key: 'validUntil', label: 'Validade', type: 'date' },
        { key: 'situation', label: 'Situação', type: 'text' },
      ],
      rows,
    };
  }
}
