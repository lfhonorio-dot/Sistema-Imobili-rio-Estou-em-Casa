// Fase 7 — LGPD sobre o CADASTRO do cliente (antes só mexia nas tabelas de
// consentimento). Exportar = tudo o que o sistema tem sobre a pessoa.
// Anonimizar = apagar os dados pessoais, respeitando a guarda obrigatória:
// se a pessoa é parte de contrato, conta, nota fiscal ou DIMOB dos últimos
// 5 anos, nome e CPF/CNPJ ficam (obrigação legal/fiscal) e só o resto é apagado.

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const RETENTION_YEARS = 5;
const REMOVED = '[removido a pedido do titular]';

@Injectable()
export class LgpdContactService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private async contact(workspaceId: string, id: string) {
    const c = await this.prisma.contact.findFirst({ where: { id, workspaceId } });
    if (!c) throw new NotFoundException('Contato não encontrado.');
    return c;
  }

  async exportContact(workspaceId: string, contactId: string, userId: string) {
    const c = await this.contact(workspaceId, contactId);
    const [deals, visits, proposals, contracts, entries, activities, conversations, nfse, consents, interest] = await Promise.all([
      this.prisma.deal.findMany({ where: { workspaceId, contactId }, select: { id: true, title: true, value: true, createdAt: true, closedAt: true, stage: { select: { name: true } } } }),
      this.prisma.visit.findMany({ where: { workspaceId, contactId }, select: { id: true, scheduledAt: true, status: true, feedback: true, property: { select: { code: true } } } }),
      this.prisma.proposal.findMany({ where: { workspaceId, deal: { contactId } }, select: { id: true, amount: true, status: true, createdAt: true } }),
      this.prisma.contract.findMany({ where: { workspaceId, OR: [{ ownerId: contactId }, { tenantId: contactId }] }, select: { id: true, code: true, type: true, status: true, saleValue: true, createdAt: true } }),
      this.prisma.financialEntry.findMany({ where: { workspaceId, contactId }, select: { id: true, type: true, description: true, amount: true, dueDate: true, status: true } }),
      this.prisma.activity.findMany({ where: { workspaceId, contactId }, select: { id: true, type: true, title: true, content: true, dueAt: true, doneAt: true } }),
      this.prisma.conversation.findMany({ where: { workspaceId, contactId }, select: { id: true, channel: true, createdAt: true, messages: { select: { direction: true, body: true, createdAt: true }, orderBy: { createdAt: 'asc' } } } }),
      this.prisma.nfseRecord.findMany({ where: { workspaceId, takerContactId: contactId }, select: { id: true, number: true, issuedAt: true, amount: true, status: true } }),
      c.email ? this.prisma.lgpdConsent.findMany({ where: { workspaceId, subjectEmail: c.email }, select: { consentedAt: true, withdrawnAt: true, consentText: true } }) : [],
      this.prisma.contactInterestProfile.findFirst({ where: { contactId } }),
    ]);
    await this.audit.log({ workspaceId, userId, action: 'LGPD_CONTACT_EXPORTED', entity: 'Contact', entityId: contactId });
    const { workspaceId: _w, ...personal } = c;
    return {
      exportedAt: new Date().toISOString(),
      titular: personal,
      perfilDeInteresse: interest,
      negocios: deals, visitas: visits, propostas: proposals, contratos: contracts, lancamentosFinanceiros: entries,
      atividades: activities, conversas: conversations, notasFiscais: nfse, consentimentos: consents,
    };
  }

  /** O que a anonimização vai fazer (para a tela confirmar antes). */
  async anonymizePreview(workspaceId: string, contactId: string) {
    const c = await this.contact(workspaceId, contactId);
    const since = new Date(Date.now() - RETENTION_YEARS * 365 * 86_400_000);
    const [contracts, entries, nfse, dimob] = await Promise.all([
      this.prisma.contract.count({ where: { workspaceId, OR: [{ ownerId: contactId }, { tenantId: contactId }], createdAt: { gte: since } } }),
      this.prisma.financialEntry.count({ where: { workspaceId, contactId, createdAt: { gte: since }, deletedAt: null } }),
      this.prisma.nfseRecord.count({ where: { workspaceId, takerContactId: contactId, createdAt: { gte: since } } }),
      (c.cpf || c.cnpj)
        ? this.prisma.dimobRecord.count({ where: { workspaceId, deletedAt: null, year: { gte: new Date().getFullYear() - RETENTION_YEARS }, OR: [{ locadorDoc: (c.cpf || c.cnpj)! }, { locatarioDoc: (c.cpf || c.cnpj)! }] } })
        : 0,
    ]);
    const legalHold = contracts + entries + nfse + dimob > 0;
    return {
      contactId, alreadyAnonymized: c.name === 'Titular anonimizado' || !!c.deletedAt && !c.email && !c.phone,
      legalHold,
      keeps: legalHold ? ['nome', 'CPF/CNPJ'] : [],
      reason: legalHold
        ? `A pessoa é parte de ${contracts} contrato(s), ${entries} lançamento(s), ${nfse} nota(s) fiscal(is) e ${dimob} registro(s) de DIMOB dos últimos ${RETENTION_YEARS} anos: nome e CPF/CNPJ precisam ser guardados por obrigação legal/fiscal. O restante será apagado.`
        : 'Não há obrigação legal de guarda: todos os dados pessoais serão apagados e o cadastro será desativado.',
    };
  }

  async anonymizeContact(workspaceId: string, contactId: string, userId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Informe o motivo (ex.: pedido do titular em DD/MM/AAAA).');
    const pv = await this.anonymizePreview(workspaceId, contactId);
    const c = await this.contact(workspaceId, contactId);
    const emailHash = c.email ? crypto.createHash('sha256').update(c.email.toLowerCase()).digest('hex').slice(0, 16) : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.contact.update({
        where: { id: contactId },
        data: {
          ...(pv.legalHold ? {} : { name: 'Titular anonimizado', cpf: null, cnpj: null, companyName: null, tradeName: null, deletedAt: new Date() }),
          email: null, phone: null, birthDate: null, profession: null, income: null,
          zipCode: null, street: null, number: null, complement: null, neighborhood: null, city: null, state: null,
          maritalStatus: null, marriageRegime: null, spouseContactId: null, customFields: {},
          marketingConsent: false, marketingConsentAt: null,
          utmSource: null, utmCampaign: null, utmContent: null, utmAdset: null, utmAd: null,
        },
      });
      // conteúdo das conversas
      const convs = await tx.conversation.findMany({ where: { workspaceId, contactId }, select: { id: true } });
      if (convs.length) {
        await tx.message.updateMany({ where: { workspaceId, conversationId: { in: convs.map((x) => x.id) } }, data: { body: REMOVED, mediaUrl: null, metadata: {} } });
      }
      // anotações das atividades e visitas ligadas à pessoa
      await tx.activity.updateMany({ where: { workspaceId, contactId }, data: { content: REMOVED } });
      await tx.visit.updateMany({ where: { workspaceId, contactId }, data: { feedback: REMOVED } });
      // (o perfil de interesse — tipos de imóvel, bairros, faixa de preço — não identifica a pessoa e fica)
      // consentimentos e pedidos LGPD pelo e-mail
      if (c.email && emailHash) {
        await tx.lgpdConsent.updateMany({ where: { workspaceId, subjectEmail: c.email }, data: { subjectEmail: `anon_${emailHash}@deletado.local`, subjectName: 'Titular Excluído', ipAddress: null } });
        await tx.lgpdRequest.updateMany({ where: { workspaceId, subjectEmail: c.email }, data: { subjectEmail: `anon_${emailHash}@deletado.local`, subjectName: 'Titular Excluído' } });
      }
    });
    await this.audit.log({
      workspaceId, userId, action: 'LGPD_CONTACT_ANONYMIZED', entity: 'Contact', entityId: contactId,
      after: { legalHold: pv.legalHold, reason: reason.trim().slice(0, 300) },
    });
    return { anonymized: true, legalHold: pv.legalHold, kept: pv.keeps };
  }
}
