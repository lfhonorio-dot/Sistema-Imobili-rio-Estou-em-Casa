import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

    const [assets, properties, receivables] = await Promise.all([
      this.prisma.investmentAsset.findMany({ where: { deletedAt: null } }),
      this.prisma.property.findMany({ where: { deletedAt: null, classification: 'PARA_RENDA' } }),
      this.prisma.receivablePortfolio.findMany({ where: { deletedAt: null } }),
    ]);

    let totalPatrimony = assets.reduce((s, a) => s + Number(a.currentValue), 0);
    totalPatrimony += receivables.reduce((s, r) => s + Number(r.presentValue), 0);

    const monthlyRent = properties.reduce((s, p) => s + (p.rentAmount ? Number(p.rentAmount) : 0), 0);
    const monthlyReceivables = receivables.reduce((s, r) => s + Number(r.monthlyReceivedAmount), 0);
    const avgYield = 0.006;

    const desiredIncome = Number(plan.desiredMonthlyIncome);
    const expenses = Number(plan.estimatedMonthlyExpenses);
    const fiNumber = (desiredIncome * 12) / (avgYield * 12);
    const fiProgress = Math.min((totalPatrimony / fiNumber) * 100, 100);
    const currentPassiveIncome = monthlyRent + monthlyReceivables + (totalPatrimony * avgYield);

    const scenarios = [
      { name: 'otimista', ipcaScenario: 3.5 },
      { name: 'base', ipcaScenario: 5.5 },
      { name: 'pessimista', ipcaScenario: 7.5 },
    ].map(({ name, ipcaScenario }) => {
      const realAnnualReturn = (avgYield * 12) - (ipcaScenario / 100);
      let patrimony = totalPatrimony;
      let months = 0;
      while (patrimony > 0 && months < 600) {
        patrimony = patrimony * (1 + realAnnualReturn / 12) - desiredIncome;
        months++;
      }
      return { name, ipcaScenario, sustainabilityYears: patrimony > 0 ? 50 : Math.floor(months / 12) };
    });

    return {
      totalPatrimony, fiNumber, fiProgress, currentPassiveIncome, desiredIncome, expenses,
      coverageRate: (currentPassiveIncome / expenses) * 100,
      scenarios, monthlyRent, monthlyReceivables,
      safeWithdrawalRate: 4.0,
    };
  }
}
