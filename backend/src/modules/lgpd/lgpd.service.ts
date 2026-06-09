// Serviço LGPD - conformidade com a Lei Geral de Proteção de Dados
// Implementa: consentimento, direitos dos titulares, anonimização e incidentes

import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  RecordConsentDto,
  WithdrawConsentDto,
  CreateLgpdRequestDto,
  UpdateLgpdRequestDto,
  CreatePrivacyPolicyDto,
  CreateSecurityIncidentDto,
} from './lgpd.dto';

@Injectable()
export class LgpdService {
  private readonly logger = new Logger(LgpdService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // -----------------------------------------------
  // CONSENTIMENTOS
  // -----------------------------------------------

  // Registra consentimento do titular com timestamp e IP
  async recordConsent(workspaceId: string, userId: string, dto: RecordConsentDto) {
    // Verifica se a versão da política existe
    const policy = await this.prisma.privacyPolicy.findFirst({
      where: { id: dto.policyVersionId, workspaceId },
    });
    if (!policy) throw new NotFoundException('Versão de política de privacidade não encontrada.');

    // Verifica se já existe consentimento ativo
    const existing = await this.prisma.lgpdConsent.findFirst({
      where: {
        workspaceId,
        subjectEmail: dto.subjectEmail,
        policyVersionId: dto.policyVersionId,
        withdrawnAt: null,
      },
    });
    if (existing) throw new ConflictException('Já existe consentimento ativo para este e-mail e versão de política.');

    const consent = await this.prisma.lgpdConsent.create({
      data: {
        workspaceId,
        subjectEmail: dto.subjectEmail,
        subjectName: dto.subjectName,
        policyVersionId: dto.policyVersionId,
        consentedAt: new Date(),
        ipAddress: dto.ipAddress,
        consentText: dto.consentText,
      },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'LGPD_CONSENT_RECORDED',
      entity: 'LgpdConsent',
      entityId: consent.id,
      after: { subjectEmail: dto.subjectEmail, policyVersionId: dto.policyVersionId },
    });

    return consent;
  }

  // Retira consentimento do titular
  async withdrawConsent(workspaceId: string, userId: string, dto: WithdrawConsentDto) {
    const consents = await this.prisma.lgpdConsent.findMany({
      where: {
        workspaceId,
        subjectEmail: dto.subjectEmail,
        withdrawnAt: null,
      },
    });

    if (consents.length === 0) {
      throw new NotFoundException('Nenhum consentimento ativo encontrado para este e-mail.');
    }

    // Marca todos os consentimentos ativos como retirados
    await this.prisma.lgpdConsent.updateMany({
      where: {
        workspaceId,
        subjectEmail: dto.subjectEmail,
        withdrawnAt: null,
      },
      data: { withdrawnAt: new Date() },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'LGPD_CONSENT_WITHDRAWN',
      entity: 'LgpdConsent',
      after: { subjectEmail: dto.subjectEmail, count: consents.length },
    });

    return { withdrawnCount: consents.length };
  }

  // Lista consentimentos do workspace
  async listConsents(workspaceId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.lgpdConsent.findMany({
        where: { workspaceId },
        include: { policyVersion: { select: { version: true } } },
        orderBy: { consentedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.lgpdConsent.count({ where: { workspaceId } }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // -----------------------------------------------
  // REQUISIÇÕES DOS TITULARES (art. 18 LGPD)
  // -----------------------------------------------

  // Cria nova requisição de direito do titular
  async createRequest(workspaceId: string, dto: CreateLgpdRequestDto) {
    const request = await this.prisma.lgpdRequest.create({
      data: {
        workspaceId,
        type: dto.type,
        subjectEmail: dto.subjectEmail,
        subjectName: dto.subjectName,
        status: 'PENDING',
      },
    });

    await this.auditService.log({
      workspaceId,
      action: 'LGPD_REQUEST_CREATED',
      entity: 'LgpdRequest',
      entityId: request.id,
      after: { type: dto.type, subjectEmail: dto.subjectEmail },
    });

    this.logger.log(
      `Nova requisição LGPD [${dto.type}] para ${dto.subjectEmail} no workspace ${workspaceId}`,
    );

    return request;
  }

  // Atualiza status da requisição
  async updateRequest(
    workspaceId: string,
    requestId: string,
    userId: string,
    dto: UpdateLgpdRequestDto,
  ) {
    const request = await this.prisma.lgpdRequest.findFirst({
      where: { id: requestId, workspaceId },
    });
    if (!request) throw new NotFoundException('Requisição LGPD não encontrada.');

    const updated = await this.prisma.lgpdRequest.update({
      where: { id: requestId },
      data: {
        status: dto.status,
        notes: dto.notes,
        completedAt: dto.status === 'COMPLETED' ? new Date() : undefined,
      },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'LGPD_REQUEST_UPDATED',
      entity: 'LgpdRequest',
      entityId: requestId,
      before: { status: request.status },
      after: { status: dto.status },
    });

    return updated;
  }

  // Lista requisições do workspace
  async listRequests(workspaceId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.lgpdRequest.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.lgpdRequest.count({ where: { workspaceId } }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // -----------------------------------------------
  // EXPORTAÇÃO DE DADOS DO TITULAR (direito de acesso)
  // Agrega todos os dados do titular no workspace
  // -----------------------------------------------
  async exportSubjectData(workspaceId: string, subjectEmail: string) {
    this.logger.log(`Exportando dados de ${subjectEmail} para workspace ${workspaceId}`);

    // Agrega dados do titular de todas as tabelas relevantes
    const [consents, requests] = await Promise.all([
      this.prisma.lgpdConsent.findMany({
        where: { workspaceId, subjectEmail },
        include: { policyVersion: { select: { version: true, effectiveAt: true } } },
      }),
      this.prisma.lgpdRequest.findMany({
        where: { workspaceId, subjectEmail },
      }),
    ]);

    return {
      subjectEmail,
      exportedAt: new Date().toISOString(),
      workspaceId,
      data: {
        consents: consents.map((c) => ({
          id: c.id,
          consentedAt: c.consentedAt,
          withdrawnAt: c.withdrawnAt,
          policyVersion: c.policyVersion.version,
          consentText: c.consentText,
        })),
        requests: requests.map((r) => ({
          id: r.id,
          type: r.type,
          status: r.status,
          createdAt: r.createdAt,
          completedAt: r.completedAt,
        })),
      },
    };
  }

  // -----------------------------------------------
  // ANONIMIZAÇÃO DE DADOS (direito ao esquecimento)
  // Substitui dados pessoais por hashes irreversíveis SHA-256
  // -----------------------------------------------
  async anonymizeSubjectData(workspaceId: string, subjectEmail: string, userId: string) {
    this.logger.warn(
      `ANONIMIZAÇÃO: Iniciando para ${subjectEmail} no workspace ${workspaceId}`,
    );

    // Hash SHA-256 irreversível dos dados identificadores
    const hashEmail = crypto
      .createHash('sha256')
      .update(subjectEmail.toLowerCase())
      .digest('hex');

    // Anonimiza consentimentos
    await this.prisma.lgpdConsent.updateMany({
      where: { workspaceId, subjectEmail },
      data: {
        subjectEmail: `anon_${hashEmail.substring(0, 16)}@deletado.local`,
        subjectName: 'Titular Excluído',
        ipAddress: null,
      },
    });

    // Anonimiza requisições LGPD
    await this.prisma.lgpdRequest.updateMany({
      where: { workspaceId, subjectEmail },
      data: {
        subjectEmail: `anon_${hashEmail.substring(0, 16)}@deletado.local`,
        subjectName: 'Titular Excluído',
      },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'LGPD_DATA_ANONYMIZED',
      entity: 'LgpdConsent',
      after: {
        subjectEmailHash: hashEmail.substring(0, 16),
        timestamp: new Date().toISOString(),
      },
    });

    this.logger.warn(
      `ANONIMIZAÇÃO: Concluída para titular com hash ${hashEmail.substring(0, 16)}`,
    );

    return {
      anonymized: true,
      subjectEmailHash: hashEmail.substring(0, 16),
      timestamp: new Date().toISOString(),
    };
  }

  // -----------------------------------------------
  // POLÍTICAS DE PRIVACIDADE
  // -----------------------------------------------

  // Cria nova versão da política de privacidade
  async createPrivacyPolicy(workspaceId: string, userId: string, dto: CreatePrivacyPolicyDto) {
    const existing = await this.prisma.privacyPolicy.findFirst({
      where: { workspaceId, version: dto.version },
    });
    if (existing) throw new ConflictException('Já existe uma política com esta versão.');

    const policy = await this.prisma.privacyPolicy.create({
      data: {
        workspaceId,
        version: dto.version,
        content: dto.content,
        effectiveAt: new Date(dto.effectiveAt),
      },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'PRIVACY_POLICY_CREATED',
      entity: 'PrivacyPolicy',
      entityId: policy.id,
      after: { version: dto.version, effectiveAt: dto.effectiveAt },
    });

    return policy;
  }

  // Lista políticas de privacidade
  async listPrivacyPolicies(workspaceId: string) {
    return this.prisma.privacyPolicy.findMany({
      where: { workspaceId },
      select: {
        id: true,
        version: true,
        effectiveAt: true,
        createdAt: true,
        _count: { select: { consents: true } },
      },
      orderBy: { effectiveAt: 'desc' },
    });
  }

  // Busca política de privacidade por ID
  async getPrivacyPolicy(workspaceId: string, policyId: string) {
    const policy = await this.prisma.privacyPolicy.findFirst({
      where: { id: policyId, workspaceId },
    });
    if (!policy) throw new NotFoundException('Política de privacidade não encontrada.');
    return policy;
  }

  // -----------------------------------------------
  // INCIDENTES DE SEGURANÇA
  // -----------------------------------------------

  // Registra incidente de segurança
  async createIncident(workspaceId: string, userId: string, dto: CreateSecurityIncidentDto) {
    const incident = await this.prisma.securityIncident.create({
      data: {
        workspaceId,
        ...dto,
        status: 'OPEN',
      },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'SECURITY_INCIDENT_CREATED',
      entity: 'SecurityIncident',
      entityId: incident.id,
      after: { title: dto.title, severity: dto.severity },
    });

    this.logger.warn(
      `INCIDENTE DE SEGURANÇA [${dto.severity}]: ${dto.title} - Workspace: ${workspaceId}`,
    );

    return incident;
  }

  // Lista incidentes do workspace
  async listIncidents(workspaceId: string) {
    return this.prisma.securityIncident.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
