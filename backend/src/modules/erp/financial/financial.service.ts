// Serviço Financeiro - DRE, parcelas, comissões, inadimplência

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../hub/email/email.service';
import { CommissionReceiptService } from './commission-receipt.service';
import {
  CreateFinancialEntryDto,
  UpdateFinancialEntryDto,
  FinancialQueryDto,
  PayEntryDto,
  CommissionQueryDto,
  ReceiveCommissionDto,
  RegisterPaymentDto,
} from './financial.dto';
import { OPEN_STATUSES, PaymentsService } from './payments.service';
import { FinancialConfigService } from './financial-config.service';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class FinancialService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private commissionReceipt: CommissionReceiptService,
    private payments: PaymentsService,
    private config: FinancialConfigService,
    private billing: BillingService,
  ) {}

  // Lista lançamentos financeiros com filtros
  async findAllEntries(workspaceId: string, query: FinancialQueryDto) {
    const { page = 1, limit = 20, type, category, status, contractId, contactId, dateFrom, dateTo, costCenterId, search } = query;
    const skip = (page - 1) * limit;

    // Fase 5: "PARTIAL" = em aberto com parte já baixada; "OPEN" = em aberto
    const statusWhere: Prisma.FinancialEntryWhereInput =
      status === 'PARTIAL' ? { status: { in: OPEN_STATUSES }, paidAmount: { not: null } }
      : status === 'OPEN' ? { status: { in: OPEN_STATUSES } }
      : status ? { status } : {};

    const where: Prisma.FinancialEntryWhereInput = {
      workspaceId,
      deletedAt: null,
      ...(type && { type }),
      ...(category && { category }),
      ...statusWhere,
      ...(contractId && { contractId }),
      ...(contactId && { contactId }),
      ...(costCenterId && { costCenterId }),
      ...(search && { description: { contains: search, mode: 'insensitive' as const } }),
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
            select: { id: true, type: true, code: true, property: { select: { id: true, code: true, street: true } } },
          },
          // cobrança ativa (boleto/PIX). Canceladas são desvinculadas (Fase 5).
          boleto: {
            select: {
              id: true, kind: true, status: true, bankSlipUrl: true, linhaDigitavel: true,
              pixCopiaECola: true, dueDate: true, amount: true, lastSentAt: true, lastSentChannels: true,
            },
          },
        },
      }),
      this.prisma.financialEntry.count({ where }),
    ]);

    // Nomes de fornecedor, contato e centro de custo (sempre dentro do workspace)
    const ids = (k: 'supplierId' | 'contactId' | 'costCenterId') =>
      [...new Set(entries.map((e) => e[k]).filter((v): v is string => !!v))];
    const [suppliers, contacts, centers] = await Promise.all([
      ids('supplierId').length ? this.prisma.supplier.findMany({ where: { workspaceId, id: { in: ids('supplierId') } }, select: { id: true, name: true } }) : [],
      ids('contactId').length ? this.prisma.contact.findMany({ where: { workspaceId, id: { in: ids('contactId') } }, select: { id: true, name: true } }) : [],
      ids('costCenterId').length ? this.prisma.costCenter.findMany({ where: { workspaceId, id: { in: ids('costCenterId') } }, select: { id: true, name: true } }) : [],
    ]);
    const byId = <T extends { id: string }>(l: T[]) => new Map(l.map((x) => [x.id, x]));
    const supplierById = byId(suppliers);
    const contactById = byId(contacts);
    const centerById = byId(centers);

    return {
      items: entries.map((e) => ({
        ...e,
        openAmount: e.status === 'CANCELLED' || e.status === 'EXEMPT' ? 0 : PaymentsService.openAmount(e),
        isPartial: OPEN_STATUSES.includes(e.status) && e.paidAmount != null && Number(e.paidAmount) > 0,
        supplier: e.supplierId ? supplierById.get(e.supplierId) ?? null : null,
        contact: e.contactId ? contactById.get(e.contactId) ?? null : null,
        costCenter: e.costCenterId ? centerById.get(e.costCenterId) ?? null : null,
      })),
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  // Valida que contrato/imóvel/contato informados pertencem ao workspace do
  // usuário. Sem isso, um ID de outra imobiliária entraria pela FK (o Prisma só
  // checa a existência do registro, não o tenant).
  private async assertLinksBelongToWorkspace(
    workspaceId: string,
    dto: { contractId?: string; propertyId?: string; contactId?: string; supplierId?: string; costCenterId?: string },
  ) {
    if (dto.contractId) {
      const contract = await this.prisma.contract.findFirst({
        where: { id: dto.contractId, workspaceId, deletedAt: null },
        select: { id: true },
      });
      if (!contract) throw new BadRequestException('Contrato não encontrado neste workspace');
    }
    if (dto.propertyId) {
      const property = await this.prisma.property.findFirst({
        where: { id: dto.propertyId, workspaceId, deletedAt: null },
        select: { id: true },
      });
      if (!property) throw new BadRequestException('Imóvel não encontrado neste workspace');
    }
    if (dto.contactId) {
      const contact = await this.prisma.contact.findFirst({
        where: { id: dto.contactId, workspaceId, deletedAt: null },
        select: { id: true },
      });
      if (!contact) throw new BadRequestException('Contato não encontrado neste workspace');
    }
    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, workspaceId, deletedAt: null },
        select: { id: true },
      });
      if (!supplier) throw new BadRequestException('Fornecedor não encontrado neste workspace');
    }
    if (dto.costCenterId) await this.config.assertCostCenter(workspaceId, dto.costCenterId);
  }

  // Cria lançamento manual
  async createEntry(workspaceId: string, dto: CreateFinancialEntryDto) {
    if (!(dto.amount > 0)) throw new BadRequestException('Informe um valor maior que zero.');
    await this.config.assertCategory(workspaceId, dto.type, dto.category);
    await this.assertLinksBelongToWorkspace(workspaceId, dto);

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
        boleto: true,
      },
    });
    if (!entry) throw new NotFoundException('Lançamento não encontrado');
    return { ...entry, openAmount: PaymentsService.openAmount(entry) };
  }

  // Atualiza lançamento (Fase 5: regras para não desalinhar baixas e cobranças)
  async updateEntry(workspaceId: string, id: string, dto: UpdateFinancialEntryDto) {
    const existing = await this.prisma.financialEntry.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: { boleto: { select: { id: true, kind: true } } },
    });
    if (!existing) throw new NotFoundException('Lançamento não encontrado');
    if (existing.status === 'CANCELLED') throw new BadRequestException('Lançamento cancelado não pode ser editado.');
    if (existing.status === 'PAID') throw new BadRequestException('Lançamento quitado não pode ser editado. Estorne a baixa antes, se precisar corrigir.');
    if (dto.type !== existing.type) throw new BadRequestException('Não é possível trocar uma conta a receber por uma a pagar (ou vice-versa). Cancele e crie outra.');
    if (!(dto.amount > 0)) throw new BadRequestException('Informe um valor maior que zero.');
    if (dto.category !== existing.category) await this.config.assertCategory(workspaceId, dto.type, dto.category);

    const paid = Number(existing.paidAmount ?? 0);
    if (dto.amount < paid) {
      throw new BadRequestException(`O valor não pode ficar abaixo do que já foi baixado (R$ ${paid.toFixed(2)}).`);
    }
    const changesCharge = Number(existing.amount) !== Number(dto.amount) ||
      existing.dueDate.toISOString().slice(0, 10) !== dto.dueDate.slice(0, 10);
    if (existing.boleto && changesCharge) {
      throw new BadRequestException(
        `Esta conta tem ${existing.boleto.kind === 'PIX' ? 'cobrança PIX' : 'boleto'} emitido. Para mudar valor ou vencimento, use "Reemitir" (o sistema cancela a cobrança antiga no banco).`,
      );
    }

    await this.assertLinksBelongToWorkspace(workspaceId, dto);

    return this.prisma.$transaction(async (tx) => {
      await tx.financialEntry.update({
        where: { id },
        data: { ...dto, dueDate: new Date(dto.dueDate) },
      });
      await this.payments.recompute(tx, id); // valor/vencimento mudam a situação
      return tx.financialEntry.findUnique({ where: { id } });
    });
  }

  // Soft delete — só para lançamentos sem baixa e sem cobrança ativa
  async removeEntry(workspaceId: string, id: string) {
    const existing = await this.prisma.financialEntry.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: { boleto: { select: { id: true } } },
    });
    if (!existing) throw new NotFoundException('Lançamento não encontrado');
    const activePayments = await this.prisma.financialPayment.count({ where: { entryId: id, reversedAt: null } });
    if (activePayments > 0) {
      throw new BadRequestException('Este lançamento tem baixa registrada. Use "Cancelar" (com motivo) depois de estornar as baixas.');
    }
    if (existing.boleto) {
      throw new BadRequestException('Este lançamento tem boleto/PIX emitido. Cancele a cobrança antes de excluir.');
    }

    await this.prisma.financialEntry.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  /**
   * Cancela uma conta (com motivo). Se houver boleto/PIX ativo, cancela
   * PRIMEIRO no gateway; se o gateway recusar, nada é cancelado aqui.
   */
  async cancelEntry(workspaceId: string, id: string, reason: string, userId?: string) {
    const why = reason?.trim();
    if (!why) throw new BadRequestException('Informe o motivo do cancelamento.');
    const existing = await this.prisma.financialEntry.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: { boleto: { select: { id: true } } },
    });
    if (!existing) throw new NotFoundException('Lançamento não encontrado');
    if (existing.status === 'CANCELLED') throw new BadRequestException('Este lançamento já está cancelado.');
    const activePayments = await this.prisma.financialPayment.count({ where: { entryId: id, reversedAt: null } });
    if (activePayments > 0) {
      throw new BadRequestException('Este lançamento tem baixa registrada. Estorne as baixas antes de cancelar.');
    }
    if (existing.boleto) {
      await this.billing.cancelCharge(workspaceId, existing.boleto.id, `Conta cancelada: ${why}`, userId);
    }
    const flip = await this.prisma.financialEntry.updateMany({
      where: { id, workspaceId, status: { not: 'CANCELLED' } },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: why },
    });
    if (flip.count !== 1) throw new BadRequestException('Este lançamento já está cancelado.');
    return this.prisma.financialEntry.findUnique({ where: { id } });
  }

  // Marca lançamento como pago (compatibilidade: quita o saldo em aberto)
  async payEntry(workspaceId: string, id: string, dto: PayEntryDto, userId?: string) {
    const existing = await this.prisma.financialEntry.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Lançamento não encontrado');
    const open = PaymentsService.openAmount(existing);
    const paid = dto.paidAmount ?? open;
    return this.registerPayment(workspaceId, id, {
      principal: Math.min(paid, open),
      interest: paid > open ? Math.round((paid - open) * 100) / 100 : 0,
      paidAt: dto.paidAt,
      method: dto.paymentMethod,
    }, userId);
  }

  /** Baixa manual (total ou parcial). Recusa se houver boleto/PIX ativo. */
  async registerPayment(workspaceId: string, id: string, dto: RegisterPaymentDto, userId?: string) {
    const charge = await this.prisma.boleto.findFirst({
      where: { workspaceId, financialEntryId: id, deletedAt: null, status: { notIn: ['CANCELLED', 'PAID'] } },
      select: { kind: true },
    });
    if (charge) {
      throw new BadRequestException(
        `Esta conta tem ${charge.kind === 'PIX' ? 'cobrança PIX' : 'boleto'} emitido: a baixa vem automaticamente quando o banco confirmar. ` +
        'Se o pagador pagou por outro meio, cancele a cobrança antes (para ele não pagar duas vezes) e registre o recebimento.',
      );
    }
    return this.payments.register(workspaceId, id, { ...dto, source: 'MANUAL' }, userId);
  }

  // Resumo do workspace (Fase 5: saldo em aberto desconta baixas parciais;
  // recebido/pago no mês vem das baixas efetivas)
  async getSummary(workspaceId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const open = { workspaceId, deletedAt: null, status: { in: OPEN_STATUSES } };

    const [receivable, payable, overdue, monthPays] = await Promise.all([
      this.prisma.financialEntry.aggregate({ where: { ...open, type: 'RECEIVABLE' }, _sum: { amount: true, paidAmount: true } }),
      this.prisma.financialEntry.aggregate({ where: { ...open, type: 'PAYABLE' }, _sum: { amount: true, paidAmount: true } }),
      this.prisma.financialEntry.aggregate({
        where: { ...open, dueDate: { lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } },
        _sum: { amount: true, paidAmount: true },
        _count: true,
      }),
      this.prisma.financialPayment.findMany({
        where: { workspaceId, reversedAt: null, paidAt: { gte: startOfMonth, lte: endOfMonth } },
        select: { total: true, entryId: true },
      }),
    ]);
    const types = monthPays.length
      ? await this.prisma.financialEntry.findMany({ where: { workspaceId, id: { in: [...new Set(monthPays.map((p) => p.entryId))] } }, select: { id: true, type: true } })
      : [];
    const typeById = new Map(types.map((t) => [t.id, t.type]));
    const sumType = (t: string) => monthPays.filter((p) => typeById.get(p.entryId) === t).reduce((s, p) => s + Number(p.total), 0);
    const rest = (a: { _sum: { amount: unknown; paidAmount: unknown } }) => Number(a._sum.amount ?? 0) - Number(a._sum.paidAmount ?? 0);

    const totalReceived = Math.round(sumType('RECEIVABLE') * 100) / 100;
    const totalPaid = Math.round(sumType('PAYABLE') * 100) / 100;
    return {
      totalReceivable: rest(receivable),
      totalPayable: rest(payable),
      totalReceived,
      totalPaid,
      balance: Math.round((totalReceived - totalPaid) * 100) / 100,
      totalOverdue: rest(overdue),
      overdueCount: overdue._count,
    };
  }

  // Previsão de recebimentos para os próximos 30/60/90 dias (saldo em aberto)
  async getForecast(workspaceId: string) {
    const now = new Date();
    const in30 = new Date(now); in30.setDate(in30.getDate() + 30);
    const in60 = new Date(now); in60.setDate(in60.getDate() + 60);
    const in90 = new Date(now); in90.setDate(in90.getDate() + 90);
    const base = { workspaceId, deletedAt: null, type: 'RECEIVABLE', status: { in: OPEN_STATUSES } };

    const agg = (dueDate: Prisma.DateTimeFilter) =>
      this.prisma.financialEntry.aggregate({ where: { ...base, dueDate }, _sum: { amount: true, paidAmount: true }, _count: true });
    const [p30, p60, p90] = await Promise.all([
      agg({ gte: now, lte: in30 }), agg({ gt: in30, lte: in60 }), agg({ gt: in60, lte: in90 }),
    ]);
    const val = (a: { _sum: { amount: unknown; paidAmount: unknown }; _count: number }) =>
      ({ amount: Number(a._sum.amount ?? 0) - Number(a._sum.paidAmount ?? 0), count: a._count });

    return { next30Days: val(p30), next60Days: val(p60), next90Days: val(p90) };
  }

  // Lista lançamentos em atraso com dados do contato
  async getOverdue(workspaceId: string) {
    const now = new Date();

    const entries = await this.prisma.financialEntry.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        status: { in: OPEN_STATUSES },
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
  /**
   * Fase 7 — comissões do PRÓPRIO usuário (todas as funções; é a única parte
   * do financeiro que o Corretor vê): repasses a receber da imobiliária e as
   * comissões do modelo antigo em nome dele.
   */
  async myCommissions(workspaceId: string, memberId: string) {
    const [entries, legacy] = await Promise.all([
      this.prisma.financialEntry.findMany({
        where: { workspaceId, deletedAt: null, type: 'PAYABLE', category: 'COMMISSION', beneficiaryUserId: memberId },
        orderBy: { dueDate: 'asc' },
        select: {
          id: true, description: true, amount: true, paidAmount: true, dueDate: true, paidAt: true, status: true, cancelReason: true,
          contractId: true, installment: true, totalInstallments: true, contract: { select: { code: true, property: { select: { code: true, street: true } } } },
        },
      }),
      this.prisma.commission.findMany({
        where: { workspaceId, userId: memberId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, amount: true, rate: true, status: true, paidAt: true, contract: { select: { code: true, property: { select: { code: true } } } } },
      }),
    ]);
    const open = entries.filter((e) => OPEN_STATUSES.includes(e.status));
    const toReceive = Math.round(open.reduce((s, e) => s + Number(e.amount) - Number(e.paidAmount ?? 0), 0) * 100) / 100;
    const received = Math.round(entries.reduce((s, e) => s + Number(e.paidAmount ?? 0), 0) * 100) / 100;
    return { entries, legacy, totals: { toReceive, received, openCount: open.length } };
  }

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

  // Marca comissão como recebida e gera lançamento financeiro PAID (atômico)
  async receiveCommission(workspaceId: string, id: string, dto: ReceiveCommissionDto) {
    const commission = await this.prisma.commission.findFirst({
      where: { id, workspaceId },
      include: { contract: { select: { id: true, property: { select: { code: true } } } } },
    });
    if (!commission) throw new NotFoundException('Comissão não encontrada');
    if (commission.status === 'RECEIVED' || commission.status === 'PAID') {
      throw new BadRequestException('Comissão já foi recebida.');
    }

    const receivedValue = dto.receivedValue ?? Number(commission.amount);
    const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.commission.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          paidAt: receivedAt,
          receivedValue,
          paymentMethod: dto.paymentMethod,
          notes: dto.notes ?? commission.notes,
        },
      });

      // Lançamento financeiro de comissão recebida
      const entry = await tx.financialEntry.create({
        data: {
          workspaceId,
          type: 'RECEIVABLE',
          category: 'COMMISSION',
          description: `Comissão recebida — ${(commission.contract?.property as any)?.code ?? commission.contractId}`,
          amount: receivedValue,
          dueDate: receivedAt,
          status: 'PAID',
          paidAt: receivedAt,
          paidAmount: receivedValue,
          paymentMethod: dto.paymentMethod,
          contractId: commission.contractId,
        },
      });
      // Fase 5: a baixa entra no fluxo de caixa e no DRE
      await tx.financialPayment.create({
        data: {
          workspaceId, entryId: entry.id, principal: receivedValue, total: receivedValue,
          paidAt: receivedAt, method: dto.paymentMethod ?? null, source: 'MANUAL',
        },
      });

      // Repasse aos corretores parceiros: gera as transações de split a partir
      // das regras ativas do contrato (% sobre a comissão recebida).
      const rules = await tx.splitRule.findMany({
        where: { contractId: commission.contractId, isActive: true },
      });
      for (const rule of rules) {
        const existing = await tx.splitTransaction.findFirst({
          where: { financialEntryId: entry.id, recipientId: rule.recipientId },
          select: { id: true },
        });
        if (existing) continue; // evita duplicar repasse
        const amount = rule.type === 'FIXED'
          ? Number(rule.value)
          : (Number(receivedValue) * Number(rule.value)) / 100;
        await tx.splitTransaction.create({
          data: {
            workspaceId,
            financialEntryId: entry.id,
            recipientId: rule.recipientId,
            amount,
            status: 'PENDING',
          },
        });
      }

      return updated;
    });

    // Emite o recibo e envia ao corretor. Sem await de propósito: o SMTP é
    // externo e não pode segurar a resposta do recebimento. Se o envio falhar,
    // fica registrado no log e o recibo continua disponível para download.
    this.emailCommissionReceipt(workspaceId, id).catch((e) => {
      console.error('[FinancialService] Erro ao enviar recibo de comissão por email:', e);
    });

    return result;
  }

  // HTML do recibo de uma comissão (visualização/download)
  async getCommissionReceipt(workspaceId: string, id: string): Promise<string> {
    return this.commissionReceipt.generateReceipt(workspaceId, id);
  }

  private async emailCommissionReceipt(workspaceId: string, commissionId: string) {
    const commission = await this.prisma.commission.findFirst({
      where: { id: commissionId, workspaceId },
      select: { userId: true },
    });
    if (!commission) return;

    const workspaceUser = await this.prisma.workspaceUser.findFirst({
      where: { id: commission.userId, workspaceId },
      include: { user: { select: { email: true } } },
    });
    if (!workspaceUser?.user?.email) return;

    const receiptHtml = await this.commissionReceipt.generateReceipt(workspaceId, commissionId);

    await this.emailService.sendEmail(workspaceId, {
      to: workspaceUser.user.email,
      subject: 'Recibo de comissão — recebimento confirmado',
      body: receiptHtml,
    });
  }

  // Compatibilidade: pagar = receber (mantém endpoint antigo funcionando)
  async payCommission(workspaceId: string, id: string) {
    return this.receiveCommission(workspaceId, id, {});
  }

  // Processa (ou reprocessa) os repasses de uma comissão já recebida.
  // Útil para comissões recebidas antes da geração automática de split.
  async processCommissionSplit(workspaceId: string, id: string) {
    const commission = await this.prisma.commission.findFirst({
      where: { id, workspaceId },
    });
    if (!commission) throw new NotFoundException('Comissão não encontrada');
    if (commission.status !== 'RECEIVED' && commission.status !== 'PAID') {
      throw new BadRequestException('Marque a comissão como recebida antes de processar o repasse.');
    }

    const rules = await this.prisma.splitRule.findMany({
      where: { contractId: commission.contractId, isActive: true },
    });
    if (rules.length === 0) {
      throw new BadRequestException('Este contrato não possui corretores parceiros para repasse.');
    }

    const base = Number(commission.receivedValue ?? commission.amount);
    // Vincula ao lançamento de comissão recebida, se existir
    const entry = await this.prisma.financialEntry.findFirst({
      where: { workspaceId, contractId: commission.contractId, category: 'COMMISSION', deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    let created = 0;
    for (const rule of rules) {
      const existing = await this.prisma.splitTransaction.findFirst({
        where: { workspaceId, recipientId: rule.recipientId, ...(entry ? { financialEntryId: entry.id } : {}) },
        select: { id: true },
      });
      if (existing) continue;
      const amount = rule.type === 'FIXED' ? Number(rule.value) : (base * Number(rule.value)) / 100;
      await this.prisma.splitTransaction.create({
        data: {
          workspaceId,
          financialEntryId: entry?.id,
          recipientId: rule.recipientId,
          amount,
          status: 'PENDING',
        },
      });
      created++;
    }

    return { processed: created, totalRules: rules.length };
  }
}
