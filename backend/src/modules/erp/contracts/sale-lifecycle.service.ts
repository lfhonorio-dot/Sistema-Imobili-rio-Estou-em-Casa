// Fase 4 — ciclo de vida do contrato de VENDA / INTERMEDIAÇÃO.
//
// ATIVAR (uma única transação; se qualquer passo falhar, nada é gravado):
//   1. contrato DRAFT → ACTIVE (com plano de comissão e forma de pagamento)
//   2. imóvel → VENDIDO
//   3. contas A RECEBER da comissão da imobiliária (uma por parcela)
//   4. contas A PAGAR de comissão: corretor vendedor, captador e parceiros,
//      proporcionais a cada parcela (o corretor recebe quando a imobiliária recebe)
//   5. eventos DIMOB da venda
//   6. checklist de pós-venda
//   + pagamento em espécie fica sinalizado para análise do responsável.
//
// RESCINDIR (também atômico; nada é apagado):
//   contas em aberto → canceladas com o motivo; contas já pagas → lançamento
//   de ESTORNO (oposto), pendente de decisão; imóvel volta a disponível;
//   DIMOB marcada como removida; checklist cancelado.

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { contractScope } from './contract-scope';
import { PrismaService } from '../../prisma/prisma.service';
import { IssuerService } from '../../issuer/issuer.service';
import { AuditService } from '../../audit/audit.service';
import { DimobService } from '../fiscal/dimob.service';
import { BillingService } from '../billing/billing.service';
import {
  BeneficiaryInput, buildSettlement, CASH_ATTENTION_THRESHOLD, DEFAULT_CHECKLIST, equalInstallments, InstallmentInput,
  SettlementPlan,
} from './sale-settlement';
import {
  ActivateSaleDto, AddChecklistItemDto, CashReviewDto, RescindSaleDto, UpdateChecklistItemDto,
} from './sale-lifecycle.dto';

const SALE_TYPES = ['SALE', 'BROKERAGE'];
const FINANCED = ['FINANCING', 'FGTS', 'MIXED'];

@Injectable()
export class SaleLifecycleService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private dimob: DimobService,
    private billing: BillingService,
    private issuer: IssuerService,
  ) {}

  private async loadSaleContract(workspaceId: string, id: string) {
    const c = await this.prisma.contract.findFirst({
      where: { id, workspaceId, deletedAt: null, AND: [await contractScope(this.prisma, workspaceId)] },
      include: {
        property: { select: { id: true, code: true, status: true } },
        splitRules: { where: { isActive: true }, include: { recipient: { select: { name: true, contactId: true } } } },
      },
    });
    if (!c) throw new NotFoundException('Contrato não encontrado.');
    if (!SALE_TYPES.includes(c.type)) throw new BadRequestException('Esta ação é só para contratos de venda ou intermediação.');
    return c;
  }

  private async member(workspaceId: string, id: string, label: string) {
    const m = await this.prisma.workspaceUser.findFirst({
      where: { id, workspaceId }, select: { id: true, user: { select: { name: true } } },
    });
    if (!m) throw new BadRequestException(`${label} não pertence a esta imobiliária.`);
    return m;
  }

  /** Monta (sem gravar) o plano de comissão. Usado pela prévia e pela ativação. */
  async buildPlan(workspaceId: string, id: string, dto: ActivateSaleDto) {
    const c = await this.loadSaleContract(workspaceId, id);
    const warnings: string[] = [];

    const commissionAmount = dto.commissionAmount ??
      (c.saleValue != null && c.commissionRate != null ? (Number(c.saleValue) * Number(c.commissionRate)) / 100 : null);
    if (!commissionAmount || commissionAmount <= 0) {
      throw new BadRequestException('Informe a comissão (valor ou taxa no contrato) antes de ativar a venda.');
    }

    const payerId = dto.commissionPayerId ?? c.ownerId;
    if (!payerId) throw new BadRequestException('Informe quem paga a comissão.');
    const payer = await this.prisma.contact.findFirst({
      where: { id: payerId, workspaceId, deletedAt: null }, select: { id: true, name: true },
    });
    if (!payer) throw new BadRequestException('Pagador da comissão não encontrado neste workspace.');

    let installments: InstallmentInput[];
    if (dto.installments?.length) {
      installments = dto.installments.map((i) => ({ dueDate: new Date(i.dueDate), amount: i.amount }));
    } else {
      const first = dto.firstDueDate ? new Date(dto.firstDueDate) : new Date();
      installments = equalInstallments(commissionAmount, dto.installmentsCount ?? 1, first);
    }

    // Captador padrão: o da autorização de venda vigente do imóvel
    let captorId = dto.captorBrokerId;
    if (captorId === undefined) {
      const auth = await this.prisma.propertyAuthorization.findFirst({
        where: { workspaceId, propertyId: c.propertyId, deletedAt: null, status: 'ACTIVE' },
        orderBy: { validUntil: 'desc' },
        select: { captorUserId: true },
      });
      captorId = auth?.captorUserId ?? undefined;
    }

    const beneficiaries: BeneficiaryInput[] = [];
    if (dto.sellerBrokerId && dto.sellerBrokerPct) {
      const m = await this.member(workspaceId, dto.sellerBrokerId, 'Corretor vendedor');
      beneficiaries.push({ kind: 'SELLER_BROKER', label: `corretor vendedor ${m.user.name}`, pct: dto.sellerBrokerPct, userId: m.id });
    }
    if (captorId && dto.captorBrokerPct) {
      const m = await this.member(workspaceId, captorId, 'Corretor captador');
      beneficiaries.push({ kind: 'CAPTOR', label: `captador ${m.user.name}`, pct: dto.captorBrokerPct, userId: m.id });
    } else if (captorId && !dto.captorBrokerPct) {
      warnings.push('O imóvel tem corretor captador, mas o percentual dele não foi informado (nada a pagar ao captador).');
    }
    for (const r of c.splitRules) {
      const pct = r.type === 'FIXED' ? (Number(r.value) / commissionAmount) * 100 : Number(r.value);
      beneficiaries.push({ kind: 'PARTNER', label: `parceiro ${r.recipient?.name ?? ''}`.trim(), pct, contactId: r.recipient?.contactId ?? null });
    }

    let plan: SettlementPlan;
    try {
      plan = buildSettlement({ commissionTotal: commissionAmount, installments, beneficiaries });
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    if (c.property.status === 'SOLD') warnings.push('O imóvel já está marcado como vendido.');
    if (dto.cashInvolved) {
      warnings.push(
        (dto.cashAmount ?? 0) >= CASH_ATTENTION_THRESHOLD
          ? `Pagamento em espécie de R$ ${(dto.cashAmount ?? 0).toLocaleString('pt-BR')} (a partir de R$ 100 mil): avalie com o responsável a comunicação ao COAF.`
          : 'Há pagamento em espécie: a venda ficará sinalizada para análise do responsável.',
      );
    }

    return { contract: c, payer, plan, warnings, captorId: captorId ?? null };
  }

  async preview(workspaceId: string, id: string, dto: ActivateSaleDto) {
    const { contract, payer, plan, warnings, captorId } = await this.buildPlan(workspaceId, id, dto);
    return {
      contractCode: contract.code,
      status: contract.status,
      payer,
      suggestedCaptorId: captorId,
      ...plan,
      warnings,
    };
  }

  async activate(workspaceId: string, userId: string, id: string, dto: ActivateSaleDto) {
    const { contract: c, payer, plan, warnings } = await this.buildPlan(workspaceId, id, dto);
    if (c.status !== 'DRAFT') throw new BadRequestException('Só é possível ativar um contrato em rascunho.');
    const code = c.code ?? c.id;
    const now = new Date();
    const eventDate = dto.eventDate ? new Date(dto.eventDate) : c.signedAt ?? now;
    const cashInvolved = !!dto.cashInvolved;
    if (cashInvolved && !(dto.cashAmount && dto.cashAmount > 0)) {
      throw new BadRequestException('Informe o valor pago em espécie.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. contrato: DRAFT → ACTIVE (condicional, evita ativação dupla em paralelo)
      const flip = await tx.contract.updateMany({
        where: { id, workspaceId, status: 'DRAFT', deletedAt: null },
        data: {
          status: 'ACTIVE',
          activatedAt: now,
          commissionAmount: plan.commissionTotal,
          commissionPayerId: payer.id,
          paymentMethod: dto.paymentMethod ?? c.paymentMethod,
          cashInvolved,
          cashAmount: cashInvolved ? dto.cashAmount : null,
          cashReviewStatus: cashInvolved ? 'PENDING_REVIEW' : null,
        },
      });
      if (flip.count !== 1) throw new ConflictException('Este contrato já foi ativado.');
      await this.issuer.freeze('contract', workspaceId, id, tx); // ativar = emitir

      // 2. imóvel → vendido (bloqueia se outro contrato já vendeu)
      const property = await tx.property.findFirst({ where: { id: c.propertyId, workspaceId, deletedAt: null } });
      if (!property) throw new BadRequestException('Imóvel do contrato não encontrado.');
      if (property.status === 'SOLD') throw new ConflictException('Este imóvel já está vendido por outro contrato.');
      await tx.property.update({ where: { id: c.propertyId }, data: { status: 'SOLD' } });
      await tx.propertyStatusHistory.create({
        data: { propertyId: c.propertyId, status: 'SOLD', userId, note: `Automático — venda ${code} ativada` },
      });

      // 3 e 4. comissão a receber (parcelas) e comissões a pagar
      const receivableIds = await this.createCommissionEntries(tx, workspaceId, c, code, payer.id, plan);

      // 5. DIMOB da venda (na mesma transação)
      await this.dimob.registerSaleEvents(workspaceId, c.id, { db: tx, commissionTotal: plan.commissionTotal, eventDate });

      // 6. checklist de pós-venda
      const me = await tx.workspaceUser.findFirst({ where: { workspaceId, userId }, select: { id: true } });
      const responsibleId = dto.sellerBrokerId ?? me?.id ?? null;
      const financed = FINANCED.includes(dto.paymentMethod ?? c.paymentMethod ?? '');
      await tx.contractChecklistItem.createMany({
        data: DEFAULT_CHECKLIST.map((item, i) => ({
          workspaceId, contractId: c.id, key: item.key, title: item.title, order: i,
          responsibleId,
          dueDate: new Date(now.getTime() + item.days * 86_400_000),
          status: item.financingOnly && !financed ? 'NOT_APPLICABLE' : 'PENDING',
        })),
      });

      return { receivables: receivableIds.length, payables: plan.payables.length };
    });

    await this.audit.log({
      workspaceId, userId, action: 'SALE_ACTIVATED', entity: 'Contract', entityId: id,
      after: { commission: plan.commissionTotal, installments: plan.receivables.length, cashInvolved },
    });
    return { activated: true, ...result, commissionTotal: plan.commissionTotal, agencyNet: plan.agencyNet, warnings };
  }

  /** Contas a receber (parcelas da comissão) e a pagar (corretores/parceiros), na transação. */
  private async createCommissionEntries(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    c: { id: string; propertyId: string },
    code: string,
    payerId: string,
    plan: SettlementPlan,
  ): Promise<string[]> {
    const receivableIds: string[] = [];
    for (const r of plan.receivables) {
      const e = await tx.financialEntry.create({
        data: {
          workspaceId, type: 'RECEIVABLE', category: 'COMMISSION',
          description: `Comissão de venda — ${code}${r.totalInstallments > 1 ? ` (parcela ${r.installment}/${r.totalInstallments})` : ''}`,
          amount: r.amount, dueDate: r.dueDate, status: 'PENDING',
          contractId: c.id, propertyId: c.propertyId, contactId: payerId,
          installment: r.installment, totalInstallments: r.totalInstallments,
        },
        select: { id: true },
      });
      receivableIds.push(e.id);
    }
    for (const p of plan.payables) {
      await tx.financialEntry.create({
        data: {
          workspaceId, type: 'PAYABLE', category: 'COMMISSION',
          description: `Comissão do ${p.label} — ${code}${p.totalInstallments > 1 ? ` (parcela ${p.installment}/${p.totalInstallments})` : ''}`,
          amount: p.amount, dueDate: p.dueDate, status: 'PENDING',
          contractId: c.id, propertyId: c.propertyId,
          contactId: p.contactId ?? undefined,
          beneficiaryUserId: p.userId ?? undefined,
          sourceEntryId: receivableIds[p.installment - 1],
          installment: p.installment, totalInstallments: p.totalInstallments,
          notes: 'Pagar depois do recebimento da parcela de comissão correspondente.',
        },
      });
    }
    return receivableIds;
  }

  // ── Fase 5: vendas antigas (ativadas antes da Fase 4) ─────────────

  /**
   * Diagnóstico das vendas ATIVAS criadas pelo sistema antigo: não têm data
   * de ativação nem plano de comissão no financeiro. A migration da Fase 5 já
   * cancelou (com motivo) o "a receber" com o valor do imóvel; aqui o dono vê
   * o que falta lançar.
   */
  async legacyDiagnostic(workspaceId: string) {
    const contracts = await this.prisma.contract.findMany({
      where: { workspaceId, deletedAt: null, type: { in: SALE_TYPES }, status: 'ACTIVE', activatedAt: null },
      select: {
        id: true, code: true, type: true, saleValue: true, commissionRate: true, commissionAmount: true, createdAt: true, ownerId: true,
        property: { select: { code: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const out = [];
    for (const c of contracts) {
      const [commissionEntries, legacyCommissions, fixedSaleEntries] = await Promise.all([
        this.prisma.financialEntry.count({
          where: { workspaceId, contractId: c.id, deletedAt: null, type: 'RECEIVABLE', category: 'COMMISSION', status: { not: 'CANCELLED' } },
        }),
        this.prisma.commission.findMany({ where: { workspaceId, contractId: c.id }, select: { status: true, amount: true } }),
        this.prisma.financialEntry.count({
          where: { workspaceId, contractId: c.id, cancelReason: { startsWith: 'Correção automática (Fase 5)' } },
        }),
      ]);
      const suggested = c.saleValue != null && c.commissionRate != null ? Math.round(Number(c.saleValue) * Number(c.commissionRate)) / 100 : null;
      out.push({
        id: c.id, code: c.code, type: c.type, propertyCode: c.property?.code ?? null, createdAt: c.createdAt,
        saleValue: c.saleValue != null ? Number(c.saleValue) : null,
        suggestedCommission: suggested,
        commissionEntries,
        legacyCommissions: legacyCommissions.map((l) => ({ status: l.status, amount: Number(l.amount) })),
        cancelledPropertyValueEntries: fixedSaleEntries,
        needsRegularization: commissionEntries === 0 && c.commissionAmount == null,
      });
    }
    return out;
  }

  /**
   * Lança o plano de comissão (a receber + a pagar) de uma venda antiga já
   * ativa, numa transação. Não mexe no imóvel, na DIMOB nem na data da venda.
   * Comissões pendentes do modelo antigo são canceladas (substituídas).
   */
  async regularizeLegacy(workspaceId: string, userId: string, id: string, dto: ActivateSaleDto) {
    const { contract: c, payer, plan, warnings } = await this.buildPlan(workspaceId, id, dto);
    if (c.status !== 'ACTIVE' || c.activatedAt) {
      throw new BadRequestException('A regularização é só para vendas antigas (ativas antes do novo fluxo).');
    }
    const existing = await this.prisma.financialEntry.count({
      where: { workspaceId, contractId: id, deletedAt: null, type: 'RECEIVABLE', category: 'COMMISSION', status: { not: 'CANCELLED' } },
    });
    if (existing > 0) throw new ConflictException('Esta venda já tem comissão lançada no financeiro.');
    const code = c.code ?? c.id;

    const result = await this.prisma.$transaction(async (tx) => {
      const flip = await tx.contract.updateMany({
        where: { id, workspaceId, status: 'ACTIVE', activatedAt: null, commissionAmount: null, deletedAt: null },
        data: { commissionAmount: plan.commissionTotal, commissionPayerId: payer.id, ...(dto.paymentMethod && { paymentMethod: dto.paymentMethod }) },
      });
      if (flip.count !== 1) throw new ConflictException('Esta venda já foi regularizada.');
      const receivableIds = await this.createCommissionEntries(tx, workspaceId, c, code, payer.id, plan);
      const replaced = await tx.commission.updateMany({
        where: { workspaceId, contractId: id, status: 'PENDING' },
        data: { status: 'CANCELLED', notes: 'Substituída pelo plano de comissão lançado no financeiro (Fase 5).' },
      });
      return { receivables: receivableIds.length, payables: plan.payables.length, legacyCommissionsReplaced: replaced.count };
    });

    await this.audit.log({
      workspaceId, userId, action: 'SALE_LEGACY_REGULARIZED', entity: 'Contract', entityId: id,
      after: { commission: plan.commissionTotal, installments: plan.receivables.length },
    });
    return { regularized: true, ...result, commissionTotal: plan.commissionTotal, warnings };
  }

  async rescind(workspaceId: string, userId: string, id: string, dto: RescindSaleDto) {
    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('Informe o motivo da rescisão.');
    const c = await this.loadSaleContract(workspaceId, id);
    if (c.status !== 'ACTIVE') throw new BadRequestException('Só é possível rescindir uma venda ativa.');
    const code = c.code ?? c.id;
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const flip = await tx.contract.updateMany({
        where: { id, workspaceId, status: 'ACTIVE' },
        data: { status: 'RESCINDED', rescindedAt: now, rescissionReason: reason },
      });
      if (flip.count !== 1) throw new ConflictException('Este contrato já não está ativo.');

      // imóvel volta a disponível (se nenhum outro contrato ativo o mantém vendido)
      const other = await tx.contract.findFirst({
        where: { workspaceId, propertyId: c.propertyId, status: 'ACTIVE', deletedAt: null, id: { not: id } },
        select: { id: true },
      });
      const property = await tx.property.findFirst({ where: { id: c.propertyId } });
      if (!other && property?.status === 'SOLD') {
        await tx.property.update({ where: { id: c.propertyId }, data: { status: 'AVAILABLE' } });
        await tx.propertyStatusHistory.create({
          data: { propertyId: c.propertyId, status: 'AVAILABLE', userId, note: `Automático — venda ${code} rescindida` },
        });
      }

      // lançamentos do contrato: abertos → cancelados; pagos → estorno
      const entries = await tx.financialEntry.findMany({ where: { workspaceId, contractId: id, deletedAt: null } });
      let cancelled = 0;
      let reversals = 0;
      for (const e of entries) {
        const partial = (e.status === 'PENDING' || e.status === 'OVERDUE') && Number(e.paidAmount ?? 0) > 0;
        if (e.status === 'PENDING' || e.status === 'OVERDUE') {
          await tx.financialEntry.update({
            where: { id: e.id },
            data: { status: 'CANCELLED', cancelledAt: now, cancelReason: `Rescisão da venda ${code}: ${reason}` },
          });
          cancelled++;
        }
        // pago (total ou parcial, Fase 5) → estorno do que já foi baixado
        if ((e.status === 'PAID' || partial) && !e.description.startsWith('Estorno')) {
          await tx.financialEntry.create({
            data: {
              workspaceId,
              type: e.type === 'RECEIVABLE' ? 'PAYABLE' : 'RECEIVABLE',
              category: e.category,
              description: `Estorno — ${e.description}`,
              amount: e.paidAmount ?? e.amount,
              dueDate: now,
              status: 'PENDING',
              contractId: id, propertyId: e.propertyId, contactId: e.contactId,
              beneficiaryUserId: e.beneficiaryUserId, sourceEntryId: e.id,
              notes: `Estorno gerado pela rescisão (${reason}). Se não houver devolução de valores, cancele este lançamento informando o motivo.`,
            },
          });
          reversals++;
        }
      }

      // comissões do modelo antigo ainda pendentes
      await tx.commission.updateMany({ where: { workspaceId, contractId: id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
      // checklist
      await tx.contractChecklistItem.updateMany({
        where: { workspaceId, contractId: id, status: 'PENDING', deletedAt: null },
        data: { status: 'CANCELLED', notes: `Cancelado pela rescisão: ${reason}` },
      });
      // DIMOB marcada como removida (não apagada)
      await this.dimob.removeContractEvents(workspaceId, id, tx);

      return { cancelled, reversals };
    });

    // Fase 5: boletos/PIX em aberto são cancelados também no Asaas.
    // Se o banco recusar, a rescisão continua válida e o aviso diz o que falta.
    const charges = await this.prisma.boleto.findMany({
      where: { workspaceId, contractId: id, deletedAt: null, status: { in: ['PENDING', 'REGISTERED', 'SENT', 'OVERDUE'] } },
      select: { id: true, kind: true },
    });
    const warnings: string[] = [];
    let chargesCancelled = 0;
    for (const ch of charges) {
      try {
        await this.billing.cancelCharge(workspaceId, ch.id, `Rescisão da venda ${code}: ${reason}`, userId);
        chargesCancelled++;
      } catch (err) {
        warnings.push(`Não foi possível cancelar ${ch.kind === 'PIX' ? 'a cobrança PIX' : 'o boleto'} no Asaas (${(err as Error).message}). Cancele manualmente para o pagador não pagar.`);
      }
    }

    await this.audit.log({ workspaceId, userId, action: 'SALE_RESCINDED', entity: 'Contract', entityId: id, after: { reason, ...result } });
    return { rescinded: true, ...result, chargesCancelled, warnings };
  }

  async reviewCash(workspaceId: string, userId: string, id: string, dto: CashReviewDto) {
    const c = await this.loadSaleContract(workspaceId, id);
    if (!c.cashInvolved || c.cashReviewStatus !== 'PENDING_REVIEW') {
      throw new BadRequestException('Este contrato não tem pagamento em espécie aguardando análise.');
    }
    if (!dto.note?.trim()) throw new BadRequestException('Registre a conclusão da análise.');
    const me = await this.prisma.workspaceUser.findFirst({ where: { workspaceId, userId }, select: { id: true } });
    const updated = await this.prisma.contract.update({
      where: { id },
      data: { cashReviewStatus: 'REVIEWED', cashReviewNote: dto.note.trim(), cashReviewedById: me?.id, cashReviewedAt: new Date() },
      select: { id: true, cashReviewStatus: true, cashReviewNote: true, cashReviewedAt: true },
    });
    await this.audit.log({ workspaceId, userId, action: 'SALE_CASH_REVIEWED', entity: 'Contract', entityId: id });
    return updated;
  }

  // ── Checklist de pós-venda ────────────────────────────────────────────

  async listChecklist(workspaceId: string, contractId: string) {
    await this.loadSaleContract(workspaceId, contractId);
    const items = await this.prisma.contractChecklistItem.findMany({
      where: { workspaceId, contractId, deletedAt: null },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    const ids = [...new Set(items.flatMap((i) => [i.responsibleId, i.doneById]).filter((v): v is string => !!v))];
    const members = ids.length
      ? await this.prisma.workspaceUser.findMany({ where: { workspaceId, id: { in: ids } }, select: { id: true, user: { select: { name: true } } } })
      : [];
    const name = new Map(members.map((m) => [m.id, m.user.name]));
    const now = Date.now();
    return items.map((i) => ({
      ...i,
      responsibleName: i.responsibleId ? name.get(i.responsibleId) ?? null : null,
      doneByName: i.doneById ? name.get(i.doneById) ?? null : null,
      overdue: i.status === 'PENDING' && !!i.dueDate && i.dueDate.getTime() < now,
    }));
  }

  async updateChecklistItem(workspaceId: string, userId: string, contractId: string, itemId: string, dto: UpdateChecklistItemDto) {
    const item = await this.prisma.contractChecklistItem.findFirst({
      where: { id: itemId, workspaceId, contractId, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Item do checklist não encontrado.');
    if (item.status === 'CANCELLED') throw new BadRequestException('Item cancelado pela rescisão.');
    if (dto.responsibleId) await this.member(workspaceId, dto.responsibleId, 'Responsável');
    const me = await this.prisma.workspaceUser.findFirst({ where: { workspaceId, userId }, select: { id: true } });
    const data: Prisma.ContractChecklistItemUpdateInput = {
      ...(dto.status && { status: dto.status }),
      ...(dto.status === 'DONE' && { doneAt: new Date(), doneById: me?.id ?? null }),
      ...(dto.status && dto.status !== 'DONE' && { doneAt: null, doneById: null }),
      ...(dto.responsibleId !== undefined && { responsibleId: dto.responsibleId }),
      ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    };
    return this.prisma.contractChecklistItem.update({ where: { id: itemId }, data });
  }

  async addChecklistItem(workspaceId: string, contractId: string, dto: AddChecklistItemDto) {
    const c = await this.loadSaleContract(workspaceId, contractId);
    if (c.status !== 'ACTIVE') throw new BadRequestException('O checklist só existe para vendas ativas.');
    if (dto.responsibleId) await this.member(workspaceId, dto.responsibleId, 'Responsável');
    const count = await this.prisma.contractChecklistItem.count({ where: { workspaceId, contractId } });
    return this.prisma.contractChecklistItem.create({
      data: {
        workspaceId, contractId, key: 'CUSTOM', title: dto.title.trim(), order: count,
        responsibleId: dto.responsibleId, dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
    });
  }
}
