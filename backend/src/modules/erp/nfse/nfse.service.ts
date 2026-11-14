// Fase 6 — emissão de NFS-e (Franca / SIL ABRASF 2.04).
//
// Fluxo: "Emitir NF" na conta a receber (ou automático ao receber a comissão)
// → registro QUEUED com número de RPS reservado → processamento (assina o XML
// e envia à prefeitura) → AUTORIZADA (guarda XML e PDF, aplica retenções na
// conta) ou REJEITADA (com o motivo da prefeitura). Falha de comunicação volta
// para a fila e tenta de novo com espera crescente; antes de reenviar, consulta
// o RPS para nunca emitir duas notas iguais.

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from '../../files/files.service';
import { EmailService } from '../../hub/email/email.service';
import { PaymentsService } from '../financial/payments.service';
import { NfseConfigService } from './nfse-config.service';
import { SilAbrasf24Provider } from './sil-abrasf24.provider';
import { computeNfseTaxes, takerKind } from './nfse-tax';
import { buildNfsePdf } from './nfse-pdf';
import type { RpsInput } from './abrasf-xml';
import type { NfseProviderContext } from './nfse-provider';

export const ACTIVE_NFSE = ['QUEUED', 'PROCESSING', 'AUTHORIZED', 'ISSUED', 'PENDING'];
const BACKOFF_MIN = [1, 5, 15, 60, 240];
const MAX_ATTEMPTS = BACKOFF_MIN.length + 1;
const PORTAL_URL = 'https://franca.siltecnologia.com.br';
const CANCEL_CODES: Record<string, string> = { '1': 'Erro na emissão', '2': 'Serviço não prestado', '4': 'Duplicidade da nota' };

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const num = (v: unknown) => Number(v ?? 0);

export interface RequestNfseInput {
  amount?: number;
  description?: string;
  competence?: string; // AAAA-MM-DD
}

@Injectable()
export class NfseService {
  private readonly logger = new Logger(NfseService.name);
  private running = false;

  constructor(
    private prisma: PrismaService,
    private files: FilesService,
    private email: EmailService,
    private payments: PaymentsService,
    private config: NfseConfigService,
    private provider: SilAbrasf24Provider,
  ) {}

  // ── Consulta ─────────────────────────────────────────────

  private present<T extends { xmlFileId: string | null; pdfFileId: string | null; status: string }>(n: T) {
    return {
      ...n,
      statusLabel: ({ QUEUED: 'Na fila', PROCESSING: 'Processando', AUTHORIZED: 'Autorizada', ISSUED: 'Autorizada', REJECTED: 'Rejeitada',
        ERROR: 'Falha de comunicação', CANCELLED: 'Cancelada', PENDING: 'Processando' } as Record<string, string>)[n.status] ?? n.status,
      xmlDownloadUrl: n.xmlFileId ? this.files.signedPath(n.xmlFileId) : null,
      pdfDownloadUrl: n.pdfFileId ? this.files.signedPath(n.pdfFileId) : null,
    };
  }

  async list(workspaceId: string, q: { status?: string; from?: string; to?: string; search?: string; entryId?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(q.limit) || 20));
    const where: Prisma.NfseRecordWhereInput = {
      workspaceId, deletedAt: null,
      ...(q.status && { status: q.status === 'AUTHORIZED' ? { in: ['AUTHORIZED', 'ISSUED'] } : q.status }),
      ...(q.entryId && { financialEntryId: q.entryId }),
      ...((q.from || q.to) && { createdAt: { ...(q.from && { gte: new Date(`${q.from}T00:00:00Z`) }), ...(q.to && { lte: new Date(`${q.to}T23:59:59Z`) }) } }),
      ...(q.search && { OR: [{ takerName: { contains: q.search, mode: 'insensitive' } }, { number: { contains: q.search } }, { description: { contains: q.search, mode: 'insensitive' } }] }),
    };
    const [items, total] = await Promise.all([
      this.prisma.nfseRecord.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, select: this.listSelect }),
      this.prisma.nfseRecord.count({ where }),
    ]);
    return { items: items.map((n) => this.present(n)), meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  // não devolve o XML de resposta bruto na listagem
  private listSelect = {
    id: true, financialEntryId: true, number: true, serie: true, verificationCode: true, takerDocument: true, takerName: true,
    takerType: true, takerEmail: true, description: true, amount: true, issRate: true, issAmount: true, issRetained: true, status: true,
    issuedAt: true, cancelledAt: true, cancelReason: true, environment: true, rpsSerie: true, rpsNumber: true, baseAmount: true, issDue: true,
    irRetained: true, pisRetained: true, cofinsRetained: true, csllRetained: true, issRetainedAmount: true, totalRetained: true, netAmount: true,
    rejectionReason: true, retryCount: true, nextAttemptAt: true, xmlFileId: true, pdfFileId: true, autoIssued: true, retentionWarning: true,
    emailedAt: true, createdAt: true, competence: true,
  } satisfies Prisma.NfseRecordSelect;

  async get(workspaceId: string, id: string) {
    const n = await this.prisma.nfseRecord.findFirst({ where: { id, workspaceId, deletedAt: null }, select: this.listSelect });
    if (!n) throw new NotFoundException('Nota fiscal não encontrada.');
    return this.present(n);
  }

  // ── Pedido de emissão ────────────────────────────────────

  private async loadEntryForNfse(workspaceId: string, entryId: string) {
    const entry = await this.prisma.financialEntry.findFirst({
      where: { id: entryId, workspaceId, deletedAt: null },
      include: { contract: { select: { code: true, property: { select: { code: true, street: true, number: true, city: true } } } } },
    });
    if (!entry) throw new NotFoundException('Conta a receber não encontrada.');
    if (entry.type !== 'RECEIVABLE') throw new BadRequestException('Nota fiscal só é emitida para contas a receber.');
    if (entry.status === 'CANCELLED') throw new BadRequestException('A conta está cancelada.');
    return entry;
  }

  private defaultDescription(entry: Awaited<ReturnType<NfseService['loadEntryForNfse']>>) {
    const p = entry.contract?.property;
    const imovel = p ? ` Imóvel ${p.code ?? ''}${p.street ? ` — ${p.street}${p.number ? `, ${p.number}` : ''}${p.city ? ` (${p.city})` : ''}` : ''}.` : '';
    const contrato = entry.contract?.code ? ` Contrato ${entry.contract.code}.` : '';
    return `Serviços de intermediação imobiliária (corretagem) — ${entry.description}.${contrato}${imovel}`.replace(/\.\./g, '.');
  }

  /** Prévia para a tela "Emitir NF": tomador, valores, retenções e o que falta configurar. */
  async preview(workspaceId: string, entryId: string, input: RequestNfseInput = {}) {
    const entry = await this.loadEntryForNfse(workspaceId, entryId);
    const cfg = await this.config.raw(workspaceId);
    const contact = entry.contactId
      ? await this.prisma.contact.findFirst({ where: { id: entry.contactId, workspaceId, deletedAt: null }, select: { id: true, name: true, companyName: true, cpf: true, cnpj: true, email: true } })
      : null;
    const doc = contact?.cnpj || contact?.cpf || null;
    const kind = takerKind(doc);
    const amount = input.amount ?? num(entry.amount);
    const taxes = computeNfseTaxes(amount, kind === 'PJ', this.config.taxConfig(cfg));
    const existing = await this.prisma.nfseRecord.findFirst({
      where: { workspaceId, financialEntryId: entryId, deletedAt: null, status: { in: ACTIVE_NFSE } }, select: { id: true, status: true, number: true },
    });
    const problems: string[] = [];
    if (!contact) problems.push('A conta não tem pagador (tomador) cadastrado.');
    else if (!kind) problems.push('O tomador precisa ter CPF ou CNPJ válido no cadastro.');
    if (existing) problems.push(`Já existe nota ${existing.number ? `nº ${existing.number}` : 'em andamento'} para esta conta.`);
    const charge = taxes.totalRetained > 0
      ? await this.prisma.boleto.findFirst({ where: { workspaceId, financialEntryId: entryId, deletedAt: null, status: { notIn: ['CANCELLED', 'PAID', 'REFUNDED'] } }, select: { id: true } })
      : null;
    if (charge) problems.push('Há boleto/PIX emitido com o valor bruto: cancele a cobrança antes; depois da nota, cobre o valor líquido.');
    const readiness = this.config.readiness(cfg);
    return {
      entry: { id: entry.id, description: entry.description, amount: num(entry.amount), status: entry.status, openAmount: PaymentsService.openAmount(entry) },
      taker: contact ? { id: contact.id, name: (kind === 'PJ' && contact.companyName) || contact.name, document: doc, type: kind, email: contact.email } : null,
      description: input.description ?? this.defaultDescription(entry),
      environment: cfg.nfseEnvironment,
      taxes,
      readiness,
      problems,
      canIssue: readiness.ready && problems.length === 0,
    };
  }

  async requestForEntry(workspaceId: string, entryId: string, input: RequestNfseInput, userId?: string, opts: { auto?: boolean; processNow?: boolean } = {}) {
    const pv = await this.preview(workspaceId, entryId, input);
    if (!pv.readiness.ready) throw new BadRequestException(`Configuração fiscal incompleta: ${pv.readiness.missing.join(', ')}.`);
    if (pv.problems.length) throw new BadRequestException(pv.problems.join(' '));
    const description = (input.description ?? pv.description).trim();
    if (description.length < 10) throw new BadRequestException('Descreva o serviço (mínimo de 10 caracteres).');
    if (description.length > 2000) throw new BadRequestException('Descrição longa demais (máximo 2.000 caracteres).');
    const t = pv.taxes;
    const competence = input.competence ? new Date(`${input.competence.slice(0, 10)}T12:00:00Z`) : new Date();

    const record = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "tax_configs" WHERE "workspaceId" = ${workspaceId} FOR UPDATE`;
      const c = await tx.taxConfig.findUniqueOrThrow({ where: { workspaceId } });
      const dup = await tx.nfseRecord.findFirst({ where: { workspaceId, financialEntryId: entryId, deletedAt: null, status: { in: ACTIVE_NFSE } }, select: { id: true } });
      if (dup) throw new BadRequestException('Já existe nota fiscal para esta conta.');
      const rpsNumber = c.rpsNextNumber;
      await tx.taxConfig.update({ where: { workspaceId }, data: { rpsNextNumber: rpsNumber + 1 } });
      return tx.nfseRecord.create({
        data: {
          workspaceId, financialEntryId: entryId, provider: this.provider.name, environment: c.nfseEnvironment,
          rpsSerie: c.rpsSerie, rpsNumber, serie: c.rpsSerie,
          issuerCnpj: c.cnpj ?? '', takerDocument: (pv.taker!.document ?? '').replace(/\D/g, ''), takerName: pv.taker!.name,
          takerType: pv.taker!.type, takerEmail: pv.taker!.email, takerContactId: pv.taker!.id,
          serviceCode: c.itemListaServico ?? '', description, competence,
          amount: t.base, issRate: t.issRatePct, issAmount: t.issDue, issRetained: t.issRetained,
          baseAmount: t.base, issDue: t.issDue, irRetained: t.irRetained, pisRetained: t.pisRetained, cofinsRetained: t.cofinsRetained,
          csllRetained: t.csllRetained, issRetainedAmount: t.issRetainedAmount, totalRetained: t.totalRetained, netAmount: t.netAmount,
          status: 'QUEUED', nextAttemptAt: new Date(), autoIssued: !!opts.auto, createdById: userId ?? null,
        },
      });
    });
    if (opts.processNow !== false) await this.processOne(record.id);
    return this.get(workspaceId, record.id);
  }

  /** Reenviar uma nota rejeitada/com falha (depois de corrigir o cadastro ou a configuração). */
  async retry(workspaceId: string, id: string) {
    const n = await this.prisma.nfseRecord.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!n) throw new NotFoundException('Nota fiscal não encontrada.');
    if (!['REJECTED', 'ERROR'].includes(n.status)) throw new BadRequestException('Só notas rejeitadas ou com falha de comunicação podem ser reenviadas.');
    if (n.financialEntryId) {
      const active = await this.prisma.nfseRecord.findFirst({ where: { workspaceId, financialEntryId: n.financialEntryId, id: { not: id }, deletedAt: null, status: { in: ACTIVE_NFSE } }, select: { id: true } });
      if (active) throw new BadRequestException('Esta conta já tem outra nota fiscal.');
    }
    // dados do tomador podem ter sido corrigidos no cadastro
    const contact = n.takerContactId
      ? await this.prisma.contact.findFirst({ where: { id: n.takerContactId, workspaceId, deletedAt: null }, select: { name: true, cpf: true, cnpj: true, email: true } })
      : null;
    const doc = (contact?.cnpj || contact?.cpf || n.takerDocument || '').replace(/\D/g, '');
    if (!takerKind(doc)) throw new BadRequestException('O tomador ainda está sem CPF/CNPJ válido no cadastro.');
    let rps = { rpsSerie: n.rpsSerie, rpsNumber: n.rpsNumber };
    if (!n.rpsNumber) {
      rps = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "tax_configs" WHERE "workspaceId" = ${workspaceId} FOR UPDATE`;
        const c = await tx.taxConfig.findUniqueOrThrow({ where: { workspaceId } });
        await tx.taxConfig.update({ where: { workspaceId }, data: { rpsNextNumber: c.rpsNextNumber + 1 } });
        return { rpsSerie: c.rpsSerie, rpsNumber: c.rpsNextNumber };
      });
    }
    await this.prisma.nfseRecord.update({
      where: { id },
      data: {
        ...rps, serie: rps.rpsSerie, status: 'QUEUED', nextAttemptAt: new Date(), rejectionReason: null, retryCount: 0,
        takerDocument: doc, takerName: contact?.name ?? n.takerName, takerEmail: contact?.email ?? n.takerEmail, takerType: takerKind(doc),
      },
    });
    await this.processOne(id);
    return this.get(workspaceId, id);
  }

  // ── Processamento (fila) ─────────────────────────────────

  private async context(workspaceId: string): Promise<{ ctx: NfseProviderContext; cfg: Awaited<ReturnType<NfseConfigService['raw']>> }> {
    const cfg = await this.config.raw(workspaceId);
    const rd = this.config.readiness(cfg);
    if (!rd.ready) throw new BadRequestException(`Configuração fiscal incompleta: ${rd.missing.join(', ')}.`);
    return {
      cfg,
      ctx: {
        environment: cfg.nfseEnvironment === 'PRODUCTION' ? 'PRODUCTION' : 'HOMOLOG',
        wsUrl: this.config.wsUrl(cfg)!,
        soapNamespace: cfg.nfseSoapNamespace,
        certificate: this.config.loadCertificate(cfg),
        prestador: { cnpj: cfg.cnpj!, inscricaoMunicipal: cfg.inscricaoMunicipal!, codigoMunicipio: cfg.codigoMunicipioIbge },
      },
    };
  }

  /** Processa uma nota da fila. Nunca lança: o resultado fica gravado no registro. */
  async processOne(id: string): Promise<void> {
    const claim = await this.prisma.nfseRecord.updateMany({
      where: { id, status: 'QUEUED' },
      data: { status: 'PROCESSING', lastAttemptAt: new Date() },
    });
    if (claim.count !== 1) return;
    const n = await this.prisma.nfseRecord.findUniqueOrThrow({ where: { id } });
    const attempt = n.retryCount + 1;
    try {
      const { ctx, cfg } = await this.context(n.workspaceId);
      if (n.environment && n.environment !== ctx.environment) {
        return void await this.reject(id, `A nota foi pedida em ${n.environment === 'PRODUCTION' ? 'produção' : 'homologação'}, mas o ambiente mudou. Reenvie para usar o ambiente atual.`, true);
      }
      // depois de uma falha, primeiro confere se a prefeitura já gerou a nota
      if (n.retryCount > 0) {
        const found = await this.provider.consultByRps(ctx, n.rpsSerie!, n.rpsNumber!);
        if (found.kind === 'AUTHORIZED') return void await this.authorize(n.id, found, ctx.environment);
        if (found.kind === 'TRANSIENT') return void await this.transient(n.id, attempt, found.reason);
      }
      const contact = n.takerContactId
        ? await this.prisma.contact.findFirst({ where: { id: n.takerContactId, workspaceId: n.workspaceId }, select: { phone: true, street: true, number: true, complement: true, neighborhood: true, city: true, state: true, zipCode: true } })
        : null;
      const outcome = await this.provider.emit(ctx, this.rpsInput(n, cfg, contact as Record<string, string | null> | null));
      if (outcome.kind === 'AUTHORIZED') await this.authorize(n.id, outcome, ctx.environment);
      else if (outcome.kind === 'REJECTED') await this.reject(n.id, outcome.reason);
      else if (outcome.kind === 'TRANSIENT') await this.transient(n.id, attempt, outcome.reason);
      else await this.transient(n.id, attempt, 'Resposta inesperada da prefeitura.');
    } catch (err) {
      // configuração/certificado: não adianta tentar de novo sozinho
      await this.reject(id, (err as Error).message);
    }
  }

  private rpsInput(n: Prisma.NfseRecordGetPayload<object>, cfg: Awaited<ReturnType<NfseConfigService['raw']>>, contact: Record<string, string | null> | null): RpsInput {
    const ibge: Record<string, string> = { franca: '3516200', 'patrocinio paulista': '3536307' };
    const cityKey = (contact?.city ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const cod = ibge[cityKey];
    return {
      serie: n.rpsSerie!, numero: n.rpsNumber!,
      dataEmissao: ymd(new Date()), competencia: ymd(n.competence ?? n.createdAt),
      prestador: { cnpj: cfg.cnpj!, inscricaoMunicipal: cfg.inscricaoMunicipal! },
      tomador: {
        documento: n.takerDocument, nome: n.takerName, email: n.takerEmail, telefone: contact?.phone ?? null,
        endereco: cod ? { logradouro: contact?.street, numero: contact?.number, complemento: contact?.complement, bairro: contact?.neighborhood, codigoMunicipio: cod, uf: contact?.state ?? 'SP', cep: contact?.zipCode } : null,
      },
      servico: {
        valorServicos: num(n.baseAmount ?? n.amount), aliquotaPct: Number(n.issRate), valorIss: num(n.issDue ?? n.issAmount), issRetido: n.issRetained,
        valorPis: num(n.pisRetained), valorCofins: num(n.cofinsRetained), valorIr: num(n.irRetained), valorCsll: num(n.csllRetained),
        itemListaServico: cfg.itemListaServico!, codigoCnae: cfg.cnae, codigoTributacaoMunicipio: cfg.codigoTributacaoMunicipio,
        discriminacao: n.description, codigoMunicipio: cfg.codigoMunicipioIbge, exigibilidadeIss: cfg.exigibilidadeIss,
      },
      regimeEspecialTributacao: cfg.regimeEspecialTributacao, optanteSimples: cfg.optanteSimples, incentivoFiscal: cfg.incentivoFiscal,
    };
  }

  private async reject(id: string, reason: string, _envChanged = false) {
    await this.prisma.nfseRecord.update({
      where: { id },
      data: { status: 'REJECTED', rejectionReason: reason.slice(0, 4000), nextAttemptAt: null },
    });
    this.logger.warn(`NFS-e ${id} rejeitada`);
  }

  private async transient(id: string, attempt: number, reason: string) {
    if (attempt >= MAX_ATTEMPTS) {
      await this.prisma.nfseRecord.update({
        where: { id },
        data: { status: 'ERROR', retryCount: attempt, nextAttemptAt: null, rejectionReason: `Falha de comunicação depois de ${attempt} tentativas: ${reason} Use "Reenviar".` },
      });
      return;
    }
    await this.prisma.nfseRecord.update({
      where: { id },
      data: {
        status: 'QUEUED', retryCount: attempt, rejectionReason: `Tentativa ${attempt} sem sucesso: ${reason} Nova tentativa automática em ${BACKOFF_MIN[attempt - 1]} min.`,
        nextAttemptAt: new Date(Date.now() + BACKOFF_MIN[attempt - 1] * 60_000),
      },
    });
  }

  private async authorize(id: string, r: { numero: string; codigoVerificacao?: string; dataEmissao?: string; xml: string }, environment: string) {
    const n = await this.prisma.nfseRecord.findUniqueOrThrow({ where: { id } });
    const cfg = await this.config.raw(n.workspaceId);
    const issuedAt = r.dataEmissao && !Number.isNaN(Date.parse(r.dataEmissao)) ? new Date(r.dataEmissao) : new Date();
    const xmlBuf = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>${r.xml}`, 'utf-8');
    const xmlFile = await this.files.storeGenerated(n.workspaceId, xmlBuf, `nfse-${r.numero}.xml`, 'application/xml');
    const pdfBuf = await buildNfsePdf({
      environment, numero: r.numero, codigoVerificacao: r.codigoVerificacao, dataEmissao: issuedAt,
      rps: `${n.rpsSerie}-${n.rpsNumber}`,
      prestador: { nome: cfg.razaoSocial ?? 'Prestador', cnpj: cfg.cnpj ?? '', inscricaoMunicipal: cfg.inscricaoMunicipal ?? '', municipio: cfg.municipio ?? 'Franca' },
      tomador: { nome: n.takerName, documento: n.takerDocument, email: n.takerEmail },
      discriminacao: n.description, itemListaServico: n.serviceCode,
      valores: {
        servicos: num(n.baseAmount ?? n.amount), issAliquota: Number(n.issRate), iss: num(n.issDue ?? n.issAmount), issRetido: n.issRetained,
        ir: num(n.irRetained), pis: num(n.pisRetained), cofins: num(n.cofinsRetained), csll: num(n.csllRetained),
        issRetidoValor: num(n.issRetainedAmount), totalRetido: num(n.totalRetained), liquido: num(n.netAmount ?? n.amount),
      },
      portalUrl: PORTAL_URL,
    });
    const pdfFile = await this.files.storeGenerated(n.workspaceId, pdfBuf, `nfse-${r.numero}.pdf`, 'application/pdf');

    // retenções: a conta passa a esperar só o valor líquido
    let retentionPaymentId: string | null = null;
    let retentionWarning: string | null = null;
    if (num(n.totalRetained) > 0 && n.financialEntryId) {
      try {
        const p = await this.payments.registerRetention(n.workspaceId, n.financialEntryId, num(n.totalRetained), `Retenções na fonte da NFS-e nº ${r.numero}`);
        retentionPaymentId = p.id;
      } catch (e) {
        retentionWarning = `Retenções não lançadas na conta: ${(e as Error).message} Confira com o contador.`;
      }
    }
    await this.prisma.nfseRecord.update({
      where: { id },
      data: {
        status: 'AUTHORIZED', number: r.numero, verificationCode: r.codigoVerificacao ?? null, issuedAt,
        xmlFileId: xmlFile.id, pdfFileId: pdfFile.id, rejectionReason: null, nextAttemptAt: null,
        retentionPaymentId, retentionWarning,
      },
    });
    this.logger.log(`NFS-e ${id} autorizada (nº ${r.numero}, ${environment})`);
  }

  /** Rotina da fila: a cada minuto processa o que venceu e dispara as emissões automáticas. */
  @Cron('*/1 * * * *', { name: 'nfse-queue' })
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      // PROCESSING preso há mais de 10 min (servidor reiniciou no meio): volta para a fila
      await this.prisma.nfseRecord.updateMany({
        where: { status: 'PROCESSING', lastAttemptAt: { lt: new Date(Date.now() - 10 * 60_000) } },
        data: { status: 'QUEUED', nextAttemptAt: new Date(), retryCount: { increment: 1 } },
      });
      await this.autoEnqueue();
      const due = await this.prisma.nfseRecord.findMany({
        where: { status: 'QUEUED', deletedAt: null, nextAttemptAt: { lte: new Date() } }, select: { id: true }, take: 20, orderBy: { nextAttemptAt: 'asc' },
      });
      for (const d of due) await this.processOne(d.id);
    } catch (e) {
      this.logger.error(`Fila de NFS-e: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /** Emissão automática: comissões recebidas depois que a opção foi ligada. */
  async autoEnqueue() {
    const configs = await this.prisma.taxConfig.findMany({ where: { autoIssueOnReceipt: true, autoIssueSince: { not: null } } });
    for (const cfg of configs) {
      if (!this.config.readiness(cfg).ready) continue;
      const entries = await this.prisma.financialEntry.findMany({
        where: {
          workspaceId: cfg.workspaceId, deletedAt: null, type: 'RECEIVABLE', category: 'COMMISSION', status: 'PAID',
          paidAt: { gte: cfg.autoIssueSince! },
        },
        select: { id: true }, take: 50,
      });
      for (const e of entries) {
        const has = await this.prisma.nfseRecord.findFirst({ where: { workspaceId: cfg.workspaceId, financialEntryId: e.id, deletedAt: null }, select: { id: true } });
        if (has) continue;
        try {
          await this.requestForEntry(cfg.workspaceId, e.id, {}, undefined, { auto: true, processNow: false });
        } catch (err) {
          // deixa o problema visível na tela de notas (ex.: tomador sem CPF/CNPJ)
          await this.prisma.nfseRecord.create({
            data: {
              workspaceId: cfg.workspaceId, financialEntryId: e.id, provider: this.provider.name, environment: cfg.nfseEnvironment,
              issuerCnpj: cfg.cnpj ?? '', takerDocument: '', takerName: '—', serviceCode: cfg.itemListaServico ?? '',
              description: 'Emissão automática não realizada', amount: 0, issRate: 0, issAmount: 0, status: 'REJECTED', autoIssued: true,
              rejectionReason: `Emissão automática: ${(err as Error).message}`,
            },
          });
        }
      }
    }
  }

  // ── Cancelamento ─────────────────────────────────────────

  async cancel(workspaceId: string, id: string, reason: string, code: string) {
    const why = reason?.trim();
    if (!why) throw new BadRequestException('Informe o motivo do cancelamento.');
    if (!CANCEL_CODES[code]) throw new BadRequestException('Escolha o motivo oficial: 1 (erro na emissão), 2 (serviço não prestado) ou 4 (duplicidade).');
    const n = await this.prisma.nfseRecord.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!n) throw new NotFoundException('Nota fiscal não encontrada.');
    if (n.status === 'CANCELLED') throw new BadRequestException('Esta nota já está cancelada.');
    if (n.status === 'QUEUED' || n.status === 'REJECTED' || n.status === 'ERROR') {
      // ainda não existe na prefeitura: só encerra aqui
      await this.prisma.nfseRecord.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: why, nextAttemptAt: null } });
      return this.get(workspaceId, id);
    }
    if (n.status !== 'AUTHORIZED' || !n.number) throw new BadRequestException('Só notas autorizadas podem ser canceladas na prefeitura.');
    const { ctx } = await this.context(workspaceId);
    if ((n.environment ?? 'HOMOLOG') !== ctx.environment) throw new BadRequestException('A nota é de outro ambiente (homologação/produção) do que o configurado agora.');
    const r = await this.provider.cancel(ctx, n.number, code);
    if (!r.ok) throw new BadRequestException(`A prefeitura não cancelou a nota: ${r.reason}`);
    await this.prisma.nfseRecord.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: why, cancelCode: code } });
    if (n.retentionPaymentId) {
      try {
        await this.payments.reverse(workspaceId, n.retentionPaymentId, `NFS-e nº ${n.number} cancelada: ${why}`);
      } catch (e) {
        await this.prisma.nfseRecord.update({ where: { id }, data: { retentionWarning: `Nota cancelada, mas a retenção não foi estornada na conta: ${(e as Error).message}` } });
      }
    }
    return this.get(workspaceId, id);
  }

  // ── E-mail ao tomador ─────────────────────────────────────

  async sendEmail(workspaceId: string, id: string, to?: string) {
    const n = await this.prisma.nfseRecord.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!n) throw new NotFoundException('Nota fiscal não encontrada.');
    if (n.status !== 'AUTHORIZED' || !n.xmlFileId || !n.pdfFileId) throw new BadRequestException('Só notas autorizadas podem ser enviadas.');
    const dest = (to ?? n.takerEmail ?? '').trim();
    if (!dest || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dest)) throw new BadRequestException('O tomador não tem e-mail válido cadastrado.');
    const [xml, pdf] = await Promise.all([this.files.read(workspaceId, n.xmlFileId), this.files.read(workspaceId, n.pdfFileId)]);
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } });
    await this.email.sendEmail(workspaceId, {
      to: dest,
      subject: `${ws?.name ?? 'Imobiliária'} — NFS-e nº ${n.number}`,
      body: `<p>Olá, ${n.takerName}.</p><p>Segue a nota fiscal de serviço nº <b>${n.number}</b> (código de verificação ${n.verificationCode ?? '—'}), em PDF e XML.</p>`
        + `<p>Consulte a autenticidade no portal da Prefeitura de Franca: ${PORTAL_URL}</p><p>${ws?.name ?? ''}</p>`,
      attachments: [
        { filename: pdf.fileName, content: pdf.data, contentType: 'application/pdf' },
        { filename: xml.fileName, content: xml.data, contentType: 'application/xml' },
      ],
    } as never);
    await this.prisma.nfseRecord.update({ where: { id }, data: { emailedAt: new Date(), takerEmail: dest } });
    return { sent: true, to: dest };
  }

  // ── Relatório do contador ─────────────────────────────────

  async monthlyReport(workspaceId: string, month: string) {
    if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('Informe o mês no formato AAAA-MM.');
    const [y, m] = month.split('-').map(Number);
    const from = new Date(Date.UTC(y, m - 1, 1));
    const to = new Date(Date.UTC(y, m, 1));
    const cfg = await this.config.raw(workspaceId);
    const notes = await this.prisma.nfseRecord.findMany({
      where: { workspaceId, deletedAt: null, status: { in: ['AUTHORIZED', 'ISSUED', 'CANCELLED'] }, issuedAt: { gte: from, lt: to } },
      orderBy: { issuedAt: 'asc' }, select: this.listSelect,
    });
    const valid = notes.filter((n) => n.status !== 'CANCELLED');
    const sum = (k: keyof typeof valid[number]) => Math.round(valid.reduce((s, n) => s + num(n[k] ?? (k === 'baseAmount' ? n.amount : 0)), 0) * 100) / 100;
    const base = sum('baseAmount');
    const est = (pctA: number, pctB = 100) => Math.round(base * (pctB / 100) * (pctA / 100) * 100) / 100;
    return {
      month, environment: cfg.nfseEnvironment, regime: cfg.regime,
      notes: notes.map((n) => this.present(n)),
      totals: {
        count: valid.length, cancelled: notes.length - valid.length,
        base, issDue: sum('issDue'), issRetained: sum('issRetainedAmount'), irRetained: sum('irRetained'), pisRetained: sum('pisRetained'),
        cofinsRetained: sum('cofinsRetained'), csllRetained: sum('csllRetained'), totalRetained: sum('totalRetained'), net: sum('netAmount'),
      },
      // estimativa (Lucro Presumido) a partir das alíquotas configuradas — confirmar com o contador
      estimate: {
        pis: est(cfg.aliquotaPIS), cofins: est(cfg.aliquotaCOFINS),
        irpj: est(cfg.aliquotaIRPJ, cfg.presumidoIRPJ), csll: est(cfg.aliquotaCSLL, cfg.presumidoCSLL),
        rates: { pis: cfg.aliquotaPIS, cofins: cfg.aliquotaCOFINS, irpj: cfg.aliquotaIRPJ, csll: cfg.aliquotaCSLL, presumidoIRPJ: cfg.presumidoIRPJ, presumidoCSLL: cfg.presumidoCSLL },
      },
    };
  }

  async monthlyReportXlsx(workspaceId: string, month: string): Promise<Buffer> {
    const r = await this.monthlyReport(workspaceId, month);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Estou em Casa';
    const ws = wb.addWorksheet(`NFS-e ${month}`);
    ws.addRow([`Notas fiscais de serviço — ${month}${r.environment !== 'PRODUCTION' ? ' (HOMOLOGAÇÃO — sem valor fiscal)' : ''}`]).font = { bold: true, size: 13 };
    ws.addRow([]);
    ws.addRow(['Número', 'Emissão', 'Situação', 'Tomador', 'CPF/CNPJ', 'Base de cálculo', 'Alíq. ISS %', 'ISS', 'ISS retido', 'IR retido', 'PIS retido', 'COFINS retido', 'CSLL retido', 'Total retido', 'Líquido']).font = { bold: true };
    for (const n of r.notes) {
      ws.addRow([n.number, n.issuedAt ? new Date(n.issuedAt).toLocaleDateString('pt-BR') : '', n.statusLabel, n.takerName, n.takerDocument,
        num(n.baseAmount ?? n.amount), Number(n.issRate), num(n.issDue ?? n.issAmount), num(n.issRetainedAmount), num(n.irRetained), num(n.pisRetained),
        num(n.cofinsRetained), num(n.csllRetained), num(n.totalRetained), num(n.netAmount ?? n.amount)]);
    }
    const t = r.totals;
    ws.addRow(['Totais (sem canceladas)', '', `${t.count} nota(s)`, '', '', t.base, '', t.issDue, t.issRetained, t.irRetained, t.pisRetained, t.cofinsRetained, t.csllRetained, t.totalRetained, t.net]).font = { bold: true };
    ws.addRow([]);
    ws.addRow(['Estimativa de tributos do mês (Lucro Presumido, alíquotas configuradas) — confirmar com o contador']).font = { bold: true };
    ws.addRow(['PIS', r.estimate.pis]); ws.addRow(['COFINS', r.estimate.cofins]);
    ws.addRow(['IRPJ (base presumida)', r.estimate.irpj]); ws.addRow(['CSLL (base presumida)', r.estimate.csll]);
    ws.columns.forEach((c, i) => { c.width = i === 3 ? 32 : 14; if (i >= 5) c.numFmt = '#,##0.00'; });
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
