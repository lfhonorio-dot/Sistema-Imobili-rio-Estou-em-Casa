import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReceivablesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.receivablePortfolio.findMany({
      where: { deletedAt: null },
      include: { monthlyHistory: { orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 12 } },
    });
  }

  async findOne(id: string) {
    const r = await this.prisma.receivablePortfolio.findFirst({
      where: { id, deletedAt: null },
      include: { monthlyHistory: { orderBy: [{ year: 'desc' }, { month: 'desc' }] } },
    });
    if (!r) throw new NotFoundException('Carteira não encontrada');
    return r;
  }

  async create(data: any) {
    const { id: _id, createdAt, updatedAt, deletedAt, monthlyHistory, ...rest } = data;
    return this.prisma.receivablePortfolio.create({ data: rest });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    const { id: _id, createdAt, updatedAt, deletedAt, monthlyHistory, ...rest } = data;
    return this.prisma.receivablePortfolio.update({ where: { id }, data: rest });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.receivablePortfolio.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async addHistory(portfolioId: string, data: { month: number; year: number; expectedAmount: number; receivedAmount: number }) {
    return this.prisma.receivableMonthlyHistory.upsert({
      where: { portfolioId_year_month: { portfolioId, year: Number(data.year), month: Number(data.month) } },
      create: { portfolioId, month: Number(data.month), year: Number(data.year), expectedAmount: data.expectedAmount, receivedAmount: data.receivedAmount },
      update: { receivedAmount: data.receivedAmount, expectedAmount: data.expectedAmount },
    });
  }
}
