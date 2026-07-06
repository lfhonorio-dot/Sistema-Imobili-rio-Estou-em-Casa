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
    const property = await this.prisma.property.create({ data: rest });
    // Primeiro ponto do histórico de avaliações
    await this.prisma.propertyValuationHistory.create({
      data: {
        propertyId: property.id,
        value: property.currentValuation,
        valuationDate: property.lastValuationDate || new Date(),
        notes: 'Avaliação inicial',
      },
    });
    return property;
  }

  async update(id: string, data: any) {
    const existing = await this.findOne(id);
    const { id: _id, createdAt, updatedAt, deletedAt, valuationHistory, ...rest } = data;
    const updated = await this.prisma.property.update({ where: { id }, data: rest });
    // Reavaliação: valor mudou => registra no histórico (o anterior fica preservado)
    if (rest.currentValuation !== undefined && Number(rest.currentValuation) !== Number(existing.currentValuation)) {
      await this.prisma.propertyValuationHistory.create({
        data: {
          propertyId: id,
          value: rest.currentValuation,
          valuationDate: rest.lastValuationDate ? new Date(rest.lastValuationDate) : new Date(),
        },
      });
    }
    return updated;
  }

  async getValuationHistory(id: string) {
    await this.findOne(id);
    return this.prisma.propertyValuationHistory.findMany({
      where: { propertyId: id },
      orderBy: { valuationDate: 'asc' },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.property.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
