import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { type?: string; broker?: string; search?: string }) {
    return this.prisma.investmentAsset.findMany({
      where: {
        deletedAt: null,
        ...(query.type && { type: query.type as any }),
        ...(query.broker && { broker: query.broker }),
        ...(query.search && {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { ticker: { contains: query.search, mode: 'insensitive' } },
            { issuer: { contains: query.search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        dividendHistory: { orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 12 },
      },
      orderBy: { currentValue: 'desc' },
    });
  }

  async getSummary() {
    const assets = await this.prisma.investmentAsset.findMany({ where: { deletedAt: null } });
    const byType: Record<string, number> = {};
    let total = 0;
    for (const a of assets) {
      const v = Number(a.currentValue);
      byType[a.type] = (byType[a.type] || 0) + v;
      total += v;
    }
    return { total, byType };
  }

  async findOne(id: string) {
    const asset = await this.prisma.investmentAsset.findFirst({
      where: { id, deletedAt: null },
      include: { dividendHistory: { orderBy: [{ year: 'desc' }, { month: 'desc' }] } },
    });
    if (!asset) throw new NotFoundException('Ativo não encontrado');
    return asset;
  }

  async create(data: any) {
    const { dividendHistory, ...rest } = data;
    return this.prisma.investmentAsset.create({ data: rest });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    const { dividendHistory, id: _id, createdAt, updatedAt, deletedAt, ...rest } = data;
    return this.prisma.investmentAsset.update({ where: { id }, data: rest });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.investmentAsset.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async addDividend(assetId: string, data: { month: number; year: number; amount: number; totalAmount: number }) {
    return this.prisma.dividendHistory.upsert({
      where: { assetId_year_month: { assetId, year: Number(data.year), month: Number(data.month) } },
      create: { assetId, month: Number(data.month), year: Number(data.year), amount: data.amount, totalAmount: data.totalAmount },
      update: { amount: data.amount, totalAmount: data.totalAmount },
    });
  }

  async getDividends(assetId: string) {
    return this.prisma.dividendHistory.findMany({
      where: { assetId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }
}
