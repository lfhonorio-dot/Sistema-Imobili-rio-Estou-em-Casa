import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportFilterDto } from './reports.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(workspaceId: string) {
    const [
      totalContacts,
      dealsAll,
      totalProperties,
      activeContracts,
      financialIncome,
      overdueCount,
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
      this.prisma.financialEntry.count({
        where: {
          workspaceId,
          deletedAt: null,
          status: 'PENDING',
          dueDate: { lt: new Date() },
        },
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
      overdueCount,
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

  async getMarketingRoi(workspaceId: string) {
    const campaigns = await this.prisma.adCampaign.findMany({
      where: { workspaceId },
      select: { provider: true, spend: true, impressions: true, clicks: true, leads: true, conversions: true },
    });

    const map = new Map<string, { spend: number; impressions: number; clicks: number; leads: number; conversions: number }>();
    for (const c of campaigns) {
      if (!map.has(c.provider)) map.set(c.provider, { spend: 0, impressions: 0, clicks: 0, leads: 0, conversions: 0 });
      const entry = map.get(c.provider)!;
      entry.spend += c.spend;
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
