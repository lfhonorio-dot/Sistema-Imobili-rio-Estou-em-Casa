// Serviço de Split de Pagamento
import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AsaasClient } from '../billing/asaas.client';
import {
  CreateRecipientDto, CreateSplitRuleDto, ProcessSplitDto, SplitQueryDto,
} from './split.dto';

@Injectable()
export class SplitService {
  private readonly logger = new Logger(SplitService.name);

  constructor(
    private prisma: PrismaService,
    private asaas: AsaasClient,
  ) {}

  // ── RECEBEDORES ───────────────────────────────────────────

  async findRecipients(workspaceId: string) {
    return this.prisma.splitRecipient.findMany({
      where: { workspaceId, deletedAt: null },
      include: { _count: { select: { splitRules: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOneRecipient(workspaceId: string, id: string) {
    const r = await this.prisma.splitRecipient.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!r) throw new NotFoundException('Recebedor não encontrado');
    return r;
  }

  async createRecipient(workspaceId: string, dto: CreateRecipientDto) {
    const existing = await this.prisma.splitRecipient.findFirst({
      where: { workspaceId, document: dto.document, deletedAt: null },
    });
    if (existing) throw new BadRequestException('Recebedor com este documento já cadastrado');

    const recipient = await this.prisma.splitRecipient.create({
      data: {
        workspaceId,
        name: dto.name,
        document: dto.document,
        documentType: dto.documentType,
        email: dto.email,
        phone: dto.phone,
        bankCode: dto.bankCode,
        agency: dto.agency,
        accountNumber: dto.accountNumber,
        accountType: dto.accountType,
        pixKey: dto.pixKey,
        pixKeyType: dto.pixKeyType,
        kycStatus: 'PENDING',
      },
    });

    this.logger.log(`Recebedor criado: ${recipient.id} doc=${dto.document}`);
    return recipient;
  }

  async updateRecipient(workspaceId: string, id: string, dto: Partial<CreateRecipientDto>) {
    await this.findOneRecipient(workspaceId, id);
    return this.prisma.splitRecipient.update({ where: { id }, data: dto });
  }

  async deleteRecipient(workspaceId: string, id: string) {
    await this.findOneRecipient(workspaceId, id);
    await this.prisma.splitRecipient.update({
      where: { id }, data: { deletedAt: new Date() },
    });
    return { message: 'Recebedor removido com sucesso' };
  }

  async submitKyc(workspaceId: string, id: string) {
    const recipient = await this.findOneRecipient(workspaceId, id);

    const missingFields: string[] = [];
    if (!recipient.bankCode && !recipient.pixKey) missingFields.push('bankCode ou pixKey');
    if (missingFields.length > 0) {
      throw new BadRequestException(`Campos obrigatórios para KYC: ${missingFields.join(', ')}`);
    }

    return this.prisma.splitRecipient.update({
      where: { id },
      data: { kycStatus: 'APPROVED', kycSubmittedAt: new Date() },
    });
  }

  // ── REGRAS DE SPLIT ───────────────────────────────────────

  async findSplitRules(workspaceId: string) {
    return this.prisma.splitRule.findMany({
      where: { workspaceId, isActive: true },
      include: {
        recipient: { select: { id: true, name: true, document: true } },
        contract: { select: { id: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneSplitRule(workspaceId: string, id: string) {
    const rule = await this.prisma.splitRule.findFirst({
      where: { id, workspaceId },
      include: {
        recipient: true,
        contract: { select: { id: true, type: true } },
      },
    });
    if (!rule) throw new NotFoundException('Regra de split não encontrada');
    return rule;
  }

  async createSplitRule(workspaceId: string, dto: CreateSplitRuleDto) {
    const recipient = await this.findOneRecipient(workspaceId, dto.recipientId);
    if (recipient.kycStatus !== 'APPROVED') {
      throw new BadRequestException(`Recebedor ${recipient.name} não tem KYC aprovado`);
    }

    return this.prisma.splitRule.create({
      data: {
        workspaceId,
        contractId: dto.contractId,
        recipientId: dto.recipientId,
        type: dto.type ?? 'PERCENTAGE',
        value: dto.value,
        description: dto.description,
        isActive: true,
      },
      include: { recipient: true },
    });
  }

  async deactivateSplitRule(workspaceId: string, id: string) {
    await this.findOneSplitRule(workspaceId, id);
    await this.prisma.splitRule.update({ where: { id }, data: { isActive: false } });
    return { message: 'Regra de split desativada com sucesso' };
  }

  // ── TRANSAÇÕES DE SPLIT ───────────────────────────────────

  async findSplitTransactions(workspaceId: string, query: SplitQueryDto) {
    const { page = 1, limit = 20, status, recipientId } = query;
    const skip = (page - 1) * limit;
    const where = {
      workspaceId,
      ...(status && { status }),
      ...(recipientId && { recipientId }),
    };
    const [items, total] = await Promise.all([
      this.prisma.splitTransaction.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          recipient: { select: { id: true, name: true, document: true } },
        },
      }),
      this.prisma.splitTransaction.count({ where }),
    ]);
    return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async processSplit(workspaceId: string, dto: ProcessSplitDto) {
    // Buscar todas as regras ativas para entradas financeiras do workspace
    const entry = await this.prisma.financialEntry.findFirst({
      where: { id: dto.financialEntryId, workspaceId },
      include: { contract: { include: { splitRules: { where: { isActive: true } } } } },
    });
    if (!entry) throw new NotFoundException('Lançamento financeiro não encontrado');

    const rules = entry.contract?.splitRules ?? [];
    if (rules.length === 0) {
      throw new BadRequestException('Nenhuma regra de split ativa para este contrato');
    }

    const transactions = await Promise.all(
      rules.map(async (rule) => {
        const amount = rule.type === 'FIXED'
          ? rule.value
          : (dto.totalAmount * rule.value) / 100;

        return this.prisma.splitTransaction.create({
          data: {
            workspaceId,
            financialEntryId: dto.financialEntryId,
            recipientId: rule.recipientId,
            amount,
            status: 'PENDING',
          },
        });
      }),
    );

    this.logger.log(`Split processado: entry=${dto.financialEntryId} parcelas=${transactions.length}`);
    return { transactions, total: transactions.length };
  }

  async confirmSplitTransaction(workspaceId: string, id: string) {
    const tx = await this.prisma.splitTransaction.findFirst({
      where: { id, workspaceId },
      include: { recipient: { select: { name: true, pixKey: true, pixKeyType: true, kycStatus: true } } },
    });
    if (!tx) throw new NotFoundException('Transação não encontrada');
    if (tx.status === 'COMPLETED') return tx;

    // Repasse REAL via PIX quando há gateway Asaas ativo e o recebedor tem
    // chave PIX habilitada (KYC). Sem gateway: confirmação manual (controle).
    const gateway = await this.prisma.paymentGatewayConfig.findFirst({
      where: { workspaceId, provider: 'ASAAS', isActive: true, deletedAt: null },
    });

    if (gateway && tx.recipient?.pixKey) {
      if (tx.recipient.kycStatus !== 'APPROVED') {
        throw new BadRequestException(
          `Recebedor ${tx.recipient.name} não está habilitado (KYC) para receber repasses.`,
        );
      }
      try {
        const creds = {
          apiKey: this.asaas.decryptApiKey(gateway.apiKey),
          environment: gateway.environment,
        };
        const transfer = await this.asaas.transferPix(creds, {
          value: Number(tx.amount),
          pixKey: tx.recipient.pixKey,
          pixKeyType: tx.recipient.pixKeyType ?? 'RANDOM',
          description: `Repasse de comissão — ${tx.recipient.name}`,
          externalReference: `split-${tx.id}`, // idempotência por transação
        });
        return await this.prisma.splitTransaction.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            processedAt: new Date(),
            gatewayTransactionId: transfer.transferId,
          },
        });
      } catch (err) {
        await this.prisma.splitTransaction.update({
          where: { id },
          data: { status: 'FAILED', failReason: (err as Error).message?.slice(0, 500) },
        });
        throw err;
      }
    }

    // Confirmação manual (sem gateway): registro de controle
    return this.prisma.splitTransaction.update({
      where: { id },
      data: { status: 'COMPLETED', processedAt: new Date() },
    });
  }
}
