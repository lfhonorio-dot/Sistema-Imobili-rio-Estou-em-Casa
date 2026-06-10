// Serviço de Ordens de Manutenção

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateMaintenanceOrderDto,
  UpdateMaintenanceOrderDto,
  MaintenanceQueryDto,
  ChangeMaintenanceStatusDto,
} from './maintenance.dto';

@Injectable()
export class MaintenanceService {
  constructor(private prisma: PrismaService) {}

  async findAll(workspaceId: string, query: MaintenanceQueryDto) {
    const { page = 1, limit = 20, status, priority, type, propertyId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.MaintenanceOrderWhereInput = {
      workspaceId,
      deletedAt: null,
      ...(status && { status }),
      ...(priority && { priority }),
      ...(type && { type }),
      ...(propertyId && { propertyId }),
    };

    const [orders, total] = await Promise.all([
      this.prisma.maintenanceOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          property: { select: { id: true, code: true, street: true, city: true } },
        },
      }),
      this.prisma.maintenanceOrder.count({ where }),
    ]);

    return {
      items: orders,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(workspaceId: string, id: string) {
    const order = await this.prisma.maintenanceOrder.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        property: true,
      },
    });
    if (!order) throw new NotFoundException('Ordem de manutenção não encontrada');
    return order;
  }

  async create(workspaceId: string, dto: CreateMaintenanceOrderDto) {
    return this.prisma.maintenanceOrder.create({
      data: { workspaceId, ...dto },
    });
  }

  async update(workspaceId: string, id: string, dto: UpdateMaintenanceOrderDto) {
    const existing = await this.prisma.maintenanceOrder.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Ordem de manutenção não encontrada');

    return this.prisma.maintenanceOrder.update({
      where: { id },
      data: dto,
    });
  }

  async remove(workspaceId: string, id: string) {
    const existing = await this.prisma.maintenanceOrder.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Ordem de manutenção não encontrada');

    await this.prisma.maintenanceOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  async changeStatus(workspaceId: string, id: string, dto: ChangeMaintenanceStatusDto) {
    const existing = await this.prisma.maintenanceOrder.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Ordem de manutenção não encontrada');

    const data: Prisma.MaintenanceOrderUpdateInput = {
      status: dto.status,
      ...(dto.supplierName !== undefined && { supplierName: dto.supplierName }),
      ...(dto.quotedAmount !== undefined && { quotedAmount: dto.quotedAmount }),
      ...(dto.finalAmount !== undefined && { finalAmount: dto.finalAmount }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    };
    if (dto.status === 'COMPLETED') {
      data.completedAt = new Date();
    }

    return this.prisma.maintenanceOrder.update({ where: { id }, data });
  }

  async approve(workspaceId: string, id: string) {
    const existing = await this.prisma.maintenanceOrder.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Ordem de manutenção não encontrada');

    return this.prisma.maintenanceOrder.update({
      where: { id },
      data: {
        approvedAt: new Date(),
        status: 'IN_PROGRESS',
      },
    });
  }
}
