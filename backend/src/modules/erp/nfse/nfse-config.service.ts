// Fase 6 — configuração fiscal da NFS-e por imobiliária: dados do prestador,
// regime (padrão LUCRO PRESUMIDO), código de serviço, alíquotas (todas
// editáveis em tela), retenções, série/numeração do RPS, ambiente
// (homologação/produção) e certificado digital A1 criptografado.
//
// Notas reais (produção) só depois que o dono autorizar explicitamente.

import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../../security/encryption.service';
import { loadPfx, type LoadedCertificate } from './xml-signer';
import { SIL_FRANCA_PRODUCTION_URL } from './nfse-provider';
import type { NfseTaxConfig } from './nfse-tax';
import { IssuerService } from '../../issuer/issuer.service';

export const FRANCA_IBGE = '3516200';

export interface SaveNfseConfig {
  regime?: string;
  razaoSocial?: string;
  cnpj?: string;
  inscricaoMunicipal?: string;
  itemListaServico?: string;
  codigoTributacaoMunicipio?: string;
  cnae?: string;
  exigibilidadeIss?: number;
  regimeEspecialTributacao?: number | null;
  optanteSimples?: boolean;
  incentivoFiscal?: boolean;
  aliquotaISS?: number;
  aliquotaPIS?: number;
  aliquotaCOFINS?: number;
  aliquotaIRPJ?: number;
  aliquotaCSLL?: number;
  presumidoIRPJ?: number;
  presumidoCSLL?: number;
  retentionsEnabled?: boolean;
  retIrPct?: number;
  retPisPct?: number;
  retCofinsPct?: number;
  retCsllPct?: number;
  retMinAmount?: number;
  retainIssWhenPj?: boolean;
  autoIssueOnReceipt?: boolean;
  rpsSerie?: string;
  rpsNextNumber?: number;
  nfseEnvironment?: 'HOMOLOG' | 'PRODUCTION';
  nfseWsUrlHomolog?: string;
  nfseWsUrlProd?: string;
  nfseSoapNamespace?: string;
}

const PCT_FIELDS = ['aliquotaISS', 'aliquotaPIS', 'aliquotaCOFINS', 'aliquotaIRPJ', 'aliquotaCSLL', 'presumidoIRPJ', 'presumidoCSLL',
  'retIrPct', 'retPisPct', 'retCofinsPct', 'retCsllPct'] as const;

@Injectable()
export class NfseConfigService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private issuer: IssuerService,
  ) {}

  /** Configuração (cria com LUCRO PRESUMIDO e Franca se ainda não existir). */
  async raw(workspaceId: string) {
    return this.prisma.taxConfig.upsert({
      where: { workspaceId },
      create: { workspaceId, regime: 'LUCRO_PRESUMIDO', municipio: 'Franca', codigoMunicipioIbge: FRANCA_IBGE, nfseProvider: 'SIL_ABRASF24' },
      update: {},
    });
  }

  /** Para a tela: nunca devolve o certificado nem a senha. */
  async get(workspaceId: string) {
    const c = await this.raw(workspaceId);
    const legal = await this.issuer.getCurrent(workspaceId);
    const { certPfxEnc, certPasswordEnc, nfseLogin, nfsePassword, ...rest } = c;
    return {
      ...rest,
      cnpj: legal.cnpj ?? rest.cnpj,
      razaoSocial: legal.razaoSocial ?? rest.razaoSocial,
      hasCertificate: !!certPfxEnc,
      certificateExpired: !!c.certValidUntil && c.certValidUntil < new Date(),
      effectiveWsUrl: this.wsUrl(c),
      readiness: this.readiness(c),
    };
  }

  async save(workspaceId: string, dto: SaveNfseConfig, userId?: string) {
    const current = await this.raw(workspaceId);
    // CNPJ/razão social são do histórico da empresa: aqui só se preenche quando
    // estão vazios (trocar é em Workspace → Dados da empresa). Demais dados
    // legais (inscrição municipal, regime) seguem para o registro vigente.
    const legal = await this.issuer.updateDetails(workspaceId, userId, {
      cnpj: dto.cnpj, razaoSocial: dto.razaoSocial, inscricaoMunicipal: dto.inscricaoMunicipal, regimeTributario: dto.regime ?? current.regime,
    });
    for (const f of PCT_FIELDS) {
      const v = dto[f];
      if (v !== undefined && (typeof v !== 'number' || v < 0 || v > 100)) throw new BadRequestException(`Percentual inválido em ${f}.`);
    }
    if (dto.aliquotaISS !== undefined && dto.aliquotaISS > 5) throw new BadRequestException('A alíquota de ISS vai de 0% a 5%.');
    if (dto.retMinAmount !== undefined && dto.retMinAmount < 0) throw new BadRequestException('Valor mínimo de retenção inválido.');
    if (dto.rpsNextNumber !== undefined) {
      if (!Number.isInteger(dto.rpsNextNumber) || dto.rpsNextNumber < 1) throw new BadRequestException('Próximo número de RPS inválido.');
      const used = await this.prisma.nfseRecord.aggregate({
        where: { workspaceId, rpsSerie: dto.rpsSerie ?? current.rpsSerie, rpsNumber: { not: null } }, _max: { rpsNumber: true },
      });
      if ((used._max.rpsNumber ?? 0) >= dto.rpsNextNumber) {
        throw new BadRequestException(`O RPS ${used._max.rpsNumber} já foi usado nesta série: o próximo número precisa ser maior.`);
      }
    }
    for (const u of [dto.nfseWsUrlHomolog, dto.nfseWsUrlProd]) {
      // http só para o servidor simulado dos testes automáticos (fora de produção)
      const localTest = process.env.NODE_ENV !== 'production' && /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u ?? '');
      if (u && !/^https:\/\//.test(u) && !localTest) throw new BadRequestException('O endereço do webservice precisa começar com https://');
    }
    if (dto.nfseEnvironment === 'PRODUCTION' && !current.productionAuthorizedAt) {
      throw new BadRequestException('Produção (notas reais) só pode ser ligada pelo botão "Autorizar notas reais", depois dos testes em homologação.');
    }
    const digits = (v?: string) => (v === undefined ? undefined : v.replace(/\D/g, '') || null);
    await this.prisma.taxConfig.update({
      where: { workspaceId },
      data: {
        ...dto,
        cnpj: legal.cnpj ?? digits(dto.cnpj) ?? undefined,
        razaoSocial: legal.razaoSocial ?? dto.razaoSocial,
        autoIssueSince: dto.autoIssueOnReceipt && !current.autoIssueOnReceipt ? new Date() : undefined,
      },
    });
    return this.get(workspaceId);
  }

  async uploadCertificate(workspaceId: string, pfx: Buffer | undefined, password: string) {
    if (!pfx?.length) throw new BadRequestException('Envie o arquivo do certificado (.pfx ou .p12).');
    if (pfx.length > 50_000) throw new BadRequestException('Arquivo grande demais para um certificado A1.');
    if (!password) throw new BadRequestException('Informe a senha do certificado.');
    let cert: LoadedCertificate;
    try {
      cert = loadPfx(pfx, password);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    if (cert.validUntil < new Date()) throw new BadRequestException(`Certificado vencido em ${cert.validUntil.toLocaleDateString('pt-BR')}.`);
    const config = await this.raw(workspaceId);
    if (config.cnpj && cert.cnpj && cert.cnpj !== config.cnpj) {
      throw new BadRequestException(`O certificado é do CNPJ ${cert.cnpj}, diferente do CNPJ cadastrado (${config.cnpj}).`);
    }
    await this.prisma.taxConfig.update({
      where: { workspaceId },
      data: {
        certPfxEnc: this.encryption.encrypt(pfx.toString('base64')),
        certPasswordEnc: this.encryption.encrypt(password),
        certSubject: cert.subject,
        certValidUntil: cert.validUntil,
        ...(!config.cnpj && cert.cnpj && { cnpj: cert.cnpj }),
      },
    });
    if (!config.cnpj && cert.cnpj) await this.issuer.updateDetails(workspaceId, undefined, { cnpj: cert.cnpj });
    return this.get(workspaceId);
  }

  async removeCertificate(workspaceId: string) {
    await this.raw(workspaceId);
    await this.prisma.taxConfig.update({
      where: { workspaceId },
      data: { certPfxEnc: null, certPasswordEnc: null, certSubject: null, certValidUntil: null },
    });
    return this.get(workspaceId);
  }

  /** O dono autoriza notas reais (produção). Fica registrado quem e quando. */
  async authorizeProduction(workspaceId: string, userId: string, confirm: string) {
    if (confirm !== 'AUTORIZO NOTAS REAIS') {
      throw new BadRequestException('Para ligar notas reais, digite exatamente: AUTORIZO NOTAS REAIS');
    }
    const c = await this.raw(workspaceId);
    const homologOk = await this.prisma.nfseRecord.count({ where: { workspaceId, environment: 'HOMOLOG', status: 'AUTHORIZED' } });
    if (!homologOk) throw new BadRequestException('Antes de autorizar notas reais, emita pelo menos uma nota de teste autorizada em homologação.');
    const missing = this.readiness({ ...c, nfseEnvironment: 'PRODUCTION' }).missing;
    if (missing.length) throw new BadRequestException(`Configuração incompleta: ${missing.join(', ')}.`);
    await this.prisma.taxConfig.update({
      where: { workspaceId },
      data: { productionAuthorizedAt: new Date(), productionAuthorizedById: userId, nfseEnvironment: 'PRODUCTION' },
    });
    return this.get(workspaceId);
  }

  /** Volta para homologação (sempre permitido). */
  async backToHomolog(workspaceId: string) {
    await this.raw(workspaceId);
    await this.prisma.taxConfig.update({ where: { workspaceId }, data: { nfseEnvironment: 'HOMOLOG', productionAuthorizedAt: null, productionAuthorizedById: null } });
    return this.get(workspaceId);
  }

  wsUrl(c: { nfseEnvironment: string; nfseWsUrlHomolog: string | null; nfseWsUrlProd: string | null }): string | null {
    return c.nfseEnvironment === 'PRODUCTION' ? c.nfseWsUrlProd || SIL_FRANCA_PRODUCTION_URL : c.nfseWsUrlHomolog || null;
  }

  /** O que falta para emitir no ambiente atual. */
  readiness(c: {
    cnpj: string | null; inscricaoMunicipal: string | null; itemListaServico: string | null; certPfxEnc: string | null;
    certValidUntil: Date | null; nfseEnvironment: string; nfseWsUrlHomolog: string | null; nfseWsUrlProd: string | null; razaoSocial?: string | null;
  }) {
    const missing: string[] = [];
    if (!c.cnpj) missing.push('CNPJ');
    if (!c.inscricaoMunicipal) missing.push('inscrição municipal');
    if (!c.itemListaServico) missing.push('código do serviço (item da LC 116)');
    if (!c.certPfxEnc) missing.push('certificado digital A1');
    else if (c.certValidUntil && c.certValidUntil < new Date()) missing.push('certificado digital válido (o atual venceu)');
    if (!this.wsUrl(c)) missing.push(c.nfseEnvironment === 'PRODUCTION' ? 'endereço do webservice de produção' : 'endereço do webservice de homologação da SIL');
    return { ready: missing.length === 0, missing };
  }

  /** Certificado aberto para assinar (só dentro do backend). */
  loadCertificate(c: { certPfxEnc: string | null; certPasswordEnc: string | null }): LoadedCertificate {
    if (!c.certPfxEnc || !c.certPasswordEnc) throw new BadRequestException('Certificado digital não cadastrado.');
    const pfx = Buffer.from(this.encryption.decrypt(c.certPfxEnc), 'base64');
    return loadPfx(pfx, this.encryption.decrypt(c.certPasswordEnc));
  }

  taxConfig(c: {
    aliquotaISS: number; retentionsEnabled: boolean; retIrPct: unknown; retPisPct: unknown; retCofinsPct: unknown; retCsllPct: unknown;
    retMinAmount: unknown; retainIssWhenPj: boolean;
  }): NfseTaxConfig {
    return {
      issRatePct: Number(c.aliquotaISS),
      retentionsEnabled: c.retentionsEnabled,
      retIrPct: Number(c.retIrPct), retPisPct: Number(c.retPisPct), retCofinsPct: Number(c.retCofinsPct), retCsllPct: Number(c.retCsllPct),
      retMinAmount: Number(c.retMinAmount),
      retainIssWhenPj: c.retainIssWhenPj,
    };
  }
}
