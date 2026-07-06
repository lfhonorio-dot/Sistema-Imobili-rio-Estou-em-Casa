import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Modelo financeiro unificado (tudo em termos REAIS, ou seja, já descontada a inflação):
//
// - Aluguéis: contratos corrigidos anualmente (IGPM/IPCA) => renda REAL constante e perpétua.
// - Recebíveis: corrigidos pelo IPCA, porém com prazo FINITO => entram como patrimônio
//   (valor presente), não como renda perpétua. Isso elimina a dupla contagem.
// - Patrimônio financeiro + VP dos recebíveis: rende o retorno real esperado
//   (CDI líquido de IR deflacionado pelo IPCA do cenário).
// - Número FI: patrimônio necessário para cobrir a LACUNA de renda (renda desejada
//   menos aluguéis) usando a Taxa Segura de Retirada configurável (padrão 4% a.a.).
const IR_FACTOR = 0.85; // proxy de IR médio de 15% sobre o rendimento financeiro

@Injectable()
export class RetirementService {
  constructor(private prisma: PrismaService) {}

  async getPlan(userId: string) {
    return this.prisma.retirementPlan.findUnique({ where: { userId } });
  }

  async upsertPlan(userId: string, data: any) {
    const { id: _id, createdAt, updatedAt, user, userId: _uid, ...rest } = data;
    return this.prisma.retirementPlan.upsert({
      where: { userId },
      create: { userId, ...rest },
      update: rest,
    });
  }

  async simulate(userId: string) {
    const plan = await this.prisma.retirementPlan.findUnique({ where: { userId } });
    if (!plan) return null;

    const [assets, rentProperties, receivables] = await Promise.all([
      this.prisma.investmentAsset.findMany({ where: { deletedAt: null } }),
      this.prisma.property.findMany({ where: { deletedAt: null, classification: 'PARA_RENDA' } }),
      this.prisma.receivablePortfolio.findMany({ where: { deletedAt: null } }),
    ]);

    const financialPatrimony = assets.reduce((s, a) => s + Number(a.currentValue), 0);
    const receivablesPV = receivables.reduce((s, r) => s + Number(r.presentValue), 0);
    // Patrimônio "gerador de renda via retirada": financeiro + VP dos recebíveis.
    // Imóveis de renda ficam FORA deste número — eles já contribuem via aluguel.
    const withdrawalPatrimony = financialPatrimony + receivablesPV;

    const monthlyRent = rentProperties.reduce((s, p) => s + (p.rentAmount ? Number(p.rentAmount) : 0), 0);
    const monthlyReceivables = receivables.reduce((s, r) => s + Number(r.monthlyReceivedAmount), 0);

    const desiredIncome = Number(plan.desiredMonthlyIncome);
    const expenses = Number(plan.estimatedMonthlyExpenses);
    const swr = Number((plan as any).safeWithdrawalRate ?? 4.0); // % a.a.
    const expectedCdi = Number(plan.expectedCdi ?? 10.5); // % a.a. nominal
    const expectedIpca = Number(plan.expectedIpca ?? 4.5); // % a.a.

    // Retorno real esperado do patrimônio financeiro (CDI líquido de IR, deflacionado)
    const nominalNet = (expectedCdi / 100) * IR_FACTOR;
    const expectedRealReturn = (1 + nominalNet) / (1 + expectedIpca / 100) - 1; // a.a.
    const monthlyRealReturn = Math.pow(1 + expectedRealReturn, 1 / 12) - 1;

    // Lacuna de renda que o patrimônio precisa cobrir (aluguel é perpétuo e corrigido)
    const incomeGap = Math.max(0, desiredIncome - monthlyRent);

    // Número FI: patrimônio necessário para gerar a lacuna com a taxa segura de retirada
    const fiNumber = swr > 0 ? (incomeGap * 12) / (swr / 100) : 0;
    const fiProgress = fiNumber > 0 ? Math.min((withdrawalPatrimony / fiNumber) * 100, 100) : 100;

    // Renda passiva atual (nominal, observável): aluguel + parcelas de recebíveis
    // + rendimento líquido estimado do patrimônio financeiro (SEM os recebíveis,
    // cuja renda já está contada nas parcelas mensais)
    const financialMonthlyIncome = financialPatrimony * (nominalNet / 12);
    const currentPassiveIncome = monthlyRent + monthlyReceivables + financialMonthlyIncome;

    // Cenários de sustentabilidade (termos reais). Como aluguéis e recebíveis são
    // corrigidos pela inflação, apenas a retirada da LACUNA sai do patrimônio.
    const horizonMonths = 600; // 50 anos
    const scenarios = [
      { name: 'otimista', ipcaScenario: 3.5 },
      { name: 'base', ipcaScenario: expectedIpca },
      { name: 'pessimista', ipcaScenario: 7.5 },
    ].map(({ name, ipcaScenario }) => {
      const realAnnual = (1 + nominalNet) / (1 + ipcaScenario / 100) - 1;
      const realMonthly = Math.pow(1 + Math.max(realAnnual, -0.99), 1 / 12) - 1;
      let patrimony = withdrawalPatrimony;
      let months = 0;
      while (patrimony > 0 && months < horizonMonths) {
        patrimony = patrimony * (1 + realMonthly) - incomeGap;
        months++;
      }
      const perpetual = patrimony > 0;
      return {
        name,
        ipcaScenario,
        realReturn: Number((realAnnual * 100).toFixed(2)),
        sustainabilityYears: perpetual ? 50 : Math.floor(months / 12),
        perpetual,
      };
    });

    return {
      totalPatrimony: withdrawalPatrimony,
      financialPatrimony,
      receivablesPV,
      fiNumber,
      fiProgress,
      incomeGap,
      currentPassiveIncome,
      desiredIncome,
      expenses,
      coverageRate: expenses > 0 ? (currentPassiveIncome / expenses) * 100 : 0,
      scenarios,
      monthlyRent,
      monthlyReceivables,
      safeWithdrawalRate: swr,
      expectedRealReturn: Number((expectedRealReturn * 100).toFixed(2)),
      monthlyRealReturn,
    };
  }

  // Alocação alvo vs. real sobre o patrimônio investível (financeiro + VP de recebíveis).
  // Imóveis ficam fora: rebalancear imóvel não é decisão de tela, é decisão de anos.
  async rebalance(userId: string) {
    const plan = await this.prisma.retirementPlan.findUnique({ where: { userId } });
    if (!plan) return null;

    const [assets, receivables] = await Promise.all([
      this.prisma.investmentAsset.findMany({ where: { deletedAt: null } }),
      this.prisma.receivablePortfolio.findMany({ where: { deletedAt: null } }),
    ]);

    const byType: Record<string, number> = {};
    for (const a of assets) {
      byType[a.type] = (byType[a.type] || 0) + Number(a.currentValue);
    }
    const receivablesPV = receivables.reduce((s, r) => s + Number(r.presentValue), 0);

    const classes = [
      { key: 'RENDA_FIXA', label: 'Renda Fixa', actual: byType['RENDA_FIXA'] || 0, target: Number(plan.targetFixedIncome) },
      { key: 'FII', label: 'FIIs', actual: byType['FII'] || 0, target: Number(plan.targetFii) },
      { key: 'ACAO', label: 'Ações', actual: byType['ACAO'] || 0, target: Number(plan.targetStocks) },
      { key: 'RECEBIVEIS', label: 'Recebíveis', actual: receivablesPV + (byType['RECEBIVEIS'] || 0), target: Number(plan.targetReceivables) },
      { key: 'CAIXA', label: 'Liquidez / Caixa', actual: byType['CAIXA'] || 0, target: Number(plan.targetLiquidity) },
      { key: 'OUTROS', label: 'Outros (Previdência, COE)', actual: (byType['PREVIDENCIA'] || 0) + (byType['COE'] || 0), target: 0 },
    ];

    const total = classes.reduce((s, c) => s + c.actual, 0);
    const targetSum = classes.reduce((s, c) => s + c.target, 0);

    const rows = classes.map(c => {
      const actualPct = total > 0 ? (c.actual / total) * 100 : 0;
      const deviation = actualPct - c.target;
      // Valor a mover para atingir a meta (positivo = comprar, negativo = vender)
      const amountToMove = total > 0 ? ((c.target - actualPct) / 100) * total : 0;
      return {
        ...c,
        actualPct: Number(actualPct.toFixed(1)),
        deviation: Number(deviation.toFixed(1)),
        amountToMove: Math.round(amountToMove),
      };
    });

    return {
      total,
      targetSum: Number(targetSum.toFixed(1)),
      targetSumOk: Math.abs(targetSum - 100) < 0.01,
      rows,
      // banda de tolerância usual em family offices: só age quando desvio > 5 p.p.
      rebalanceBand: 5,
    };
  }
}
