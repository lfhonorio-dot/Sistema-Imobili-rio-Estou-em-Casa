import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SnapshotService {
  private readonly logger = new Logger(SnapshotService.name);

  constructor(private prisma: PrismaService) {}

  // Snapshot automático no dia 1º de cada mês às 03h (e reforço no dia 15,
  // caso o computador estivesse desligado no dia 1º — o upsert evita duplicatas)
  @Cron('0 3 1,15 * *')
  async autoSnapshot() {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    for (const u of users) {
      try {
        await this.createSnapshot(u.id);
        this.logger.log(`Snapshot mensal criado para usuário ${u.id}`);
      } catch (e: any) {
        this.logger.error(`Falha no snapshot do usuário ${u.id}: ${e.message}`);
      }
    }
  }

  async getAll(userId: string) {
    return this.prisma.monthlySnapshot.findMany({
      where: { userId },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });
  }

  async createSnapshot(userId: string) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const [assets, properties, receivables, cashFlow] = await Promise.all([
      this.prisma.investmentAsset.findMany({ where: { deletedAt: null } }),
      this.prisma.property.findMany({ where: { deletedAt: null } }),
      this.prisma.receivablePortfolio.findMany({ where: { deletedAt: null } }),
      this.prisma.cashFlowEntry.findMany({ where: { userId, month, year } }),
    ]);

    const byType: Record<string, number> = {};
    for (const a of assets) { byType[a.type] = (byType[a.type] || 0) + Number(a.currentValue); }

    let propertiesRentTotal = 0, propertiesOwnTotal = 0, propertiesSaleTotal = 0, monthlyPassiveIncome = 0;
    for (const p of properties) {
      const v = Number(p.currentValuation);
      if (p.classification === 'PARA_RENDA') { propertiesRentTotal += v; if (p.rentAmount) monthlyPassiveIncome += Number(p.rentAmount); }
      else if (p.classification === 'USO_PROPRIO') propertiesOwnTotal += v;
      else propertiesSaleTotal += v;
    }

    const receivablesTotal = receivables.reduce((s, r) => s + Number(r.presentValue), 0);
    monthlyPassiveIncome += receivables.reduce((s, r) => s + Number(r.monthlyReceivedAmount), 0);
    const monthlyExpenses = cashFlow.filter(e => e.type === 'DESPESA').reduce((s, e) => s + Number(e.amount), 0);
    const totalPatrimony = Object.values(byType).reduce((s, v) => s + v, 0) + propertiesRentTotal + propertiesOwnTotal + propertiesSaleTotal + receivablesTotal;

    const data = {
      userId, month, year, totalPatrimony,
      fixedIncomeTotal: byType['RENDA_FIXA'] || 0, fiiTotal: byType['FII'] || 0,
      stocksTotal: byType['ACAO'] || 0, pensionTotal: byType['PREVIDENCIA'] || 0,
      coeTotal: byType['COE'] || 0, cashTotal: byType['CAIXA'] || 0,
      receivablesTotal, propertiesRentTotal, propertiesOwnTotal, propertiesSaleTotal,
      monthlyPassiveIncome, monthlyExpenses,
    };

    const { userId: _u, month: _m, year: _y, ...updateData } = data;
    return this.prisma.monthlySnapshot.upsert({
      where: { userId_year_month: { userId, year, month } },
      create: data,
      update: updateData,
    });
  }
}
