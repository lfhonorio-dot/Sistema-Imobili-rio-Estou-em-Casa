// Fase 3 — ligação do negócio com imóveis e o rascunho do contrato de venda
// (o "Ganho" abre o assistente de contrato já preenchido, sem redigitar).

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { authorizationStatus } from '../../erp/properties/authorization-status';
import { contractPaymentMethod } from './funnel-rules';

@Injectable()
export class DealFunnelService {
  constructor(private prisma: PrismaService) {}

  async setProperties(workspaceId: string, dealId: string, propertyIds: string[]) {
    const deal = await this.prisma.deal.findFirst({ where: { id: dealId, workspaceId, deletedAt: null }, select: { id: true } });
    if (!deal) throw new NotFoundException('Negócio não encontrado.');
    const ids = [...new Set(propertyIds)];
    if (ids.length) {
      const found = await this.prisma.property.count({ where: { id: { in: ids }, workspaceId, deletedAt: null } });
      if (found !== ids.length) throw new BadRequestException('Imóvel não encontrado neste workspace.');
    }
    // imóvel com proposta ou visita no negócio não pode sair da lista
    const inUse = await this.prisma.proposal.findMany({
      where: { workspaceId, dealId, deletedAt: null, propertyId: { notIn: ids } }, select: { propertyId: true },
    });
    if (inUse.length) throw new BadRequestException('Um dos imóveis removidos tem proposta registrada neste negócio.');

    await this.prisma.$transaction(async (tx) => {
      // DealProperty é tabela de ligação (sem dado de negócio próprio)
      await tx.dealProperty.deleteMany({ where: { dealId, propertyId: { notIn: ids } } });
      const existing = await tx.dealProperty.findMany({ where: { dealId }, select: { propertyId: true } });
      const have = new Set(existing.map((e) => e.propertyId));
      const toAdd = ids.filter((id) => !have.has(id));
      if (toAdd.length) await tx.dealProperty.createMany({ data: toAdd.map((propertyId) => ({ dealId, propertyId })) });
    });
    return { propertyIds: ids };
  }

  /**
   * Dados para preencher o contrato de venda a partir do negócio.
   * Prioridade do valor: proposta aceita → valor do negócio → preço do imóvel.
   * A comissão vem da autorização de venda (captação) do imóvel.
   */
  async contractDraft(workspaceId: string, dealId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, workspaceId, deletedAt: null },
      include: {
        contact: { select: { id: true, name: true, maritalStatus: true, spouseContactId: true } },
        properties: { select: { propertyId: true } },
      },
    });
    if (!deal) throw new NotFoundException('Negócio não encontrado.');

    const warnings: string[] = [];
    const existing = await this.prisma.contract.findFirst({
      where: { workspaceId, dealId, deletedAt: null, status: { not: 'RESCINDED' } },
      select: { id: true, code: true },
    });
    if (existing) warnings.push(`Este negócio já tem o contrato ${existing.code ?? existing.id}.`);

    const accepted = await this.prisma.proposal.findFirst({
      where: { workspaceId, dealId, status: 'ACCEPTED', deletedAt: null },
      orderBy: { decidedAt: 'desc' },
    });
    const propertyId = accepted?.propertyId ?? (deal.properties.length === 1 ? deal.properties[0].propertyId : null);
    if (!propertyId) {
      warnings.push(deal.properties.length
        ? 'O negócio tem mais de um imóvel e nenhuma proposta aceita: escolha o imóvel no contrato.'
        : 'O negócio não tem imóvel vinculado: escolha o imóvel no contrato.');
    }
    if (!accepted) warnings.push('Nenhuma proposta aceita: o valor veio do negócio ou do preço do imóvel. Confira.');

    const property = propertyId
      ? await this.prisma.property.findFirst({
          where: { id: propertyId, workspaceId, deletedAt: null },
          select: {
            id: true, code: true, salePrice: true, ownerId: true, status: true,
            coOwners: { where: { deletedAt: null }, select: { contactId: true, isPrimary: true } },
          },
        })
      : null;
    if (property?.status === 'SOLD') warnings.push('Este imóvel já está marcado como vendido.');
    if (property && !property.ownerId) warnings.push('O imóvel não tem proprietário cadastrado.');
    if (property && property.coOwners.length > 1) {
      warnings.push(`O imóvel tem ${property.coOwners.length} proprietários: todos precisam assinar o contrato.`);
    }

    let commissionRate: number | null = null;
    if (property) {
      const auths = await this.prisma.propertyAuthorization.findMany({
        where: { workspaceId, propertyId: property.id, deletedAt: null, status: 'ACTIVE' },
        orderBy: { validUntil: 'desc' },
        take: 1,
      });
      const auth = auths[0];
      if (!auth) warnings.push('O imóvel não tem autorização de venda registrada.');
      else {
        if (authorizationStatus(auth).status === 'EXPIRED') warnings.push('A autorização de venda do imóvel está vencida.');
        commissionRate = auth.commissionRate != null ? Number(auth.commissionRate) : null;
      }
    }
    if (commissionRate == null) warnings.push('Taxa de comissão não encontrada na autorização: informe no contrato.');

    if ((deal.contact.maritalStatus === 'CASADO' || deal.contact.maritalStatus === 'UNIAO_ESTAVEL') && !deal.contact.spouseContactId) {
      warnings.push('O comprador é casado(a) e o cônjuge não está cadastrado.');
    }

    const saleValue = accepted ? Number(accepted.amount) : deal.value != null ? Number(deal.value) : property?.salePrice != null ? Number(property.salePrice) : null;

    return {
      dealId: deal.id,
      existingContractId: existing?.id ?? null,
      type: 'SALE',
      propertyId: property?.id ?? null,
      propertyCode: property?.code ?? null,
      ownerId: property?.ownerId ?? null,
      tenantId: deal.contact.id, // comprador
      buyerName: deal.contact.name,
      saleValue,
      commissionRate,
      paymentMethod: contractPaymentMethod(accepted?.paymentMethod) ?? null,
      proposalDate: accepted?.createdAt ?? null,
      acceptanceDate: accepted?.decidedAt ?? null,
      proposalId: accepted?.id ?? null,
      warnings,
    };
  }
}
