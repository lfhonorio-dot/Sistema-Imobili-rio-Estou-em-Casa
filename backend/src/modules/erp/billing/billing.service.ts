// Serviço de Cobranças — boleto e PIX (Asaas), CNAB e gateways.
//
// Fase 5:
//  • Em cada conta a receber o usuário escolhe BOLETO ou PIX (QR Code +
//    copia-e-cola). Sem gateway Asaas ativo, a emissão é recusada (sem simulação).
//  • Cancelar ou reemitir cancela PRIMEIRO no Asaas; se o Asaas recusar, nada
//    muda aqui. A cobrança cancelada fica no histórico (entryRef) e libera o
//    lançamento para uma nova cobrança.
//  • Baixa automática pelo webhook: token validado em tempo constante,
//    evento registrado uma única vez (idempotência) e baixa na mesma transação.
//  • Envio ao pagador por e-mail e WhatsApp; falha de envio vira erro visível.
import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AsaasClient, AsaasCredentials } from './asaas.client';
import { PaymentsService } from '../financial/payments.service';
import { splitGatewayAmount, toCents } from '../financial/settlement-math';
import { EmailService } from '../../hub/email/email.service';
import { WhatsAppService } from '../../hub/whatsapp/whatsapp.service';
import { IssuerService } from '../../issuer/issuer.service';
import { asSnapshot, displayName } from '../../issuer/issuer.types';
import {
  CreateGatewayConfigDto, GenerateBoletoDto, BoletoQueryDto,
  UploadCnabDto, GenerateCnabRemessaDto,
} from './billing.dto';

type Tx = Prisma.TransactionClient;

export const BOLETO_UNAVAILABLE_MESSAGE =
  'Emissão de boleto/PIX não disponível: nenhum gateway de pagamento Asaas ativo está configurado. ' +
  'Cadastre o Asaas em Configurações → Boletos e PIX, ou registre o recebimento manualmente.';

const ACTIVE_CHARGE = { notIn: ['CANCELLED', 'PAID', 'REFUNDED'] };
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dmy = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** Telefone em formato internacional para o WhatsApp (Brasil por padrão). */
export function whatsappNumber(phone: string | null | undefined): string | null {
  const d = (phone ?? '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.length >= 12 && d.length <= 13 && d.startsWith('55')) return d;
  return null;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private prisma: PrismaService,
    private asaas: AsaasClient,
    private payments?: PaymentsService,
    private email?: EmailService,
    private whatsapp?: WhatsAppService,
    private issuer?: IssuerService,
  ) {}

  /** Id do registro de dados da empresa vigente (null sem o serviço — testes unitários). */
  private async currentLegalEntityId(workspaceId: string): Promise<string | null> {
    return this.issuer ? (await this.issuer.getCurrent(workspaceId)).id : null;
  }

  /** Conta do gateway pertence ao CNPJ vigente? (contas sem dono contam como vigentes) */
  private async isCurrentEntityGateway(workspaceId: string, g: { legalEntityId: string | null }) {
    const cur = await this.currentLegalEntityId(workspaceId);
    return !cur || !g.legalEntityId || g.legalEntityId === cur;
  }

  // ── CONFIGURAÇÃO DE GATEWAY ──────────────────────────────

  async getGateways(workspaceId: string) {
    const list = await this.prisma.paymentGatewayConfig.findMany({
      where: { workspaceId, deletedAt: null },
      select: {
        id: true, provider: true, name: true, environment: true,
        isActive: true, isDefault: true, createdAt: true, webhookSecret: true, metadata: true, legalEntityId: true,
      },
    });
    const cur = await this.currentLegalEntityId(workspaceId);
    return list.map(({ webhookSecret, metadata, ...g }) => ({
      ...g,
      // conta de um CNPJ anterior: só baixa/cancela cobranças antigas
      previousCnpj: !!cur && !!g.legalEntityId && g.legalEntityId !== cur,
      hasWebhookToken: !!webhookSecret,
      webhookPath: `/billing/webhook/${workspaceId}`,
      settlementBankAccountId: ((metadata ?? {}) as Record<string, unknown>).settlementBankAccountId ?? null,
    }));
  }

  private async assertBankAccount(workspaceId: string, id?: string | null) {
    if (!id) return;
    const acc = await this.prisma.bankAccount.findFirst({ where: { id, workspaceId, deletedAt: null }, select: { id: true } });
    if (!acc) throw new BadRequestException('Conta bancária não encontrada neste workspace.');
  }

  async createGateway(workspaceId: string, dto: CreateGatewayConfigDto) {
    // uma conta por provedor POR CNPJ: depois de trocar o CNPJ, a conta antiga
    // continua guardada (para baixar/cancelar cobranças antigas) e a nova é cadastrada ao lado
    const legalEntityId = await this.currentLegalEntityId(workspaceId);
    const existing = await this.prisma.paymentGatewayConfig.findFirst({
      where: {
        workspaceId, provider: dto.provider, deletedAt: null,
        ...(legalEntityId && { OR: [{ legalEntityId }, { legalEntityId: null }] }),
      },
    });
    if (existing) throw new BadRequestException(`Gateway ${dto.provider} já configurado`);
    await this.assertBankAccount(workspaceId, dto.settlementBankAccountId);

    if (dto.isDefault) {
      await this.prisma.paymentGatewayConfig.updateMany({
        where: { workspaceId }, data: { isDefault: false },
      });
    }
    const { settlementBankAccountId, ...rest } = dto;
    const created = await this.prisma.paymentGatewayConfig.create({
      data: {
        workspaceId, ...rest, legalEntityId,
        apiKey: this.asaas.encryptApiKey(dto.apiKey),
        apiSecret: dto.apiSecret ? this.asaas.encryptApiKey(dto.apiSecret) : undefined,
        metadata: settlementBankAccountId ? { settlementBankAccountId } : {},
      },
      select: { id: true },
    });
    return (await this.getGateways(workspaceId)).find((g) => g.id === created.id);
  }

  async updateGateway(workspaceId: string, id: string, dto: Partial<CreateGatewayConfigDto>) {
    const gw = await this.getGatewayOrThrow(workspaceId, id);
    if (dto.isDefault && !(await this.isCurrentEntityGateway(workspaceId, gw))) {
      throw new BadRequestException('Esta conta é do CNPJ anterior: ela fica guardada só para baixar e cancelar as cobranças antigas e não pode voltar a ser a padrão.');
    }
    await this.assertBankAccount(workspaceId, dto.settlementBankAccountId);
    const { settlementBankAccountId, ...rest } = dto;
    const data: Record<string, unknown> = { ...rest };
    if (dto.apiKey) data.apiKey = this.asaas.encryptApiKey(dto.apiKey);
    else delete data.apiKey;
    if (dto.apiSecret) data.apiSecret = this.asaas.encryptApiKey(dto.apiSecret);
    if (settlementBankAccountId !== undefined) {
      data.metadata = { ...((gw.metadata ?? {}) as object), settlementBankAccountId: settlementBankAccountId || null };
    }
    if (dto.isDefault) {
      await this.prisma.paymentGatewayConfig.updateMany({
        where: { workspaceId }, data: { isDefault: false },
      });
    }
    await this.prisma.paymentGatewayConfig.update({ where: { id }, data });
    return (await this.getGateways(workspaceId)).find((g) => g.id === id);
  }

  async deleteGateway(workspaceId: string, id: string) {
    await this.getGatewayOrThrow(workspaceId, id);
    const active = await this.prisma.boleto.count({ where: { workspaceId, gatewayId: id, deletedAt: null, status: ACTIVE_CHARGE } });
    if (active) {
      throw new BadRequestException(`Há ${active} cobrança(s) em aberto neste gateway. Cancele-as antes de remover o gateway.`);
    }
    await this.prisma.paymentGatewayConfig.update({
      where: { id }, data: { deletedAt: new Date() },
    });
    return { message: 'Gateway removido com sucesso' };
  }

  /** Gera um novo token do webhook. Ele é mostrado uma vez para colar no Asaas. */
  async rotateWebhookToken(workspaceId: string, id: string) {
    await this.getGatewayOrThrow(workspaceId, id);
    const token = crypto.randomBytes(24).toString('hex');
    await this.prisma.paymentGatewayConfig.update({ where: { id }, data: { webhookSecret: token } });
    return { webhookToken: token, webhookPath: `/billing/webhook/${workspaceId}` };
  }

  /** Testa a chave de API chamando o Asaas (erro do gateway é mostrado ao usuário). */
  async testGateway(workspaceId: string, id: string) {
    const gw = await this.getGatewayOrThrow(workspaceId, id);
    if (gw.provider !== 'ASAAS') throw new BadRequestException('Só o Asaas tem integração disponível.');
    await this.asaas.ping(this.creds(gw));
    return { ok: true, environment: gw.environment };
  }

  // ── COBRANÇAS (BOLETO / PIX) ──────────────────────────────

  async findBoletos(workspaceId: string, query: BoletoQueryDto) {
    const { page = 1, limit = 20, status, contractId, entryId, kind } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.BoletoWhereInput = {
      workspaceId, deletedAt: null,
      ...(status && { status }),
      ...(kind && { kind }),
      ...(contractId && { contractId }),
      ...(entryId && { entryRef: entryId }),
    };
    const [items, total] = await Promise.all([
      this.prisma.boleto.findMany({
        where, skip, take: limit, orderBy: [{ createdAt: 'desc' }],
      }),
      this.prisma.boleto.count({ where }),
    ]);
    const contactIds = [...new Set(items.map((b) => b.contactId).filter((v): v is string => !!v))];
    const contacts = contactIds.length
      ? await this.prisma.contact.findMany({ where: { workspaceId, id: { in: contactIds } }, select: { id: true, name: true } })
      : [];
    const byId = new Map(contacts.map((c) => [c.id, c.name]));
    return {
      items: items.map((b) => ({ ...b, contactName: b.contactId ? byId.get(b.contactId) ?? null : null })),
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async findOneBoleto(workspaceId: string, id: string) {
    const boleto = await this.prisma.boleto.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!boleto) throw new NotFoundException('Cobrança não encontrada');
    return boleto;
  }

  private creds(gateway: { apiKey: string; environment: string }): AsaasCredentials {
    return { apiKey: this.asaas.decryptApiKey(gateway.apiKey), environment: gateway.environment };
  }

  private async activeAsaasGateway(workspaceId: string, gatewayId?: string) {
    // cobrança nova só sai pela conta do CNPJ vigente (o beneficiário do boleto é a empresa)
    const legalEntityId = await this.currentLegalEntityId(workspaceId);
    const gateway = gatewayId
      ? await this.getGatewayOrThrow(workspaceId, gatewayId)
      : await this.prisma.paymentGatewayConfig.findFirst({
          where: {
            workspaceId, provider: 'ASAAS', isActive: true, deletedAt: null,
            ...(legalEntityId && { OR: [{ legalEntityId }, { legalEntityId: null }] }),
          },
          orderBy: { isDefault: 'desc' },
        });
    if (gateway && !(await this.isCurrentEntityGateway(workspaceId, gateway))) {
      throw new BadRequestException('Esta conta de cobrança é do CNPJ anterior. Cadastre a conta Asaas do novo CNPJ em Financeiro → Boletos e PIX.');
    }
    if (!gateway && legalEntityId) {
      const old = await this.prisma.paymentGatewayConfig.findFirst({
        where: { workspaceId, provider: 'ASAAS', isActive: true, deletedAt: null, legalEntityId: { not: legalEntityId } },
        select: { id: true },
      });
      if (old) throw new BadRequestException('O CNPJ da empresa mudou e a conta Asaas cadastrada é do CNPJ anterior. Cadastre a conta Asaas do novo CNPJ em Financeiro → Boletos e PIX para emitir novas cobranças.');
    }
    // Só o Asaas tem emissão real implementada. Sem ele, recusa com mensagem clara.
    if (!gateway || gateway.provider !== 'ASAAS' || !gateway.isActive) {
      throw new BadRequestException(BOLETO_UNAVAILABLE_MESSAGE);
    }
    return gateway;
  }

  /** Compatibilidade: POST /billing/boletos (kind padrão = BOLETO). */
  generateBoleto(workspaceId: string, dto: GenerateBoletoDto) {
    return this.generateCharge(workspaceId, dto);
  }

  /** Emite boleto ou PIX para uma conta a receber. */
  async generateCharge(workspaceId: string, dto: GenerateBoletoDto) {
    const gateway = await this.activeAsaasGateway(workspaceId, dto.gatewayId);
    const kind = dto.kind === 'PIX' ? 'PIX' : 'BOLETO';

    if (!dto.financialEntryId) {
      throw new BadRequestException('Escolha a conta a receber que será cobrada.');
    }
    const entry = await this.prisma.financialEntry.findFirst({
      where: { id: dto.financialEntryId, workspaceId, deletedAt: null },
    });
    if (!entry) throw new BadRequestException('Lançamento financeiro não encontrado.');
    if (entry.type !== 'RECEIVABLE') throw new BadRequestException('Boleto e PIX são só para contas a receber.');
    if (!['PENDING', 'OVERDUE'].includes(entry.status)) throw new BadRequestException('Esta conta não está em aberto.');
    const amount = PaymentsService.openAmount(entry);
    if (toCents(amount) <= 0) throw new BadRequestException('Esta conta não tem saldo em aberto.');

    const existing = await this.prisma.boleto.findFirst({
      where: { workspaceId, financialEntryId: entry.id, deletedAt: null, status: ACTIVE_CHARGE },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Esta conta já tem uma cobrança ativa. Cancele ou reemita a cobrança existente.');
    }

    const today = new Date().toISOString().slice(0, 10);
    const dueDateOnly = (dto.dueDate ?? entry.dueDate.toISOString()).slice(0, 10);
    if (dueDateOnly < today) {
      throw new BadRequestException('O vencimento desta conta já passou: informe uma nova data de vencimento para a cobrança.');
    }

    const contactId = dto.contactId ?? entry.contactId;
    if (!contactId) throw new BadRequestException('Informe o pagador (contato) na conta a receber antes de emitir a cobrança.');
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, workspaceId, deletedAt: null },
      select: { name: true, cpf: true, cnpj: true, email: true },
    });
    if (!contact) throw new BadRequestException('Pagador não encontrado neste workspace.');
    if (!(contact.cpf || contact.cnpj)) {
      throw new BadRequestException('O pagador precisa ter CPF/CNPJ cadastrado para emissão bancária.');
    }

    const creds = this.creds(gateway);
    const customerId = await this.asaas.ensureCustomer(creds, {
      name: contact.name,
      cpfCnpj: (contact.cpf ?? contact.cnpj) as string,
      email: contact.email,
    });

    // Split bancário na cobrança: recebedores com walletId Asaas cadastrado
    let split: { walletId: string; percentualValue: number }[] | undefined;
    const contractId = entry.contractId ?? undefined;
    if (contractId) {
      const rules = await this.prisma.splitRule.findMany({
        where: { workspaceId, contractId, isActive: true },
        include: { recipient: { select: { gatewayRecipientId: true } } },
      });
      const withWallet = rules.filter((r) => r.recipient?.gatewayRecipientId && r.type !== 'FIXED');
      if (withWallet.length) {
        split = withWallet.map((r) => ({
          walletId: r.recipient!.gatewayRecipientId as string,
          percentualValue: Number(r.value),
        }));
      }
    }

    const settings = await this.prisma.workspaceFinancialSettings.findUnique({ where: { workspaceId } });
    const fine = dto.fine ?? Number(settings?.finePct ?? 2);
    const interest = dto.interest ?? Number(settings?.interestMonthlyPct ?? 1);
    const description = dto.description ?? entry.description;

    const issued = await this.asaas.createPayment(creds, {
      billingType: kind,
      customerId,
      value: amount,
      dueDate: dueDateOnly,
      description,
      externalReference: `entry-${entry.id}-${Date.now()}`,
      fine,
      interest,
      split,
    });

    try {
      const issuerSnapshot = this.issuer ? await this.issuer.getCurrentSnapshot(workspaceId) : null;
      const boleto = await this.prisma.boleto.create({
        data: {
          workspaceId,
          ...(issuerSnapshot && { issuerSnapshot: issuerSnapshot as unknown as Prisma.InputJsonValue }),
          gatewayId: gateway.id,
          gatewayBoletoId: issued.paymentId,
          financialEntryId: entry.id,
          entryRef: entry.id,
          kind,
          contractId,
          contactId,
          amount,
          dueDate: new Date(`${dueDateOnly}T12:00:00Z`),
          description,
          nossoNumero: issued.nossoNumero,
          linhaDigitavel: issued.linhaDigitavel ?? null,
          codigoBarras: issued.codigoBarras ?? null,
          pixQrCode: issued.pixQrCode ?? null,
          pixCopiaECola: issued.pixCopiaECola ?? null,
          bankSlipUrl: issued.bankSlipUrl ?? issued.invoiceUrl,
          fine,
          interest,
          discount: dto.discount ?? 0.0,
          instructions: dto.instructions,
          status: 'REGISTERED',
          registeredAt: new Date(),
        },
      });
      this.logger.log(`Cobrança ${kind} emitida: ${boleto.id} gw=${issued.paymentId}`);
      return boleto;
    } catch (err) {
      // outra cobrança foi criada em paralelo: desfaz esta no gateway
      await this.asaas.cancelPayment(creds, issued.paymentId).catch(() => undefined);
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('Esta conta já tem uma cobrança ativa (emitida agora há pouco).');
      }
      throw err;
    }
  }

  /** true quando existe gateway Asaas ativo — o único com emissão real. */
  async hasActiveBoletoGateway(workspaceId: string): Promise<boolean> {
    const gw = await this.prisma.paymentGatewayConfig.findFirst({
      where: { workspaceId, provider: 'ASAAS', isActive: true, deletedAt: null },
      select: { id: true },
    });
    return !!gw;
  }

  /**
   * Cancela a cobrança: PRIMEIRO no Asaas (o pagador não consegue mais pagar),
   * depois aqui. Se o Asaas recusar, o erro é mostrado e nada muda.
   */
  async cancelCharge(workspaceId: string, id: string, reason: string, userId?: string) {
    const why = reason?.trim();
    if (!why) throw new BadRequestException('Informe o motivo do cancelamento.');
    const boleto = await this.findOneBoleto(workspaceId, id);
    if (boleto.status === 'PAID') throw new BadRequestException('Esta cobrança já foi paga. Para devolver o dinheiro, faça o estorno pelo Asaas.');
    if (boleto.status === 'CANCELLED') throw new BadRequestException('Esta cobrança já está cancelada.');

    if (boleto.gatewayBoletoId) {
      const gateway = boleto.gatewayId
        ? await this.prisma.paymentGatewayConfig.findFirst({ where: { id: boleto.gatewayId, workspaceId } })
        : null;
      if (!gateway) {
        throw new BadRequestException('O gateway desta cobrança não está mais configurado: cancele-a manualmente no Asaas.');
      }
      await this.asaas.cancelPayment(this.creds(gateway), boleto.gatewayBoletoId);
    }

    await this.prisma.boleto.update({
      where: { id },
      data: {
        status: 'CANCELLED', cancelledAt: new Date(), cancelReason: why,
        financialEntryId: null, entryRef: boleto.entryRef ?? boleto.financialEntryId,
      },
    });
    this.logger.log(`Cobrança ${id} cancelada${userId ? ` por ${userId}` : ''}`);
    return this.findOneBoleto(workspaceId, id);
  }

  /** Reemite: cancela a cobrança atual no Asaas e emite outra (nova data e/ou outro tipo). */
  async reissueBoleto(workspaceId: string, id: string, newDueDate: string, kind?: 'BOLETO' | 'PIX', userId?: string) {
    const boleto = await this.findOneBoleto(workspaceId, id);
    if (boleto.status === 'PAID') throw new BadRequestException('Cobrança já está paga');
    if (!newDueDate) throw new BadRequestException('Informe o novo vencimento.');
    if (newDueDate.slice(0, 10) < new Date().toISOString().slice(0, 10)) {
      throw new BadRequestException('O novo vencimento não pode ser no passado.');
    }
    // Sem gateway não há como emitir a nova: não cancela a atual à toa.
    if (!(await this.hasActiveBoletoGateway(workspaceId))) {
      throw new BadRequestException(BOLETO_UNAVAILABLE_MESSAGE);
    }
    const entryId = boleto.entryRef ?? boleto.financialEntryId;
    if (!entryId) throw new BadRequestException('Esta cobrança não está ligada a uma conta a receber; emita uma nova pela conta.');

    if (boleto.status !== 'CANCELLED') {
      await this.cancelCharge(workspaceId, id, `Reemitida com vencimento ${newDueDate.slice(0, 10)}`, userId);
    }
    try {
      return await this.generateCharge(workspaceId, {
        financialEntryId: entryId,
        gatewayId: boleto.gatewayId ?? undefined,
        dueDate: newDueDate,
        kind: kind ?? (boleto.kind as 'BOLETO' | 'PIX'),
        description: boleto.description ?? undefined,
        instructions: boleto.instructions ?? undefined,
      });
    } catch (err) {
      const msg = (err as Error).message;
      throw new BadRequestException(`A cobrança anterior foi cancelada, mas a nova não pôde ser emitida: ${msg}`);
    }
  }

  /**
   * Endpoint manual antigo. Cobranças do Asaas têm baixa automática pelo
   * webhook; confirmar "na mão" aqui criaria baixa sem o banco confirmar.
   */
  async confirmPayment(workspaceId: string, id: string, paidAmount?: number) {
    const boleto = await this.findOneBoleto(workspaceId, id);
    if (boleto.status === 'PAID') throw new BadRequestException('Cobrança já está paga');
    if (boleto.gatewayBoletoId) {
      throw new BadRequestException(
        'A baixa de boleto/PIX do Asaas é automática (o banco avisa o sistema). Se o pagador pagou por outro meio, ' +
        'cancele a cobrança e registre o recebimento manual na conta a receber.',
      );
    }
    await this.settleChargeStandalone(workspaceId, id, paidAmount ?? Number(boleto.amount), 'MANUAL');
    return { message: 'Pagamento confirmado' };
  }

  private async settleChargeStandalone(workspaceId: string, boletoId: string, received: number, origin: string) {
    await this.prisma.$transaction(async (tx) => {
      const b = await tx.boleto.findFirst({ where: { id: boletoId, workspaceId } });
      if (!b || b.status === 'PAID') return;
      await this.settleCharge(tx, b, { received, original: Number(b.amount), paidAt: new Date(), origin });
    });
  }

  /** Baixa da cobrança + baixa do lançamento, na transação recebida. */
  private async settleCharge(
    tx: Tx,
    boleto: { id: string; workspaceId: string; kind: string; amount: unknown; entryRef: string | null; financialEntryId: string | null; gatewayBoletoId: string | null },
    p: { received: number; original: number; paidAt: Date; origin: string },
  ): Promise<string> {
    let result = 'PAID';
    const entryId = boleto.financialEntryId ?? boleto.entryRef;
    if (entryId && this.payments) {
      const entry = await tx.financialEntry.findFirst({ where: { id: entryId, workspaceId: boleto.workspaceId, deletedAt: null } });
      const open = entry ? PaymentsService.openAmount(entry) : 0;
      if (entry && entry.status !== 'CANCELLED' && toCents(open) > 0) {
        const parts = splitGatewayAmount(p.received, p.original, open);
        await this.payments.register(boleto.workspaceId, entryId, {
          ...parts,
          paidAt: p.paidAt,
          method: boleto.kind,
          source: p.origin === 'GATEWAY' ? 'GATEWAY' : 'MANUAL',
          gatewayPaymentId: boleto.gatewayBoletoId ?? undefined,
          bankAccountId: await this.settlementAccount(tx, boleto.workspaceId),
          notes: `Baixa automática (${p.origin})`,
        }, undefined, tx);
      } else {
        // dinheiro entrou, mas a conta já estava quitada/cancelada: sinaliza
        result = 'ATTENTION_ENTRY_NOT_OPEN';
        this.logger.warn(`Cobrança ${boleto.id} paga, mas a conta ${entryId} não estava em aberto — verificar pagamento em duplicidade.`);
      }
    }
    await tx.boleto.update({
      where: { id: boleto.id },
      data: { status: 'PAID', paidAt: p.paidAt, paidAmount: p.received },
    });
    return result;
  }

  private async settlementAccount(tx: Tx, workspaceId: string): Promise<string | null> {
    const gw = await tx.paymentGatewayConfig.findFirst({
      where: { workspaceId, provider: 'ASAAS', deletedAt: null }, orderBy: { isDefault: 'desc' }, select: { metadata: true },
    });
    const id = ((gw?.metadata ?? {}) as Record<string, unknown>).settlementBankAccountId as string | undefined;
    if (!id) return null;
    const acc = await tx.bankAccount.findFirst({ where: { id, workspaceId, deletedAt: null }, select: { id: true } });
    return acc?.id ?? null;
  }

  // ── ENVIO AO PAGADOR ──────────────────────────────────────

  async sendCharge(workspaceId: string, id: string, channels: string[], userId: string) {
    const wanted = [...new Set((channels ?? []).map((c) => c.toUpperCase()))].filter((c) => c === 'EMAIL' || c === 'WHATSAPP');
    if (!wanted.length) throw new BadRequestException('Escolha e-mail e/ou WhatsApp.');
    const b = await this.findOneBoleto(workspaceId, id);
    if (!['REGISTERED', 'PENDING', 'SENT', 'OVERDUE'].includes(b.status)) {
      throw new BadRequestException('Só é possível enviar cobranças em aberto.');
    }
    const contact = b.contactId
      ? await this.prisma.contact.findFirst({ where: { id: b.contactId, workspaceId, deletedAt: null }, select: { name: true, email: true, phone: true } })
      : null;
    if (!contact) throw new BadRequestException('A cobrança não tem pagador cadastrado.');
    // empresa que emitiu a cobrança (cópia gravada na emissão)
    const snap = asSnapshot((b as { issuerSnapshot?: unknown }).issuerSnapshot);
    const ws = snap ? null : await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } });
    const agency = displayName(snap, ws?.name ?? 'Imobiliária');
    const amount = brl(Number(b.amount));
    const due = dmy(b.dueDate);
    const isPix = b.kind === 'PIX';

    const ok: string[] = [];
    const failed: string[] = [];

    if (wanted.includes('EMAIL')) {
      try {
        if (!this.email) throw new Error('serviço de e-mail indisponível');
        if (!contact.email) throw new Error('o pagador não tem e-mail cadastrado');
        const lines = isPix
          ? [`<p><b>PIX copia e cola:</b><br><code style="word-break:break-all">${esc(b.pixCopiaECola ?? '')}</code></p>`,
             b.bankSlipUrl ? `<p>Ou pague pelo link (QR Code): <a href="${esc(b.bankSlipUrl)}">${esc(b.bankSlipUrl)}</a></p>` : '']
          : [b.bankSlipUrl ? `<p><a href="${esc(b.bankSlipUrl)}">Abrir o boleto (PDF)</a></p>` : '',
             b.linhaDigitavel ? `<p><b>Linha digitável:</b> ${esc(b.linhaDigitavel)}</p>` : ''];
        await this.email.sendEmail(workspaceId, {
          to: contact.email,
          subject: `${agency} — ${isPix ? 'cobrança PIX' : 'boleto'} de ${amount}, vencimento ${due}`,
          body: `<p>Olá, ${esc(contact.name)}.</p><p>Segue a cobrança de <b>${amount}</b> com vencimento em <b>${due}</b>` +
            `${b.description ? ` (${esc(b.description)})` : ''}.</p>${lines.join('')}<p>${esc(agency)}</p>`,
        } as any);
        ok.push('EMAIL');
      } catch (e) {
        failed.push(`e-mail: ${(e as Error).message}`);
      }
    }

    if (wanted.includes('WHATSAPP')) {
      try {
        if (!this.whatsapp) throw new Error('serviço de WhatsApp indisponível');
        const to = whatsappNumber(contact.phone);
        if (!to) throw new Error('o pagador não tem celular válido cadastrado');
        const payLine = isPix ? `PIX copia e cola:
${b.pixCopiaECola ?? ''}` : `Boleto: ${b.bankSlipUrl ?? ''}
Linha digitável: ${b.linhaDigitavel ?? ''}`;
        const template = process.env.WHATSAPP_COBRANCA_TEMPLATE;
        await this.whatsapp.sendMessage(workspaceId, userId, template
          ? { to, type: 'TEMPLATE', templateName: template, variables: { nome: contact.name, valor: amount, vencimento: due, pagamento: isPix ? b.pixCopiaECola ?? '' : b.bankSlipUrl ?? '' } } as any
          : { to, type: 'TEXT', body: `Olá, ${contact.name}! ${agency}: cobrança de ${amount}, vencimento ${due}.
${payLine}` } as any);
        ok.push('WHATSAPP');
      } catch (e) {
        failed.push(`WhatsApp: ${(e as Error).message}`);
      }
    }

    if (ok.length) {
      await this.prisma.boleto.update({
        where: { id },
        data: { lastSentAt: new Date(), lastSentChannels: ok.join(','), ...(b.status === 'REGISTERED' && { status: 'SENT' }) },
      });
    }
    if (failed.length) {
      const sent = ok.length ? `Enviado por ${ok.map((c) => (c === 'EMAIL' ? 'e-mail' : 'WhatsApp')).join(' e ')}. ` : '';
      throw new BadRequestException(`${sent}Falhou — ${failed.join('; ')}`);
    }
    return { sent: ok };
  }

  // ── CNAB ──────────────────────────────────────────────────

  async findCnabFiles(workspaceId: string) {
    return this.prisma.cnabFile.findMany({
      where: { workspaceId },
      include: { _count: { select: { records: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async uploadCnabRetorno(workspaceId: string, dto: UploadCnabDto) {
    const content = Buffer.from(dto.content, 'base64').toString('utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const fileHash = crypto.createHash('sha256').update(content).digest('hex');

    const cnabFile = await this.prisma.cnabFile.create({
      data: {
        workspaceId,
        type: 'RETORNO',
        format: dto.format,
        filename: dto.filename,
        fileHash,
        status: 'PROCESSING',
        recordCount: lines.length,
      },
    });

    const records = await this.processCnabRetorno(workspaceId, cnabFile.id, lines, dto.format);
    const errors = records.filter(r => r.status === 'ERROR').length;

    await this.prisma.cnabFile.update({
      where: { id: cnabFile.id },
      data: {
        status: errors > 0 ? 'PROCESSED' : 'PROCESSED',
        processedAt: new Date(),
        recordCount: records.length,
      },
    });

    return {
      cnabFile: { id: cnabFile.id, filename: dto.filename, recordCount: records.length },
      processed: records.filter(r => r.status === 'MATCHED').length,
      errors,
    };
  }

  async generateRemessa(workspaceId: string, dto: GenerateCnabRemessaDto) {
    const gateway = dto.gatewayId
      ? await this.getGatewayOrThrow(workspaceId, dto.gatewayId)
      : await this.prisma.paymentGatewayConfig.findFirst({
          where: { workspaceId, isDefault: true, deletedAt: null },
        });

    const boletos = await this.prisma.boleto.findMany({
      where: { workspaceId, status: { in: ['PENDING', 'REGISTERED'] }, deletedAt: null },
      take: 500,
    });

    const content = this.buildCnabRemessa(boletos, dto.format, gateway);
    const filename = `remessa_${dto.format}_${new Date().toISOString().slice(0,10)}.txt`;
    const fileHash = crypto.createHash('sha256').update(content).digest('hex');

    const cnabFile = await this.prisma.cnabFile.create({
      data: {
        workspaceId,
        type: 'REMESSA',
        format: dto.format,
        filename,
        fileHash,
        status: 'PROCESSED',
        processedAt: new Date(),
        recordCount: boletos.length,
      },
    });

    return {
      cnabFile: { id: cnabFile.id, filename, recordCount: boletos.length },
      content: Buffer.from(content).toString('base64'),
    };
  }

  // ── WEBHOOK (Asaas) ───────────────────────────────────────

  async processWebhook(
    workspaceId: string,
    payload: Record<string, unknown>,
    receivedToken?: string,
  ) {
    // Valida o token (header asaas-access-token x webhookSecret do gateway
    // Asaas) antes de confiar em qualquer coisa do payload.
    // Pode haver mais de uma conta Asaas (a do CNPJ atual e as de CNPJs
    // anteriores, que continuam recebendo baixas das cobranças antigas):
    // o token identifica a conta que mandou o aviso.
    const gateways = await this.prisma.paymentGatewayConfig.findMany({
      where: { workspaceId, provider: 'ASAAS', deletedAt: null, webhookSecret: { not: null } },
      select: { id: true, webhookSecret: true },
    });
    if (!gateways.length) {
      this.logger.warn(`Webhook de billing recusado: workspace ${workspaceId} sem token de webhook configurado.`);
      throw new ForbiddenException('Webhook não configurado ou não autorizado');
    }
    const a = Buffer.from(receivedToken ?? '');
    const gateway = gateways.find((g) => {
      const b = Buffer.from(g.webhookSecret as string);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    });
    if (!gateway) {
      throw new ForbiddenException('Token de webhook inválido');
    }

    const event = String(payload.event ?? '');
    const pay = (payload.payment ?? {}) as {
      id?: string; value?: number; originalValue?: number; status?: string;
      paymentDate?: string; clientPaymentDate?: string; confirmedDate?: string;
    };
    const eventId = String(payload.id ?? `${event}:${pay.id ?? ''}:${pay.status ?? ''}`).slice(0, 200);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // idempotência: o mesmo evento só é processado uma vez
        await tx.gatewayWebhookEvent.create({ data: { workspaceId, eventId, event, paymentId: pay.id ?? null } });
        const result = await this.applyWebhookEvent(tx, workspaceId, event, pay, gateway.id);
        await tx.gatewayWebhookEvent.update({ where: { workspaceId_eventId: { workspaceId, eventId } }, data: { result } });
        this.logger.log(`Webhook ${event} (${eventId}): ${result}`);
        return { received: true, result };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { received: true, duplicate: true };
      }
      throw err;
    }
  }

  private async applyWebhookEvent(
    tx: Tx,
    workspaceId: string,
    event: string,
    pay: { id?: string; value?: number; originalValue?: number; paymentDate?: string; clientPaymentDate?: string; confirmedDate?: string },
    gatewayId?: string,
  ): Promise<string> {
    if (!pay.id) return 'IGNORED_NO_PAYMENT';
    const boleto = await tx.boleto.findFirst({ where: { workspaceId, gatewayBoletoId: pay.id, deletedAt: null } });
    if (!boleto) return 'IGNORED_UNKNOWN_PAYMENT';
    // aviso de uma conta sobre cobrança emitida por outra conta: não confia
    if (gatewayId && boleto.gatewayId && boleto.gatewayId !== gatewayId) return 'IGNORED_OTHER_GATEWAY';

    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED_IN_CASH': {
        if (boleto.status === 'PAID') return 'ALREADY_PAID';
        const day = pay.paymentDate ?? pay.clientPaymentDate ?? pay.confirmedDate;
        const paidAt = day ? new Date(`${day.slice(0, 10)}T12:00:00Z`) : new Date();
        const received = Number(pay.value ?? boleto.amount);
        const original = Number(pay.originalValue ?? boleto.amount);
        return this.settleCharge(tx, boleto, { received, original, paidAt: paidAt > new Date() ? new Date() : paidAt, origin: 'GATEWAY' });
      }
      case 'PAYMENT_OVERDUE': {
        if (['PAID', 'CANCELLED'].includes(boleto.status)) return 'IGNORED_STATUS';
        await tx.boleto.update({ where: { id: boleto.id }, data: { status: 'OVERDUE' } });
        if (boleto.financialEntryId) {
          await tx.financialEntry.updateMany({ where: { id: boleto.financialEntryId, workspaceId, status: 'PENDING' }, data: { status: 'OVERDUE' } });
        }
        return 'OVERDUE';
      }
      case 'PAYMENT_DELETED': {
        if (boleto.status === 'CANCELLED') return 'ALREADY_CANCELLED';
        if (boleto.status === 'PAID') return 'IGNORED_PAID';
        await tx.boleto.update({
          where: { id: boleto.id },
          data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'Removida diretamente no Asaas', financialEntryId: null },
        });
        return 'CANCELLED';
      }
      case 'PAYMENT_REFUNDED': {
        if (boleto.status !== 'PAID') return 'IGNORED_NOT_PAID';
        const p = await tx.financialPayment.findFirst({ where: { workspaceId, gatewayPaymentId: pay.id, reversedAt: null } });
        if (p && this.payments) await this.payments.reverse(workspaceId, p.id, 'Estornado no Asaas (devolvido ao pagador)', undefined, tx);
        await tx.boleto.update({ where: { id: boleto.id }, data: { status: 'REFUNDED' } });
        return 'REFUNDED';
      }
      default:
        return 'IGNORED_EVENT';
    }
  }

  // ── HELPERS PRIVADOS ──────────────────────────────────────

  private async getGatewayOrThrow(workspaceId: string, id: string) {
    const g = await this.prisma.paymentGatewayConfig.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!g) throw new NotFoundException('Gateway não encontrado');
    return g;
  }

  private async processCnabRetorno(
    workspaceId: string,
    cnabFileId: string,
    lines: string[],
    format: string,
  ) {
    const records: Array<{ status: string }> = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Parsing simplificado — produção exige layout completo por banco
      const segmentType = format === 'CNAB240' ? line[7] : line[0];
      if (segmentType === '9') continue; // trailer

      const nossoNumero = format === 'CNAB240' ? line.slice(37, 57).trim() : line.slice(62, 73).trim();
      const occurrence = format === 'CNAB240' ? line.slice(15, 17) : line.slice(108, 110);
      const amountStr = format === 'CNAB240' ? line.slice(152, 167) : line.slice(110, 125);
      const amount = parseFloat(amountStr) / 100;

      let boleto = null;
      if (nossoNumero) {
        boleto = await this.prisma.boleto.findFirst({
          where: { workspaceId, nossoNumero: { contains: nossoNumero.replace(/^0+/, '') } },
        });
      }

      const record = await this.prisma.cnabRecord.create({
        data: {
          cnabFileId,
          lineNumber: i + 1,
          occurrence,
          nossoNumero,
          amount,
          boletoId: boleto?.id,
          status: boleto ? 'MATCHED' : 'ERROR',
          errorMsg: boleto ? null : `Boleto não encontrado: ${nossoNumero}`,
          rawLine: line.slice(0, 240),
        },
      });

      // Ocorrência 06 = liquidação / 09 = baixa
      if (boleto && ['06', '09', '00'].includes(occurrence)) {
        await this.settleChargeStandalone(workspaceId, boleto.id, amount || Number(boleto.amount), 'CNAB');
      }
      records.push(record);
    }
    return records;
  }

  private buildCnabRemessa(boletos: Array<Record<string, unknown>>, format: string, gateway: Record<string, unknown> | null): string {
    const header = format === 'CNAB240'
      ? '00000000'.padEnd(240, ' ')
      : '0'.padEnd(400, ' ');
    const records = boletos.map(b => {
      const line = `1${String(b['nossoNumero'] || '').padStart(20, '0')}${String(Math.round(Number(b['amount']) * 100)).padStart(15, '0')}`;
      return format === 'CNAB240' ? line.padEnd(240, ' ') : line.padEnd(400, ' ');
    });
    const trailer = format === 'CNAB240' ? '9'.padEnd(240, ' ') : '9'.padEnd(400, ' ');
    return [header, ...records, trailer].join('\r\n');
  }

}
