// Serviço Financeiro - DRE, parcelas, comissões, inadimplência

import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateFinancialEntryDto,
  UpdateFinancialEntryDto,
  FinancialQueryDto,
  PayEntryDto,
  CommissionQueryDto,
} from './financial.dto';

@Injectable()
export class FinancialService {
  constructor(private prisma: PrismaService) {}

  // Lista lançamentos financeiros com filtros
  async findAllEntries(workspaceId: string, query: FinancialQueryDto) {
    const { page = 1, limit = 20, type, status, contractId, contactId, dateFrom, dateTo } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.FinancialEntryWhereInput = {
      workspaceId,
      deletedAt: null,
      ...(type && { type }),
      ...(status && { status }),
      ...(contractId && { contractId }),
      ...(contactId && { contactId }),
      ...(dateFrom || dateTo
        ? {
            dueDate: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo) }),
            },
          }
        : {}),
    };

    const [entries, total] = await Promise.all([
      this.prisma.financialEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dueDate: 'asc' },
        include: {
          contract: {
            select: { id: true, type: true, property: { select: { id: true, code: true, street: true } } },
          },
        },
      }),
      this.prisma.financialEntry.count({ where }),
    ]);

    return {
      items: entries,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  // Cria lançamento manual
  async createEntry(workspaceId: string, dto: CreateFinancialEntryDto) {
    return this.prisma.financialEntry.create({
      data: {
        workspaceId,
        ...dto,
        dueDate: new Date(dto.dueDate),
      },
    });
  }

  // Busca lançamento por ID
  async findOneEntry(workspaceId: string, id: string) {
    const entry = await this.prisma.financialEntry.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        contract: { include: { property: true } },
      },
    });
    if (!entry) throw new NotFoundException('Lançamento não encontrado');
    return entry;
  }

  // Atualiza lançamento
  async updateEntry(workspaceId: string, id: string, dto: UpdateFinancialEntryDto) {
    const existing = await this.prisma.financialEntry.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Lançamento não encontrado');

    return this.prisma.financialEntry.update({
      where: { id },
      data: { ...dto, dueDate: new Date(dto.dueDate) },
    });
  }

  // Soft delete
  async removeEntry(workspaceId: string, id: string) {
    const existing = await this.prisma.financialEntry.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Lançamento não encontrado');

    await this.prisma.financialEntry.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  // Marca lançamento como pago
  async payEntry(workspaceId: string, id: string, dto: PayEntryDto) {
    const existing = await this.prisma.financialEntry.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Lançamento não encontrado');

    return this.prisma.financialEntry.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        paidAmount: dto.paidAmount ?? existing.amount,
        paymentMethod: dto.paymentMethod,
      },
    });
  }

  // DRE resumido do workspace
  async getSummary(workspaceId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [receivable, payable, received, paid, overdue] = await Promise.all([
      // Total a receber (pendente)
      this.prisma.financialEntry.aggregate({
        where: { workspaceId, deletedAt: null, type: 'RECEIVABLE', status: 'PENDING' },
        _sum: { amount: true },
      }),
      // Total a pagar (pendente)
      this.prisma.financialEntry.aggregate({
        where: { workspaceId, deletedAt: null, type: 'PAYABLE', status: 'PENDING' },
        _sum: { amount: true },
      }),
      // Recebido no mês
      this.prisma.financialEntry.aggregate({
        where: {
          workspaceId,
          deletedAt: null,
          type: 'RECEIVABLE',
          status: 'PAID',
          paidAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { paidAmount: true },
      }),
      // Pago no mês
      this.prisma.financialEntry.aggregate({
        where: {
          workspaceId,
          deletedAt: null,
          type: 'PAYABLE',
          status: 'PAID',
          paidAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { paidAmount: true },
      }),
      // Em atraso
      this.prisma.financialEntry.aggregate({
        where: {
          workspaceId,
          deletedAt: null,
          status: 'PENDING',
          dueDate: { lt: now },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const totalReceivable = Number(receivable._sum.amount ?? 0);
    const totalPayable = Number(payable._sum.amount ?? 0);
    const totalReceived = Number(received._sum.paidAmount ?? 0);
    const totalPaid = Number(paid._sum.paidAmount ?? 0);
    const totalOverdue = Number(overdue._sum.amount ?? 0);

    return {
      totalReceivable,
      totalPayable,
      totalReceived,
      totalPaid,
      balance: totalReceived - totalPaid,
      totalOverdue,
      overdueCount: overdue._count,
    };
  }

  // Previsão de recebimentos para os próximos 30/60/90 dias
  async getForecast(workspaceId: string) {
    const now = new Date();
    const in30 = new Date(now); in30.setDate(in30.getDate() + 30);
    const in60 = new Date(now); in60.setDate(in60.getDate() + 60);
    const in90 = new Date(now); in90.setDate(in90.getDate() + 90);

    const [p30, p60, p90] = await Promise.all([
      this.prisma.financialEntry.aggregate({
        where: { workspaceId, deletedAt: null, type: 'RECEIVABLE', status: 'PENDING', dueDate: { gte: now, lte: in30 } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.financialEntry.aggregate({
        where: { workspaceId, deletedAt: null, type: 'RECEIVABLE', status: 'PENDING', dueDate: { gt: in30, lte: in60 } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.financialEntry.aggregate({
        where: { workspaceId, deletedAt: null, type: 'RECEIVABLE', status: 'PENDING', dueDate: { gt: in60, lte: in90 } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      next30Days: { amount: Number(p30._sum.amount ?? 0), count: p30._count },
      next60Days: { amount: Number(p60._sum.amount ?? 0), count: p60._count },
      next90Days: { amount: Number(p90._sum.amount ?? 0), count: p90._count },
    };
  }

  // Lista lançamentos em atraso com dados do contato
  async getOverdue(workspaceId: string) {
    const now = new Date();

    const entries = await this.prisma.financialEntry.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        status: 'PENDING',
        dueDate: { lt: now },
      },
      orderBy: { dueDate: 'asc' },
      include: {
        contract: {
          select: {
            id: true,
            type: true,
            property: { select: { id: true, code: true, street: true } },
            tenant: { select: { id: true, name: true, phone: true, email: true } },
          },
        },
      },
    });

    return entries.map((e) => ({
      ...e,
      daysOverdue: Math.floor((now.getTime() - e.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
    }));
  }

  // Lista comissões com filtros
  async findAllCommissions(workspaceId: string, query: CommissionQueryDto) {
    const { page = 1, limit = 20, userId, status, dateFrom, dateTo } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CommissionWhereInput = {
      workspaceId,
      ...(userId && { userId }),
      ...(status && { status }),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo) }),
            },
          }
        : {}),
    };

    const [commissions, total] = await Promise.all([
      this.prisma.commission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contract: {
            select: {
              id: true,
              type: true,
              property: { select: { id: true, code: true, street: true } },
            },
          },
        },
      }),
      this.prisma.commission.count({ where }),
    ]);

    return {
      items: commissions,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  // Marca comissão como paga
  async payCommission(workspaceId: string, id: string) {
    const commission = await this.prisma.commission.findFirst({
      where: { id, workspaceId },
    });
    if (!commission) throw new NotFoundException('Comissão não encontrada');

    return this.prisma.commission.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
    });
  }
}
