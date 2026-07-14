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

  // Garante month/year coerentes com a data do lançamento (a tela manda só a
  // data; mes/ano são campos obrigatórios usados nos filtros por competência)
  private withCompetence(rest: any) {
    if (rest.date) {
      const d = new Date(rest.date);
      if (!isNaN(d.getTime())) {
        rest.month = d.getUTCMonth() + 1;
        rest.year = d.getUTCFullYear();
        rest.date = d;
      }
    }
    if (rest.amount !== undefined) rest.amount = Number(rest.amount);
    return rest;
  }

  async create(userId: string, data: any) {
    const { id: _id, createdAt, updatedAt, user, ...rest } = data;
    return this.prisma.cashFlowEntry.create({ data: { ...this.withCompetence(rest), userId } });
  }

  async update(id: string, data: any) {
    const { id: _id, createdAt, updatedAt, user, userId, ...rest } = data;
    return this.prisma.cashFlowEntry.update({ where: { id }, data: this.withCompetence(rest) });
  }

  async remove(id: string) {
    return this.prisma.cashFlowEntry.delete({ where: { id } });
  }

  async bulkDelete(userId: string, ids: string[]) {
    if (!ids.length) return { deleted: 0 };
    // userId no filtro garante que so lancamentos do proprio usuario sao apagados
    const result = await this.prisma.cashFlowEntry.deleteMany({
      where: { id: { in: ids }, userId },
    });
    return { deleted: result.count };
  }
}
