// Serviço de Contratos - lógica de negócio completa
// Gerencia: CRUD, parcelas, extrato do proprietário, alertas de vencimento

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  CreateContractDto,
  UpdateContractDto,
  ContractQueryDto,
  ChangeContractStatusDto,
  GenerateInstallmentsDto,
} from './contracts.dto';

@Injectable()
export class ContractsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // Lista contratos com filtros
  async findAll(workspaceId: string, query: ContractQueryDto) {
    const { page = 1, limit = 20, type, status, propertyId, contactId, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ContractWhereInput = {
      workspaceId,
      deletedAt: null,
      ...(type && { type }),
      ...(status && { status }),
      ...(propertyId && { propertyId }),
      ...(contactId && {
        OR: [{ ownerId: contactId }, { tenantId: contactId }],
      }),
      ...(search && {
        OR: [
          { property: { street: { contains: search, mode: 'insensitive' } } },
          { owner: { name: { contains: search, mode: 'insensitive' } } },
          { tenant: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [contracts, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          property: {
            select: {
              id: true,
              code: true,
              street: true,
              number: true,
              neighborhood: true,
              city: true,
              type: true,
            },
          },
          owner: { select: { id: true, name: true } },
          tenant: { select: { id: true, name: true } },
        },
      }),
      this.prisma.contract.count({ where }),
    ]);

    return {
      items: contracts,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  // Detalhe completo do contrato
  async findOne(workspaceId: string, id: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        property: true,
        owner: { select: { id: true, name: true, phone: true, email: true } },
        tenant: { select: { id: true, name: true, phone: true, email: true } },
        financialEntries: {
          where: { deletedAt: null },
          orderBy: { dueDate: 'asc' },
        },
        commissions: {
          orderBy: { createdAt: 'desc' },
        },
        inspections: {
          where: { deletedAt: null },
          orderBy: { scheduledAt: 'desc' },
        },
        documents: {
          where: { deletedAt: null },
        },
      },
    });

    if (!contract) throw new NotFoundException('Contrato não encontrado');
    return contract;
  }

  // Cria contrato validando entidades do workspace
  async create(workspaceId: string, dto: CreateContractDto, userId: string) {
    // Valida imóvel
    const property = await this.prisma.property.findFirst({
      where: { id: dto.propertyId, workspaceId, deletedAt: null },
    });
    if (!property) throw new BadRequestException('Imóvel não encontrado neste workspace');

    // Valida contatos se informados
    if (dto.ownerId) {
      const owner = await this.prisma.contact.findFirst({
        where: { id: dto.ownerId, workspaceId, deletedAt: null },
      });
      if (!owner) throw new BadRequestException('Proprietário não encontrado');
    }

    if (dto.tenantId) {
      const tenant = await this.prisma.contact.findFirst({
        where: { id: dto.tenantId, workspaceId, deletedAt: null },
      });
      if (!tenant) throw new BadRequestException('Inquilino/Comprador não encontrado');
    }

    const contract = await this.prisma.contract.create({
      data: {
        workspaceId,
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        signedAt: dto.signedAt ? new Date(dto.signedAt) : undefined,
        proposalDate: dto.proposalDate ? new Date(dto.proposalDate) : undefined,
        acceptanceDate: dto.acceptanceDate ? new Date(dto.acceptanceDate) : undefined,
        deedDate: dto.deedDate ? new Date(dto.deedDate) : undefined,
        keyDeliveryDate: dto.keyDeliveryDate ? new Date(dto.keyDeliveryDate) : undefined,
      },
      include: {
        property: true,
        owner: { select: { id: true, name: true } },
        tenant: { select: { id: true, name: true } },
      },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'CREATE',
      entity: 'Contract',
      entityId: contract.id,
      after: contract,
    });

    return contract;
  }

  // Atualiza contrato
  async update(
    workspaceId: string,
    id: string,
    dto: UpdateContractDto,
    userId: string,
  ) {
    const existing = await this.prisma.contract.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Contrato não encontrado');

    const updated = await this.prisma.contract.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        signedAt: dto.signedAt ? new Date(dto.signedAt) : undefined,
        proposalDate: dto.proposalDate ? new Date(dto.proposalDate) : undefined,
        acceptanceDate: dto.acceptanceDate ? new Date(dto.acceptanceDate) : undefined,
        deedDate: dto.deedDate ? new Date(dto.deedDate) : undefined,
        keyDeliveryDate: dto.keyDeliveryDate ? new Date(dto.keyDeliveryDate) : undefined,
      },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'UPDATE',
      entity: 'Contract',
      entityId: id,
      before: existing,
      after: updated,
    });

    return updated;
  }

  // Soft delete do contrato
  async remove(workspaceId: string, id: string, userId: string) {
    const existing = await this.prisma.contract.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Contrato não encontrado');

    await this.prisma.contract.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'DELETE',
      entity: 'Contract',
      entityId: id,
    });

    return { success: true };
  }

  // Altera status do contrato
  async changeStatus(
    workspaceId: string,
    id: string,
    dto: ChangeContractStatusDto,
    userId: string,
  ) {
    const existing = await this.prisma.contract.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Contrato não encontrado');

    const updated = await this.prisma.contract.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'UPDATE',
      entity: 'Contract',
      entityId: id,
      before: { status: existing.status },
      after: { status: dto.status },
    });

    return updated;
  }

  // Gera parcelas mensais de aluguel para N meses
  async generateInstallments(
    workspaceId: string,
    id: string,
    dto: GenerateInstallmentsDto,
  ) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!contract) throw new NotFoundException('Contrato não encontrado');

    if (!contract.rentalValue) {
      throw new BadRequestException('Contrato não possui valor de aluguel definido');
    }

    if (!contract.dueDay) {
      throw new BadRequestException('Contrato não possui dia de vencimento definido');
    }

    const startDate = contract.startDate ?? new Date();
    const entries: Prisma.FinancialEntryCreateManyInput[] = [];

    for (let i = 0; i < dto.months; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      dueDate.setDate(contract.dueDay);

      entries.push({
        workspaceId,
        type: 'RECEIVABLE',
        category: 'RENT',
        description: `Aluguel ${String(dueDate.getMonth() + 1).padStart(2, '0')}/${dueDate.getFullYear()}`,
        amount: contract.rentalValue,
        dueDate,
        status: 'PENDING',
        contractId: id,
        contactId: contract.tenantId ?? undefined,
        installment: i + 1,
        totalInstallments: dto.months,
      });
    }

    await this.prisma.financialEntry.createMany({ data: entries });

    return { created: entries.length };
  }

  // Extrato de repasse do proprietário
  async getStatement(workspaceId: string, id: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        financialEntries: { where: { deletedAt: null } },
        commissions: true,
        property: { select: { id: true, code: true, street: true, city: true } },
        owner: { select: { id: true, name: true } },
        tenant: { select: { id: true, name: true } },
      },
    });

    if (!contract) throw new NotFoundException('Contrato não encontrado');

    const totalReceived = contract.financialEntries
      .filter((e) => e.status === 'PAID' && e.type === 'RECEIVABLE')
      .reduce((sum, e) => sum + Number(e.paidAmount ?? e.amount), 0);

    const totalCommissions = contract.commissions.reduce(
      (sum, c) => sum + Number(c.amount),
      0,
    );

    const totalExpenses = contract.financialEntries
      .filter((e) => e.type === 'PAYABLE' && e.status === 'PAID')
      .reduce((sum, e) => sum + Number(e.paidAmount ?? e.amount), 0);

    const repasse = totalReceived - totalCommissions - totalExpenses;

    return {
      contract: { id: contract.id, type: contract.type },
      property: contract.property,
      owner: contract.owner,
      tenant: contract.tenant,
      summary: {
        totalReceived,
        totalCommissions,
        totalExpenses,
        repasse,
      },
      entries: contract.financialEntries,
      commissions: contract.commissions,
    };
  }

  // Lista contratos próximos do vencimento (30/60/90 dias)
  async findExpiring(workspaceId: string) {
    const now = new Date();
    const in90Days = new Date(now);
    in90Days.setDate(in90Days.getDate() + 90);

    const contracts = await this.prisma.contract.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        status: 'ACTIVE',
        endDate: { gte: now, lte: in90Days },
      },
      include: {
        property: { select: { id: true, code: true, street: true, city: true } },
        owner: { select: { id: true, name: true } },
        tenant: { select: { id: true, name: true } },
      },
      orderBy: { endDate: 'asc' },
    });

    return contracts.map((c) => ({
      ...c,
      daysUntilExpiry: Math.ceil(
        (new Date(c.endDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      ),
    }));
  }
}
