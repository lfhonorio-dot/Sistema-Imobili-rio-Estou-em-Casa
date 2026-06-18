import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CashFlowService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, q: { month?: string; year?: string; type?: string }) {
    return this.prisma.cashFlowEntry.findMany({
      where: {
        userId,
        ...(q.month && { month: parseInt(q.month) }),
        ...(q.year && { year: parseInt(q.year) }),
        ...(q.type && { type: q.type as any }),
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { type: 'asc' }],
    });
  }

  async getMonthlySummary(userId: string, month: number, year: number) {
    const entries = await this.prisma.cashFlowEntry.findMany({ where: { userId, month, year } });
    let totalReceitas = 0;
    let totalDespesas = 0;
    const byCategory: Record<string, number> = {};
    for (const e of entries) {
      const v = Number(e.amount);
      if (e.type === 'RECEITA') totalReceitas += v;
      else totalDespesas += v;
      byCategory[e.category] = (byCategory[e.category] || 0) + v;
    }
    return { month, year, totalReceitas, totalDespesas, saldo: totalReceitas - totalDespesas, byCategory, entries };
  }

  async getEvolution(userId: string) {
    const now = new Date();
    const results = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      const s = await this.getMonthlySummary(userId, month, year);
      results.push(s);
    }
    return results;
  }

  async create(userId: string, data: any) {
    const { id: _id, createdAt, updatedAt, user, ...rest } = data;
    return this.prisma.cashFlowEntry.create({ data: { ...rest, userId } });
  }

  async update(id: string, data: any) {
    const { id: _id, createdAt, updatedAt, user, userId, ...rest } = data;
    return this.prisma.cashFlowEntry.update({ where: { id }, data: rest });
  }

  async remove(id: string) {
    return this.prisma.cashFlowEntry.delete({ where: { id } });
  }
}
