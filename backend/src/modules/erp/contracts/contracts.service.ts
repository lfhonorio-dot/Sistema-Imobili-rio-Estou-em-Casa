// Serviço de Contratos - lógica de negócio completa
// Gerencia: CRUD, parcelas, extrato do proprietário, alertas de vencimento

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { EmailService } from '../../hub/email/email.service';
import {
  CreateContractDto,
  UpdateContractDto,
  ContractQueryDto,
  ChangeContractStatusDto,
  GenerateInstallmentsDto,
  RequestSignatureDto,
} from './contracts.dto';

@Injectable()
export class ContractsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private emailService: EmailService,
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
        signatureEnvelopes: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: {
            signatories: { select: { id: true, name: true, role: true, status: true } },
          },
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
        property: { select: { id: true, code: true, street: true } },
        owner: { select: { id: true, name: true, email: true, phone: true } },
        tenant: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    // Auto-gera lançamento financeiro para contratos de venda
    if (contract.type === 'SALE' && contract.saleValue) {
      const dueDate = contract.startDate ?? new Date();
      await this.prisma.financialEntry.create({
        data: {
          workspaceId,
          type: 'RECEIVABLE',
          category: 'SALE',
          description: `Compra e venda — ${(contract.property as any)?.code ?? contract.propertyId}`,
          amount: contract.saleValue,
          dueDate,
          status: 'PENDING',
          contractId: contract.id,
          propertyId: contract.propertyId,
          contactId: contract.tenantId ?? undefined,
        },
      });
    }

    // Auto-gera comissão se taxa definida
    if (contract.commissionRate) {
      const baseValue = contract.saleValue ?? contract.rentalValue;
      if (baseValue) {
        const commissionAmount = (Number(baseValue) * Number(contract.commissionRate)) / 100;
        const workspaceUser = await this.prisma.workspaceUser.findFirst({
          where: { workspaceId, userId },
        });
        if (workspaceUser) {
          await this.prisma.commission.create({
            data: {
              workspaceId,
              contractId: contract.id,
              userId: workspaceUser.id,
              rate: contract.commissionRate,
              amount: commissionAmount,
              status: 'PENDING',
            },
          });
        }
      }
    }

    // Gera documento HTML do contrato e envia por email
    await this.sendContractByEmail(workspaceId, contract);

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

  private async sendContractByEmail(workspaceId: string, contract: any) {
    const owner = contract.owner as { name: string; email?: string | null } | null;
    const tenant = contract.tenant as { name: string; email?: string | null } | null;
    const property = contract.property as { code: string; street?: string | null; city?: string | null } | null;

    const recipients = [
      owner?.email,
      tenant?.email,
    ].filter((e): e is string => !!e);

    if (recipients.length === 0) return;

    const typeLabel: Record<string, string> = {
      SALE: 'Compra e Venda',
      RENTAL_RESIDENTIAL: 'Locação Residencial',
      RENTAL_COMMERCIAL: 'Locação Comercial',
      BROKERAGE: 'Intermediação',
    };

    const formatCurrency = (v: unknown) =>
      v ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v)) : '-';

    const formatDate = (d: unknown) =>
      d ? new Date(d as string).toLocaleDateString('pt-BR') : '-';

    const subject = `Contrato de ${typeLabel[contract.type] ?? contract.type} — ${property?.code ?? contract.propertyId}`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; color: #333; max-width: 720px; margin: 0 auto; padding: 24px; }
  h1 { color: #1a1a2e; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
  h2 { color: #2d3748; font-size: 14px; margin-top: 24px; text-transform: uppercase; letter-spacing: 0.05em; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  td { padding: 8px 0; font-size: 14px; }
  td:first-child { color: #718096; width: 40%; }
  td:last-child { font-weight: 500; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #a0aec0; }
</style></head>
<body>
  <h1>Contrato de ${typeLabel[contract.type] ?? contract.type}</h1>
  <p style="color:#718096;font-size:13px;">Número do contrato: <strong>${contract.id}</strong></p>

  <h2>Imóvel</h2>
  <table>
    <tr><td>Código</td><td>${property?.code ?? '-'}</td></tr>
    <tr><td>Endereço</td><td>${property?.street ?? '-'}${property?.city ? ', ' + property.city : ''}</td></tr>
  </table>

  <h2>Partes</h2>
  <table>
    <tr><td>Proprietário</td><td>${owner?.name ?? '-'}</td></tr>
    <tr><td>${contract.type === 'SALE' ? 'Comprador' : 'Locatário'}</td><td>${tenant?.name ?? '-'}</td></tr>
  </table>

  <h2>Condições</h2>
  <table>
    <tr><td>Data de início</td><td>${formatDate(contract.startDate)}</td></tr>
    ${contract.endDate ? `<tr><td>Data de encerramento</td><td>${formatDate(contract.endDate)}</td></tr>` : ''}
    ${contract.saleValue ? `<tr><td>Valor de venda</td><td>${formatCurrency(contract.saleValue)}</td></tr>` : ''}
    ${contract.rentalValue ? `<tr><td>Valor do aluguel</td><td>${formatCurrency(contract.rentalValue)}/mês</td></tr>` : ''}
    ${contract.dueDay ? `<tr><td>Dia de vencimento</td><td>Dia ${contract.dueDay}</td></tr>` : ''}
    ${contract.commissionRate ? `<tr><td>Taxa de comissão</td><td>${contract.commissionRate}%</td></tr>` : ''}
  </table>

  ${contract.notes ? `<h2>Observações</h2><p style="font-size:14px;">${contract.notes}</p>` : ''}

  <p style="margin-top:32px;font-size:14px;color:#4a5568;">
    Este contrato foi gerado automaticamente pelo sistema imobiliário.<br>
    Status atual: <strong>Rascunho (DRAFT)</strong> — aguarda ativação e assinatura das partes.
  </p>

  <div class="footer">
    Gerado em ${new Date().toLocaleString('pt-BR')} · Sistema Imobiliário Estou em Casa
  </div>
</body>
</html>`;

    for (const to of recipients) {
      try {
        await this.emailService.sendEmail(workspaceId, { to, subject, body: html });
      } catch {
        // falha no envio não bloqueia criação do contrato
      }
    }
  }

  // Solicita assinatura eletrônica para o contrato
  async requestSignature(workspaceId: string, id: string, dto: RequestSignatureDto, userId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        owner: { select: { id: true, name: true, email: true, phone: true, cpf: true } },
        tenant: { select: { id: true, name: true, email: true, phone: true, cpf: true } },
        property: { select: { id: true, code: true, street: true, city: true } },
      },
    });
    if (!contract) throw new NotFoundException('Contrato não encontrado');

    if (!contract.owner?.email && !contract.tenant?.email) {
      throw new BadRequestException('Proprietário ou inquilino precisam ter e-mail cadastrado para assinatura eletrônica');
    }

    // Monta a lista de signatários com base nos contatos do contrato
    const signatories: Array<{
      name: string; email: string; role: string; phone?: string; cpf?: string; order: number;
    }> = [];

    if (contract.owner?.email) {
      signatories.push({
        name: contract.owner.name,
        email: contract.owner.email,
        phone: contract.owner.phone ?? undefined,
        cpf: (contract.owner as any).cpf ?? undefined,
        role: 'LOCADOR',
        order: 0,
      });
    }

    if (contract.tenant?.email) {
      signatories.push({
        name: contract.tenant.name,
        email: contract.tenant.email,
        phone: contract.tenant.phone ?? undefined,
        cpf: (contract.tenant as any).cpf ?? undefined,
        role: contract.type === 'SALE' ? 'LOCATARIO' : 'LOCATARIO',
        order: 1,
      });
    }

    if (dto.additionalSignatories?.length) {
      signatories.push(...dto.additionalSignatories.map((s, i) => ({ ...s, order: signatories.length + i })));
    }

    const typeLabel = {
      SALE: 'Compra e Venda',
      RENTAL_RESIDENTIAL: 'Locação Residencial',
      RENTAL_COMMERCIAL: 'Locação Comercial',
      BROKERAGE: 'Intermediação',
    }[contract.type] ?? contract.type;

    const prop = contract.property as any;
    const title = `${typeLabel} — ${prop?.code ?? ''} ${prop?.street ? `(${prop.street}${prop?.city ? ', ' + prop.city : ''})` : ''}`.trim();

    // documentUrl: usa URL fornecida ou placeholder identificável
    const documentUrl = dto.documentUrl ?? `contract-template://${contract.id}`;
    const documentHash = crypto.createHash('sha256').update(documentUrl + Date.now()).digest('hex');

    const envelope = await this.prisma.signatureEnvelope.create({
      data: {
        workspaceId,
        contractId: contract.id,
        title,
        documentUrl,
        documentHash,
        type: dto.type ?? 'ADVANCED',
        order: 'PARALLEL',
        deadline: dto.deadline ? new Date(dto.deadline) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        message: dto.message ?? `Contrato de ${typeLabel} — sua assinatura é necessária.`,
        status: 'DRAFT',
        signatories: {
          create: signatories.map((s) => ({
            name: s.name,
            email: s.email,
            phone: s.phone,
            cpf: s.cpf,
            role: s.role,
            order: s.order,
            token: crypto.randomBytes(32).toString('hex'),
            tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: 'PENDING',
          })),
        },
      },
      include: { signatories: true },
    });

    await this.auditService.log({
      workspaceId, userId, action: 'CREATE',
      entity: 'SignatureEnvelope', entityId: envelope.id,
      after: { contractId: id, signatories: signatories.length },
    });

    return envelope;
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
