import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(userId: string) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const [assets, properties, receivables, cashFlow, snapshots] = await Promise.all([
      this.prisma.investmentAsset.findMany({ where: { deletedAt: null } }),
      this.prisma.property.findMany({ where: { deletedAt: null } }),
      this.prisma.receivablePortfolio.findMany({ where: { deletedAt: null } }),
      this.prisma.cashFlowEntry.findMany({ where: { userId, month: currentMonth, year: currentYear } }),
      this.prisma.monthlySnapshot.findMany({
        where: { userId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 12,
      }),
    ]);

    const byType: Record<string, number> = {};
    let financialTotal = 0;
    for (const a of assets) {
      const v = Number(a.currentValue);
      byType[a.type] = (byType[a.type] || 0) + v;
      financialTotal += v;
    }

    let propertiesRent = 0, propertiesOwn = 0, propertiesSale = 0, monthlyRent = 0;
    for (const p of properties) {
      const v = Number(p.currentValuation);
      if (p.classification === 'PARA_RENDA') {
        propertiesRent += v;
        if (p.rentAmount) monthlyRent += Number(p.rentAmount);
      } else if (p.classification === 'USO_PROPRIO') propertiesOwn += v;
      else propertiesSale += v;
    }

    let receivablesTotal = 0, monthlyReceivables = 0;
    for (const r of receivables) {
      receivablesTotal += Number(r.presentValue);
      monthlyReceivables += Number(r.monthlyReceivedAmount);
    }

    const totalPatrimony = financialTotal + propertiesRent + propertiesOwn + propertiesSale + receivablesTotal;

    let monthlyFIIIncome = 0, monthlyFixedIncome = 0;
    for (const e of cashFlow) {
      if (e.type === 'RECEITA') {
        if (e.category === 'RENDIMENTO_FII') monthlyFIIIncome += Number(e.amount);
        if (e.category === 'RENDIMENTO_RENDA_FIXA') monthlyFixedIncome += Number(e.amount);
      }
    }
    const totalMonthlyPassiveIncome = monthlyRent + monthlyReceivables + monthlyFIIIncome + monthlyFixedIncome;

    const investableTotal = financialTotal + receivablesTotal;
    const allocationActual: Record<string, number> = {};
    if (investableTotal > 0) {
      for (const [type, val] of Object.entries(byType)) {
        allocationActual[type] = (val / investableTotal) * 100;
      }
      allocationActual['RECEBIVEIS'] = (receivablesTotal / investableTotal) * 100;
    }

    const evolution = [...snapshots].reverse();

    return {
      totalPatrimony, financialTotal, propertiesRent, propertiesOwn, propertiesSale, receivablesTotal,
      monthlyPassiveIncome: totalMonthlyPassiveIncome, monthlyRent, monthlyReceivables, monthlyFIIIncome, monthlyFixedIncome,
      byType, allocationActual, evolution, currentMonth, currentYear,
    };
  }

  async getAlerts(userId: string) {
    const alerts: any[] = [];
    const now = new Date();
    const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const [vacantProps, maturingAssets, portfolios] = await Promise.all([
      this.prisma.property.findMany({ where: { deletedAt: null, classification: 'PARA_RENDA', rentStatus: 'VAGO' } }),
      this.prisma.investmentAsset.findMany({ where: { deletedAt: null, maturityDate: { gte: now, lte: in60Days } } }),
      this.prisma.receivablePortfolio.findMany({
        where: { deletedAt: null },
        include: { monthlyHistory: { orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 4 } },
      }),
    ]);

    for (const p of vacantProps) {
      alerts.push({ type: 'VACANCIA', severity: 'warning', message: `Imóvel "${p.name}" está vago` });
    }
    for (const a of maturingAssets) {
      const days = Math.ceil((a.maturityDate!.getTime() - now.getTime()) / 86400000);
      alerts.push({ type: 'VENCIMENTO', severity: 'info', message: `"${a.name}" vence em ${days} dias`, assetId: a.id });
    }
    for (const p of portfolios) {
      if (p.monthlyHistory.length >= 3) {
        const avg = p.monthlyHistory.slice(1, 4).reduce((s: number, h: any) => s + Number(h.receivedAmount), 0) / 3;
        const current = Number(p.monthlyHistory[0]?.receivedAmount || 0);
        if (avg > 0 && current < avg * 0.9) {
          alerts.push({ type: 'RECEBIVEIS', severity: 'warning', message: `Carteira "${p.name}": queda >10% no recebimento` });
        }
      }
    }

    return alerts;
  }
}
