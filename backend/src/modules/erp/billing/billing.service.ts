// Serviço de Cobranças — Boletos, PIX, CNAB e Gateways
import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateGatewayConfigDto, GenerateBoletoDto, BoletoQueryDto,
  UploadCnabDto, GenerateCnabRemessaDto,
} from './billing.dto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private prisma: PrismaService) {}

  // ── CONFIGURAÇÃO DE GATEWAY ──────────────────────────────

  async getGateways(workspaceId: string) {
    return this.prisma.paymentGatewayConfig.findMany({
      where: { workspaceId, deletedAt: null },
      select: {
        id: true, provider: true, name: true, environment: true,
        isActive: true, isDefault: true, createdAt: true,
      },
    });
  }

  async createGateway(workspaceId: string, dto: CreateGatewayConfigDto) {
    const existing = await this.prisma.paymentGatewayConfig.findFirst({
      where: { workspaceId, provider: dto.provider, deletedAt: null },
    });
    if (existing) throw new BadRequestException(`Gateway ${dto.provider} já configurado`);

    if (dto.isDefault) {
      await this.prisma.paymentGatewayConfig.updateMany({
        where: { workspaceId }, data: { isDefault: false },
      });
    }

    return this.prisma.paymentGatewayConfig.create({
      data: { workspaceId, ...dto, apiKey: this.encrypt(dto.apiKey) },
    });
  }

  async updateGateway(workspaceId: string, id: string, dto: Partial<CreateGatewayConfigDto>) {
    await this.getGatewayOrThrow(workspaceId, id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.apiKey) data.apiKey = this.encrypt(dto.apiKey);
    if (dto.isDefault) {
      await this.prisma.paymentGatewayConfig.updateMany({
        where: { workspaceId }, data: { isDefault: false },
      });
    }
    return this.prisma.paymentGatewayConfig.update({ where: { id }, data });
  }

  async deleteGateway(workspaceId: string, id: string) {
    await this.getGatewayOrThrow(workspaceId, id);
    await this.prisma.paymentGatewayConfig.update({
      where: { id }, data: { deletedAt: new Date() },
    });
    return { message: 'Gateway removido com sucesso' };
  }

  // ── BOLETOS ───────────────────────────────────────────────

  async findBoletos(workspaceId: string, query: BoletoQueryDto) {
    const { page = 1, limit = 20, status, contractId } = query;
    const skip = (page - 1) * limit;
    const where = {
      workspaceId, deletedAt: null,
      ...(status && { status }),
      ...(contractId && { financialEntry: { contractId } }),
    };
    const [items, total] = await Promise.all([
      this.prisma.boleto.findMany({
        where, skip, take: limit, orderBy: { dueDate: 'asc' },
      }),
      this.prisma.boleto.count({ where }),
    ]);
    return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async findOneBoleto(workspaceId: string, id: string) {
    const boleto = await this.prisma.boleto.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!boleto) throw new NotFoundException('Boleto não encontrado');
    return boleto;
  }

  async generateBoleto(workspaceId: string, dto: GenerateBoletoDto) {
    const gateway = dto.gatewayId
      ? await this.getGatewayOrThrow(workspaceId, dto.gatewayId)
      : await this.prisma.paymentGatewayConfig.findFirst({
          where: { workspaceId, isDefault: true, deletedAt: null },
        });

    // Deriva amount/dueDate/contato do lançamento financeiro quando não informados
    let amount = dto.amount;
    let dueDate = dto.dueDate;
    let contactId = dto.contactId;
    let contractId = dto.contractId;
    let description = dto.description;

    if (dto.financialEntryId) {
      const entry = await this.prisma.financialEntry.findFirst({
        where: { id: dto.financialEntryId, workspaceId, deletedAt: null },
      });
      if (!entry) throw new BadRequestException('Lançamento financeiro não encontrado.');
      amount = amount ?? Number(entry.amount);
      dueDate = dueDate ?? entry.dueDate.toISOString();
      contactId = contactId ?? entry.contactId ?? undefined;
      contractId = contractId ?? entry.contractId ?? undefined;
      description = description ?? entry.description ?? undefined;
    }

    if (!amount || amount <= 0) {
      throw new BadRequestException('Valor do boleto é obrigatório (informe amount ou um lançamento financeiro válido).');
    }
    if (!dueDate) {
      throw new BadRequestException('Data de vencimento é obrigatória (informe dueDate ou um lançamento financeiro válido).');
    }

    // Um lançamento só pode ter um boleto ativo
    if (dto.financialEntryId) {
      const existing = await this.prisma.boleto.findFirst({
        where: { financialEntryId: dto.financialEntryId, deletedAt: null },
        select: { id: true },
      });
      if (existing) {
        throw new BadRequestException('Este lançamento já possui um boleto. Cancele ou reemita o boleto existente.');
      }
    }

    // Normaliza vencimento para YYYY-MM-DD (helpers esperam só a data, sem horário)
    const dueDateOnly = dueDate.slice(0, 10);

    // Gerar dados simulados de boleto (em produção: chamar API do gateway)
    const nossoNumero = this.generateNossoNumero();
    const linhaDigitavel = this.generateLinhaDigitavel(nossoNumero, amount, dueDateOnly);
    const codigoBarras = this.generateCodigoBarras(nossoNumero, amount, dueDateOnly);
    const pixQrCode = this.generatePixQrCode(nossoNumero, amount);

    const boleto = await this.prisma.boleto.create({
      data: {
        workspaceId,
        gatewayId: gateway?.id,
        financialEntryId: dto.financialEntryId,
        contractId,
        contactId,
        amount,
        dueDate: new Date(dueDate),
        description,
        nossoNumero,
        linhaDigitavel,
        codigoBarras,
        pixQrCode,
        pixCopiaECola: `00020126360014BR.GOV.BCB.PIX0114${nossoNumero}5204000053039865802BR5925IMOBILIARIA HOMOLOG6009SAO PAULO62070503***6304${nossoNumero.slice(-4)}`,
        fine: dto.fine ?? 2.0,
        interest: dto.interest ?? 0.033,
        discount: dto.discount ?? 0.0,
        instructions: dto.instructions,
        status: gateway ? 'REGISTERED' : 'PENDING',
        registeredAt: gateway ? new Date() : null,
      },
    });

    if (dto.financialEntryId) {
      await this.prisma.financialEntry.update({
        where: { id: dto.financialEntryId },
        data: { status: 'PENDING' },
      });
    }

    this.logger.log(`Boleto gerado: ${boleto.id} venc=${dueDate} R$${amount}`);
    return boleto;
  }

  async reissueBoleto(workspaceId: string, id: string, newDueDate: string) {
    const boleto = await this.findOneBoleto(workspaceId, id);
    if (boleto.status === 'PAID') throw new BadRequestException('Boleto já está pago');

    // Cancelar boleto anterior
    await this.prisma.boleto.update({
      where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), deletedAt: new Date() },
    });

    // Gerar novo boleto com nova data
    return this.generateBoleto(workspaceId, {
      financialEntryId: boleto.financialEntryId ?? undefined,
      contractId: boleto.contractId ?? undefined,
      contactId: boleto.contactId ?? undefined,
      gatewayId: boleto.gatewayId ?? undefined,
      amount: boleto.amount,
      dueDate: newDueDate,
      description: boleto.description ?? undefined,
      fine: boleto.fine,
      interest: boleto.interest,
      discount: boleto.discount,
      instructions: boleto.instructions ?? undefined,
    });
  }

  async confirmPayment(workspaceId: string, id: string, paidAmount?: number) {
    const boleto = await this.findOneBoleto(workspaceId, id);
    if (boleto.status === 'PAID') throw new BadRequestException('Boleto já está pago');

    await this.prisma.boleto.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date(), paidAmount: paidAmount ?? boleto.amount },
    });

    if (boleto.financialEntryId) {
      await this.prisma.financialEntry.update({
        where: { id: boleto.financialEntryId },
        data: { status: 'PAID', paidAt: new Date() },
      });
    }
    return { message: 'Pagamento confirmado' };
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

  // ── WEBHOOK (Gateway) ─────────────────────────────────────

  async processWebhook(workspaceId: string, payload: Record<string, unknown>) {
    // Processar webhook de confirmação de pagamento do gateway
    const event = payload.event as string;
    const boletoId = payload.nossoNumero as string || payload.id as string;

    if (event === 'PAYMENT_RECEIVED' && boletoId) {
      const boleto = await this.prisma.boleto.findFirst({
        where: { workspaceId, nossoNumero: boletoId, deletedAt: null },
      });
      if (boleto) {
        await this.confirmPayment(workspaceId, boleto.id, payload.value as number);
        this.logger.log(`Webhook: pagamento confirmado boleto ${boleto.id}`);
      }
    }
    return { received: true };
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
        await this.confirmPayment(workspaceId, boleto.id, amount || boleto.amount);
      }
      records.push(record);
    }
    return records;
  }

  private generateNossoNumero(): string {
    return Date.now().toString().slice(-10) + Math.floor(Math.random() * 100).toString().padStart(2, '0');
  }

  private generateLinhaDigitavel(nossoNumero: string, amount: number, dueDate: string): string {
    const val = Math.round(amount * 100).toString().padStart(10, '0');
    return `34191.${nossoNumero.slice(0,5)} ${nossoNumero.slice(5,10)}.000001 ${nossoNumero.slice(0,5)}.000002 1 ${dueDate.replace(/-/g, '')}${val}`;
  }

  private generateCodigoBarras(nossoNumero: string, amount: number, dueDate: string): string {
    const val = Math.round(amount * 100).toString().padStart(10, '0');
    return `34191${dueDate.replace(/-/g, '')}${val}${nossoNumero.padEnd(25, '0')}`;
  }

  private generatePixQrCode(nossoNumero: string, amount: number): string {
    return `PIX:${nossoNumero}:${amount.toFixed(2)}`;
  }

  private buildCnabRemessa(boletos: Array<Record<string, unknown>>, format: string, gateway: Record<string, unknown> | null): string {
    const header = format === 'CNAB240'
      ? '00000000'.padEnd(240, ' ')
      : '0'.padEnd(400, ' ');
    const records = boletos.map(b => {
      const line = `1${String(b['nossoNumero'] || '').padStart(20, '0')}${String(Math.round((b['amount'] as number) * 100)).padStart(15, '0')}`;
      return format === 'CNAB240' ? line.padEnd(240, ' ') : line.padEnd(400, ' ');
    });
    const trailer = format === 'CNAB240' ? '9'.padEnd(240, ' ') : '9'.padEnd(400, ' ');
    return [header, ...records, trailer].join('\r\n');
  }

  private encrypt(value: string): string {
    // Criptografia simples para armazenamento (produção: usar KMS)
    const key = process.env.HMAC_SECRET || 'homolog-secret-32-chars-here----';
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key.slice(0, 32)), Buffer.alloc(16, 0));
    return cipher.update(value, 'utf8', 'hex') + cipher.final('hex');
  }
}
