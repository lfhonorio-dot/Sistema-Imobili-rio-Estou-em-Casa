import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(userId: string, year?: number, month?: number) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Mês de competência selecionado (padrão: mês atual)
    const selMonth = month && month >= 1 && month <= 12 ? Number(month) : currentMonth;
    const selYear = year && year > 2000 ? Number(year) : currentYear;
    const isCurrentMonth = selMonth === currentMonth && selYear === currentYear;

    const [assets, properties, receivables, cashFlow, snapshots, selectedSnapshot] = await Promise.all([
      this.prisma.investmentAsset.findMany({ where: { deletedAt: null } }),
      this.prisma.property.findMany({ where: { deletedAt: null } }),
      this.prisma.receivablePortfolio.findMany({
        where: { deletedAt: null },
        include: { monthlyHistory: { orderBy: [{ year: 'desc' }, { month: 'desc' }] } },
      }),
      this.prisma.cashFlowEntry.findMany({ where: { userId, month: selMonth, year: selYear } }),
      this.prisma.monthlySnapshot.findMany({
        where: { userId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 12,
      }),
      // Foto do patrimônio daquele mês (se já houver snapshot salvo)
      this.prisma.monthlySnapshot.findUnique({
        where: { userId_year_month: { userId, year: selYear, month: selMonth } },
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
      const hist = (r as any).monthlyHistory || [];
      // Por competência: recebido EXATAMENTE no mês selecionado.
      const monthEntry = hist.find((h: any) => h.year === selYear && h.month === selMonth);
      if (monthEntry) {
        monthlyReceivables += Number(monthEntry.receivedAmount);
      } else if (isCurrentMonth) {
        // No mês corrente, se ainda não lançou, mostra o último recebimento real
        const lastReceived = hist.find((h: any) => Number(h.receivedAmount) > 0);
        monthlyReceivables += lastReceived ? Number(lastReceived.receivedAmount) : Number(r.monthlyReceivedAmount);
      }
    }

    let totalPatrimony = financialTotal + propertiesRent + propertiesOwn + propertiesSale + receivablesTotal;

    // Se um mês passado foi selecionado e existe snapshot dele, usa a foto do
    // patrimônio daquele mês (estoque real da época). O mês atual sempre usa
    // os valores ao vivo, mais atualizados que qualquer snapshot do início do mês.
    let patrimonySource: 'live' | 'snapshot' = 'live';
    if (!isCurrentMonth && selectedSnapshot) {
      patrimonySource = 'snapshot';
      const s = selectedSnapshot;
      financialTotal = Number(s.fixedIncomeTotal) + Number(s.fiiTotal) + Number(s.stocksTotal) + Number(s.pensionTotal) + Number(s.coeTotal) + Number(s.cashTotal);
      propertiesRent = Number(s.propertiesRentTotal);
      propertiesOwn = Number(s.propertiesOwnTotal);
      propertiesSale = Number(s.propertiesSaleTotal);
      receivablesTotal = Number(s.receivablesTotal);
      totalPatrimony = Number(s.totalPatrimony);
      byType['RENDA_FIXA'] = Number(s.fixedIncomeTotal);
      byType['FII'] = Number(s.fiiTotal);
      byType['ACAO'] = Number(s.stocksTotal);
      byType['PREVIDENCIA'] = Number(s.pensionTotal);
      byType['COE'] = Number(s.coeTotal);
      byType['CAIXA'] = Number(s.cashTotal);
    }

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

    // Reserva de emergência: liquidez imediata (CAIXA + renda fixa D0/D1)
    // vs. despesa mensal média dos últimos 3 meses fechados
    const liquidAssets = assets
      .filter(a => a.type === 'CAIXA' || (a.type === 'RENDA_FIXA' && (a.liquidity === 'D0' || a.liquidity === 'D1')))
      .reduce((s, a) => s + Number(a.currentValue), 0);

    const threeMonthsAgo = new Date(currentYear, currentMonth - 4, 1);
    const recentExpenses = await this.prisma.cashFlowEntry.findMany({
      where: {
        userId,
        type: 'DESPESA',
        OR: [
          { year: threeMonthsAgo.getFullYear(), month: { gte: threeMonthsAgo.getMonth() + 1 } },
          { year: { gt: threeMonthsAgo.getFullYear() } },
        ],
        NOT: { year: currentYear, month: currentMonth }, // exclui mês corrente (incompleto)
      },
    });
    const monthsWithData = new Set(recentExpenses.map(e => `${e.year}-${e.month}`)).size;
    const avgMonthlyExpenses = monthsWithData > 0
      ? recentExpenses.reduce((s, e) => s + Number(e.amount), 0) / monthsWithData
      : 0;
    const emergencyReserve = {
      liquidAssets,
      avgMonthlyExpenses,
      monthsCovered: avgMonthlyExpenses > 0 ? liquidAssets / avgMonthlyExpenses : null,
    };

    return {
      totalPatrimony, financialTotal, propertiesRent, propertiesOwn, propertiesSale, receivablesTotal,
      monthlyPassiveIncome: totalMonthlyPassiveIncome, monthlyRent, monthlyReceivables, monthlyFIIIncome, monthlyFixedIncome,
      byType, allocationActual, evolution, currentMonth, currentYear, emergencyReserve,
      selectedMonth: selMonth, selectedYear: selYear, isCurrentMonth, patrimonySource,
    };
  }

  async getAlerts(userId: string) {
    const alerts: any[] = [];
    const now = new Date();
    const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const [vacantProps, maturingAssets, portfolios, fixedIncomeAssets] = await Promise.all([
      this.prisma.property.findMany({ where: { deletedAt: null, classification: 'PARA_RENDA', rentStatus: 'VAGO' } }),
      this.prisma.investmentAsset.findMany({ where: { deletedAt: null, maturityDate: { gte: now, lte: in60Days } } }),
      this.prisma.receivablePortfolio.findMany({
        where: { deletedAt: null },
        include: { monthlyHistory: { orderBy: [{ year: 'desc' }, { month: 'desc' }] } },
      }),
      this.prisma.investmentAsset.findMany({ where: { deletedAt: null, type: 'RENDA_FIXA' } }),
    ]);

    for (const p of vacantProps) {
      alerts.push({ type: 'VACANCIA', severity: 'warning', message: `Imóvel "${p.name}" está vago` });
    }
    for (const a of maturingAssets) {
      const days = Math.ceil((a.maturityDate!.getTime() - now.getTime()) / 86400000);
      alerts.push({ type: 'VENCIMENTO', severity: 'info', message: `"${a.name}" vence em ${days} dias`, assetId: a.id });
    }
    for (const p of portfolios) {
      // Considera só meses com recebimento efetivo (> 0), ignorando lançamentos
      // vazios/futuros que gerariam falso alerta de queda.
      const received = p.monthlyHistory.filter((h: any) => Number(h.receivedAmount) > 0);
      if (received.length >= 4) {
        const avg = received.slice(1, 4).reduce((s: number, h: any) => s + Number(h.receivedAmount), 0) / 3;
        const current = Number(received[0].receivedAmount);
        if (avg > 0 && current < avg * 0.9) {
          alerts.push({ type: 'RECEBIVEIS', severity: 'warning', message: `Carteira "${p.name}": queda >10% no recebimento` });
        }
      }
    }

    // FGC: cobertura de R$ 250 mil por CPF por instituição (CDB/LCI/LCA).
    // CRI, CRA, debêntures e Tesouro Direto NÃO têm cobertura FGC — a checagem
    // por emissor vale como alerta de concentração em qualquer caso.
    const FGC_LIMIT = 250_000;
    const FGC_GLOBAL_CAP = 1_000_000; // teto global por CPF a cada 4 anos
    const byIssuer: Record<string, number> = {};
    for (const a of fixedIncomeAssets) {
      const issuer = (a.issuer || 'Emissor não informado').trim();
      byIssuer[issuer] = (byIssuer[issuer] || 0) + Number(a.currentValue);
    }
    let totalFixedIncome = 0;
    for (const [issuer, total] of Object.entries(byIssuer)) {
      totalFixedIncome += total;
      if (total > FGC_LIMIT) {
        const excess = total - FGC_LIMIT;
        alerts.push({
          type: 'FGC',
          severity: 'danger',
          message: `Exposição de ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ao emissor "${issuer}" — ${excess.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} acima da cobertura do FGC (R$ 250 mil por instituição)`,
        });
      }
    }
    if (totalFixedIncome > FGC_GLOBAL_CAP) {
      alerts.push({
        type: 'FGC',
        severity: 'warning',
        message: `Renda fixa total de ${totalFixedIncome.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} — o FGC cobre no máximo R$ 1 milhão por CPF a cada 4 anos, somando todas as instituições`,
      });
    }

    return alerts;
  }
}
