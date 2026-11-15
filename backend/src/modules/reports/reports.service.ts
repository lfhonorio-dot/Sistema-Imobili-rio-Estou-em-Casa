import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportFilterDto } from './reports.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // Painel do perfil VENDA (Fase 1). Cada número tem uma regra única e
  // explícita; o que ainda não existe no sistema volta como `null` com
  // `available: false`, para a tela dizer "não disponível" em vez de inventar.
  async getSalesDashboard(workspaceId: string, now: Date = new Date()) {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Semana corrente: segunda 00:00 até domingo 23:59:59.999
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    weekEnd.setMilliseconds(-1);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const openStatuses = ['PENDING', 'OVERDUE'];
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    const [
      newLeads,
      visitsWeek,
      visitsWeekDone,
      openDeals,
      salesMonth,
      commissionsReceivable,
      commissionPayableEntries,
      partnerPayouts,
      bankBalance,
      receivable30,
      payable30,
      commissionReceivableEntries,
      openProposals,
    ] = await Promise.all([
      this.prisma.deal.count({
        where: { workspaceId, deletedAt: null, createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.activity.count({
        where: { workspaceId, deletedAt: null, type: 'VISIT', dueAt: { gte: weekStart, lte: weekEnd } },
      }),
      this.prisma.activity.count({
        where: {
          workspaceId, deletedAt: null, type: 'VISIT',
          dueAt: { gte: weekStart, lte: weekEnd }, doneAt: { not: null },
        },
      }),
      this.prisma.deal.aggregate({
        where: {
          workspaceId,
          deletedAt: null,
          stage: { isWon: false, isLost: false },
          pipeline: { type: { not: 'RENTAL' } },
        },
        _sum: { value: true },
        _count: true,
      }),
      this.prisma.contract.aggregate({
        where: {
          workspaceId,
          deletedAt: null,
          type: { in: ['SALE', 'BROKERAGE'] },
          status: 'ACTIVE',
          // Fase 4: venda conta no mês em que foi ATIVADA (contratos antigos: criação)
          OR: [
            { activatedAt: { gte: monthStart, lt: nextMonthStart } },
            { activatedAt: null, createdAt: { gte: monthStart, lt: nextMonthStart } },
          ],
        },
        _sum: { saleValue: true },
        _count: true,
      }),
      this.prisma.commission.aggregate({
        // modelo antigo: comissão sem parcelas lançadas no financeiro
        where: {
          workspaceId, status: 'PENDING',
          contract: { deletedAt: null, financialEntries: { none: { type: 'RECEIVABLE', category: 'COMMISSION', deletedAt: null } } },
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.financialEntry.aggregate({
        where: {
          workspaceId, deletedAt: null, type: 'PAYABLE', category: 'COMMISSION',
          status: { in: openStatuses },
        },
        _sum: { amount: true, paidAmount: true },
        _count: true,
      }),
      this.prisma.splitTransaction.aggregate({
        where: { workspaceId, status: { in: ['PENDING', 'FAILED'] } },
        _sum: { amount: true },
        _count: true,
      }),
      // Fase 5: saldo = saldo inicial + extrato a partir da data do saldo inicial
      this.prisma.bankAccount.findMany({
        where: { workspaceId, deletedAt: null, isActive: true },
        select: { id: true, openingBalance: true, openingDate: true },
      }),
      this.prisma.financialEntry.aggregate({
        where: {
          workspaceId, deletedAt: null, type: 'RECEIVABLE',
          status: { in: openStatuses }, dueDate: { lte: in30Days },
        },
        _sum: { amount: true, paidAmount: true },
      }),
      this.prisma.financialEntry.aggregate({
        where: {
          workspaceId, deletedAt: null, type: 'PAYABLE',
          status: { in: openStatuses }, dueDate: { lte: in30Days },
        },
        _sum: { amount: true, paidAmount: true },
      }),
      // Fase 4: comissão a receber lançada em parcelas na ativação da venda
      this.prisma.financialEntry.aggregate({
        where: { workspaceId, deletedAt: null, type: 'RECEIVABLE', category: 'COMMISSION', status: { in: openStatuses } },
        _sum: { amount: true, paidAmount: true },
        _count: true,
      }),
      // Propostas em aberto e dentro da validade (Fase 3)
      this.prisma.proposal.count({
        where: { workspaceId, deletedAt: null, status: 'OPEN', validUntil: { gte: todayStart } },
      }),
    ]);

    const n = (v: unknown) => Number(v ?? 0);
    // saldo em aberto = valor − o que já foi baixado (baixas parciais, Fase 5)
    const open = (a: { _sum: { amount?: unknown; paidAmount?: unknown } }) => n(a._sum.amount) - n(a._sum.paidAmount);
    let balance = 0;
    for (const acc of bankBalance) {
      const mov = await this.prisma.bankTransaction.aggregate({
        where: { bankAccountId: acc.id, ...(acc.openingDate && { date: { gte: acc.openingDate } }) },
        _sum: { amount: true },
      });
      balance += n(acc.openingBalance) + n(mov._sum.amount);
    }
    balance = Math.round(balance * 100) / 100;
    const in30 = open(receivable30);
    const out30 = open(payable30);

    return {
      newLeads7d: newLeads,
      visitsThisWeek: { total: visitsWeek, done: visitsWeekDone },
      openProposals: { available: true, count: openProposals as number | null },
      vgvInNegotiation: { amount: n(openDeals._sum.value), deals: openDeals._count },
      salesThisMonth: { amount: n(salesMonth._sum.saleValue), count: salesMonth._count },
      commissionsReceivable: {
        amount: n(commissionsReceivable._sum.amount) + open(commissionReceivableEntries),
        count: commissionsReceivable._count + commissionReceivableEntries._count,
      },
      commissionsPayable: {
        amount: open(commissionPayableEntries) + n(partnerPayouts._sum.amount),
        count: commissionPayableEntries._count + partnerPayouts._count,
      },
      projectedBalance30d: {
        amount: Math.round((balance + in30 - out30) * 100) / 100,
        bankBalance: balance,
        bankAccounts: bankBalance.length,
        receivable: in30,
        payable: out30,
      },
      period: {
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        monthStart: monthStart.toISOString(),
      },
    };
  }

  async getDashboard(workspaceId: string) {
    const [
      totalContacts,
      dealsAll,
      totalProperties,
      activeContracts,
      financialIncome,
      pendingReceivable,
      pendingPayable,
      overdueAgg,
      automationRuns,
    ] = await Promise.all([
      this.prisma.contact.count({ where: { workspaceId, deletedAt: null } }),
      this.prisma.deal.findMany({
        where: { workspaceId, deletedAt: null },
        select: { stage: { select: { isWon: true, isLost: true } } },
      }),
      this.prisma.property.count({ where: { workspaceId, deletedAt: null } }),
      this.prisma.contract.count({ where: { workspaceId, deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.financialEntry.aggregate({
        where: { workspaceId, deletedAt: null, type: 'RECEIVABLE', status: 'PAID' },
        _sum: { amount: true },
      }),
      // Previsão de receita: a receber, ainda pendente (não é o mesmo que
      // "já recebido" acima — antes o dashboard só mostrava o realizado).
      this.prisma.financialEntry.aggregate({
        where: { workspaceId, deletedAt: null, type: 'RECEIVABLE', status: 'PENDING' },
        _sum: { amount: true },
      }),
      this.prisma.financialEntry.aggregate({
        where: { workspaceId, deletedAt: null, type: 'PAYABLE', status: 'PENDING' },
        _sum: { amount: true },
      }),
      this.prisma.financialEntry.aggregate({
        where: {
          workspaceId,
          deletedAt: null,
          status: 'PENDING',
          dueDate: { lt: new Date() },
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.automation.aggregate({
        where: { workspaceId, deletedAt: null },
        _sum: { executions: true },
      }),
    ]);

    const openDeals = dealsAll.filter(d => !d.stage.isWon && !d.stage.isLost).length;
    const wonDeals = dealsAll.filter(d => d.stage.isWon).length;
    const lostDeals = dealsAll.filter(d => d.stage.isLost).length;

    return {
      totalContacts,
      totalDeals: dealsAll.length,
      openDeals,
      wonDeals,
      lostDeals,
      totalProperties,
      activeContracts,
      totalRevenue: Number(financialIncome._sum.amount ?? 0),
      forecastReceivable: Number(pendingReceivable._sum.amount ?? 0),
      forecastPayable: Number(pendingPayable._sum.amount ?? 0),
      overdueCount: overdueAgg._count,
      overdueAmount: Number(overdueAgg._sum.amount ?? 0),
      automationRuns: Number(automationRuns._sum.executions ?? 0),
    };
  }

  async getCrmFunnel(workspaceId: string, filter: ReportFilterDto) {
    const pipelineWhere: any = { workspaceId, deletedAt: null };
    if (filter.pipelineId) pipelineWhere.id = filter.pipelineId;

    const pipelines = await this.prisma.pipeline.findMany({
      where: pipelineWhere,
      include: {
        stages: {
          orderBy: { order: 'asc' },
          include: {
            deals: {
              where: {
                workspaceId,
                deletedAt: null,
                ...(filter.startDate && { createdAt: { gte: new Date(filter.startDate) } }),
                ...(filter.endDate && { createdAt: { lte: new Date(filter.endDate) } }),
              },
              select: { value: true },
            },
          },
        },
      },
    });

    const result: any[] = [];
    for (const pipeline of pipelines) {
      for (const stage of pipeline.stages) {
        result.push({
          stageId: stage.id,
          stageName: stage.name,
          stageOrder: stage.order,
          dealCount: stage.deals.length,
          totalValue: stage.deals.reduce((sum, d) => sum + Number(d.value ?? 0), 0),
        });
      }
    }
    return result;
  }

  async getDealPerformance(workspaceId: string, filter: ReportFilterDto) {
    const where: any = { workspaceId, deletedAt: null };
    if (filter.startDate) where.createdAt = { ...where.createdAt, gte: new Date(filter.startDate) };
    if (filter.endDate) where.createdAt = { ...where.createdAt, lte: new Date(filter.endDate) };

    const deals = await this.prisma.deal.findMany({
      where,
      select: { createdAt: true, stage: { select: { isWon: true, isLost: true } } },
    });

    const map = new Map<string, { won: number; lost: number; total: number }>();
    for (const d of deals) {
      const month = d.createdAt.toISOString().slice(0, 7);
      if (!map.has(month)) map.set(month, { won: 0, lost: 0, total: 0 });
      const entry = map.get(month)!;
      entry.total++;
      if (d.stage.isWon) entry.won++;
      if (d.stage.isLost) entry.lost++;
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, ...v }));
  }

  async getContactGrowth(workspaceId: string, filter: ReportFilterDto) {
    const where: any = { workspaceId, deletedAt: null };
    if (filter.startDate) where.createdAt = { ...where.createdAt, gte: new Date(filter.startDate) };
    if (filter.endDate) where.createdAt = { ...where.createdAt, lte: new Date(filter.endDate) };

    const contacts = await this.prisma.contact.findMany({
      where,
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const map = new Map<string, number>();
    for (const c of contacts) {
      const month = c.createdAt.toISOString().slice(0, 7);
      map.set(month, (map.get(month) ?? 0) + 1);
    }

    let cumulative = 0;
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => {
        cumulative += count;
        return { month, count, cumulative };
      });
  }

  async getPropertyStatus(workspaceId: string) {
    const properties = await this.prisma.property.findMany({
      where: { workspaceId, deletedAt: null },
      select: { status: true },
    });

    const map = new Map<string, number>();
    for (const p of properties) {
      map.set(p.status, (map.get(p.status) ?? 0) + 1);
    }

    return Array.from(map.entries()).map(([status, count]) => ({ status, count }));
  }

  async getFinancialSummary(workspaceId: string, filter: ReportFilterDto) {
    const where: any = { workspaceId, deletedAt: null };
    if (filter.startDate) where.createdAt = { ...where.createdAt, gte: new Date(filter.startDate) };
    if (filter.endDate) where.createdAt = { ...where.createdAt, lte: new Date(filter.endDate) };

    const entries = await this.prisma.financialEntry.findMany({
      where,
      select: { createdAt: true, type: true, amount: true },
    });

    const map = new Map<string, { income: number; expense: number }>();
    for (const e of entries) {
      const month = e.createdAt.toISOString().slice(0, 7);
      if (!map.has(month)) map.set(month, { income: 0, expense: 0 });
      const entry = map.get(month)!;
      if (e.type === 'RECEIVABLE') entry.income += Number(e.amount);
      else entry.expense += Number(e.amount);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, income: v.income, expense: v.expense, net: v.income - v.expense }));
  }

  // Fluxo de caixa real: separa o que já entrou/saiu (realizado, por data de
  // pagamento) do que está previsto (projetado, por data de vencimento), com
  // saldo acumulado mês a mês. `getFinancialSummary` acima não serve para
  // isso — agrupa tudo por data de criação do registro e mistura status
  // (inclusive CANCELLED/EXEMPT), o que não corresponde a nenhum fluxo real.
  async getCashFlow(workspaceId: string, filter: ReportFilterDto) {
    const excludedStatuses = ['CANCELLED', 'EXEMPT'];

    const realizedWhere: any = { workspaceId, deletedAt: null, status: 'PAID' };
    if (filter.startDate) realizedWhere.paidAt = { ...realizedWhere.paidAt, gte: new Date(filter.startDate) };
    if (filter.endDate) realizedWhere.paidAt = { ...realizedWhere.paidAt, lte: new Date(filter.endDate) };

    const projectedWhere: any = { workspaceId, deletedAt: null, status: { notIn: ['PAID', ...excludedStatuses] } };
    if (filter.startDate) projectedWhere.dueDate = { ...projectedWhere.dueDate, gte: new Date(filter.startDate) };
    if (filter.endDate) projectedWhere.dueDate = { ...projectedWhere.dueDate, lte: new Date(filter.endDate) };

    const [realizedEntries, projectedEntries] = await Promise.all([
      this.prisma.financialEntry.findMany({
        where: realizedWhere,
        select: { type: true, paidAmount: true, amount: true, paidAt: true },
      }),
      this.prisma.financialEntry.findMany({
        where: projectedWhere,
        select: { type: true, amount: true, dueDate: true },
      }),
    ]);

    const monthMap = new Map<
      string,
      { realizedIn: number; realizedOut: number; projectedIn: number; projectedOut: number }
    >();
    const ensureMonth = (month: string) => {
      if (!monthMap.has(month)) {
        monthMap.set(month, { realizedIn: 0, realizedOut: 0, projectedIn: 0, projectedOut: 0 });
      }
      return monthMap.get(month)!;
    };

    for (const e of realizedEntries) {
      if (!e.paidAt) continue;
      const month = e.paidAt.toISOString().slice(0, 7);
      const bucket = ensureMonth(month);
      const value = Number(e.paidAmount ?? e.amount);
      if (e.type === 'RECEIVABLE') bucket.realizedIn += value;
      else bucket.realizedOut += value;
    }

    for (const e of projectedEntries) {
      const month = e.dueDate.toISOString().slice(0, 7);
      const bucket = ensureMonth(month);
      const value = Number(e.amount);
      if (e.type === 'RECEIVABLE') bucket.projectedIn += value;
      else bucket.projectedOut += value;
    }

    const todayMonth = new Date().toISOString().slice(0, 7);
    let cumulativeBalance = 0;

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => {
        const realizedNet = v.realizedIn - v.realizedOut;
        const projectedNet = v.projectedIn - v.projectedOut;
        // Meses já passados/atuais só contam o que de fato aconteceu no
        // saldo acumulado; meses futuros somam o que está previsto.
        cumulativeBalance += month <= todayMonth ? realizedNet : projectedNet;
        return {
          month,
          realizedIn: v.realizedIn,
          realizedOut: v.realizedOut,
          realizedNet,
          projectedIn: v.projectedIn,
          projectedOut: v.projectedOut,
          projectedNet,
          cumulativeBalance,
        };
      });
  }

  async getMarketingRoi(workspaceId: string) {
    const campaigns = await this.prisma.adCampaign.findMany({
      where: { workspaceId },
      select: { provider: true, spend: true, impressions: true, clicks: true, leads: true, conversions: true },
    });

    const map = new Map<string, { spend: number; impressions: number; clicks: number; leads: number; conversions: number }>();
    for (const c of campaigns) {
      if (!map.has(c.provider)) map.set(c.provider, { spend: 0, impressions: 0, clicks: 0, leads: 0, conversions: 0 });
      const entry = map.get(c.provider)!;
      entry.spend += Number(c.spend);
      entry.impressions += c.impressions;
      entry.clicks += c.clicks;
      entry.leads += c.leads;
      entry.conversions += c.conversions;
    }

    return Array.from(map.entries()).map(([provider, v]) => ({
      provider,
      spend: v.spend,
      impressions: v.impressions,
      clicks: v.clicks,
      leads: v.leads,
      conversions: v.conversions,
      cpl: v.leads > 0 ? v.spend / v.leads : 0,
      roi: v.spend > 0 ? ((v.conversions - v.spend) / v.spend) * 100 : 0,
    }));
  }

  async getAutomationStats(workspaceId: string) {
    const automations = await this.prisma.automation.findMany({
      where: { workspaceId, deletedAt: null },
      select: { id: true, name: true, executions: true, successes: true, failures: true },
      orderBy: { executions: 'desc' },
      take: 10,
    });

    return automations.map(a => ({
      id: a.id,
      name: a.name,
      executions: a.executions,
      successes: a.successes,
      failures: a.failures,
      successRate: a.executions > 0 ? (a.successes / a.executions) * 100 : 0,
    }));
  }

  async getActivityHeatmap(workspaceId: string, filter: ReportFilterDto) {
    const where: any = { workspaceId, deletedAt: null };
    if (filter.startDate) where.createdAt = { ...where.createdAt, gte: new Date(filter.startDate) };
    if (filter.endDate) where.createdAt = { ...where.createdAt, lte: new Date(filter.endDate) };

    const activities = await this.prisma.activity.findMany({
      where,
      select: { createdAt: true },
    });

    const map = new Map<string, number>();
    for (const a of activities) {
      const dayOfWeek = a.createdAt.getDay();
      const hour = a.createdAt.getHours();
      const key = `${dayOfWeek}-${hour}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    return Array.from(map.entries()).map(([key, count]) => {
      const [dayOfWeek, hour] = key.split('-').map(Number);
      return { dayOfWeek, hour, count };
    });
  }
}
