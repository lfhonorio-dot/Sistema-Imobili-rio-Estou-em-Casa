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

  async addHistory(portfolioId: string, data: any) {
    // Aceita tanto {expected, received} (nomes do frontend) quanto
    // {expectedAmount, receivedAmount} (nomes internos), evitando gravar vazio.
    const expectedAmount = Number(data.expectedAmount ?? data.expected ?? 0);
    const receivedAmount = Number(data.receivedAmount ?? data.received ?? 0);
    const year = Number(data.year);
    const month = Number(data.month);
    const record = await this.prisma.receivableMonthlyHistory.upsert({
      where: { portfolioId_year_month: { portfolioId, year, month } },
      create: { portfolioId, month, year, expectedAmount, receivedAmount },
      update: { expectedAmount, receivedAmount },
    });

    // Se este é o mês mais recente do histórico, sincroniza o "Recebido/mês"
    // e o "Previsto/mês" da carteira para os cards refletirem o lançamento.
    const latest = await this.prisma.receivableMonthlyHistory.findFirst({
      where: { portfolioId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    if (latest && latest.year === year && latest.month === month) {
      await this.prisma.receivablePortfolio.update({
        where: { id: portfolioId },
        data: { monthlyReceivedAmount: receivedAmount, expectedMonthlyAmount: expectedAmount },
      });
    }

    return record;
  }
}
