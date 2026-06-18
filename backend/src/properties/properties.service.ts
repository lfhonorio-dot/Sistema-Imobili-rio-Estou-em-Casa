import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PropertiesService {
  constructor(private prisma: PrismaService) {}

  async findAll(q: { classification?: string }) {
    return this.prisma.property.findMany({
      where: {
        deletedAt: null,
        ...(q.classification && { classification: q.classification as any }),
      },
      orderBy: { currentValuation: 'desc' },
    });
  }

  async getSummary() {
    const props = await this.prisma.property.findMany({ where: { deletedAt: null } });
    const byClass: Record<string, number> = {};
    let total = 0;
    let monthlyRent = 0;
    for (const p of props) {
      const v = Number(p.currentValuation);
      byClass[p.classification] = (byClass[p.classification] || 0) + v;
      total += v;
      if (p.classification === 'PARA_RENDA' && p.rentAmount) {
        monthlyRent += Number(p.rentAmount);
      }
    }
    return { total, byClass, monthlyRent };
  }

  async findOne(id: string) {
    const p = await this.prisma.property.findFirst({ where: { id, deletedAt: null } });
    if (!p) throw new NotFoundException('Imóvel não encontrado');
    return p;
  }

  async create(data: any) {
    const { id: _id, createdAt, updatedAt, deletedAt, ...rest } = data;
    return this.prisma.property.create({ data: rest });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    const { id: _id, createdAt, updatedAt, deletedAt, ...rest } = data;
    return this.prisma.property.update({ where: { id }, data: rest });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.property.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
