// Fase 2 — cadastros do imóvel: proprietários, autorização de venda,
// controle de chaves, histórico de preço, fotos e documentos (upload) e
// clientes compatíveis. Todo ID recebido é validado no workspace.

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { FilesService, FILE_URL_PREFIX, UploadedFileInput } from '../../files/files.service';
import {
  AddOwnerDto, CancelAuthorizationDto, CreateAuthorizationDto, KeyMovementDto, UploadDocumentDto, UploadPhotoDto,
} from './property-registry.dto';
import { authorizationStatus, EXPIRING_WINDOW_DAYS } from './authorization-status';
import { matchProfileToProperty } from './matching';

@Injectable()
export class PropertyRegistryService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private files: FilesService,
  ) {}

  // ── Helpers de validação (regra 1: todo ID pertence ao workspace) ──────

  async assertProperty(workspaceId: string, propertyId: string) {
    const p = await this.prisma.property.findFirst({
      where: { id: propertyId, workspaceId, deletedAt: null },
      select: { id: true, code: true, ownerId: true },
    });
    if (!p) throw new NotFoundException('Imóvel não encontrado.');
    return p;
  }

  private async assertContact(workspaceId: string, contactId: string, label = 'Contato') {
    const c = await this.prisma.contact.findFirst({
      where: { id: contactId, workspaceId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!c) throw new BadRequestException(`${label} não encontrado neste workspace.`);
    return c;
  }

  // ── Proprietários ────────────────────────────────────────────────────

  async listOwners(workspaceId: string, propertyId: string) {
    await this.assertProperty(workspaceId, propertyId);
    return this.prisma.propertyOwner.findMany({
      where: { workspaceId, propertyId, deletedAt: null },
      include: {
        contact: {
          select: { id: true, name: true, type: true, phone: true, email: true, maritalStatus: true, spouseContactId: true },
        },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async addOwner(workspaceId: string, propertyId: string, dto: AddOwnerDto, userId: string) {
    await this.assertProperty(workspaceId, propertyId);
    await this.assertContact(workspaceId, dto.contactId, 'Proprietário');

    const current = await this.prisma.propertyOwner.findMany({
      where: { workspaceId, propertyId, deletedAt: null },
      select: { contactId: true, sharePct: true },
    });
    if (current.some((o) => o.contactId === dto.contactId)) {
      throw new BadRequestException('Este contato já é proprietário do imóvel.');
    }
    const shareSum = current.reduce((s, o) => s + Number(o.sharePct ?? 0), 0) + Number(dto.sharePct ?? 0);
    if (shareSum > 100.0001) {
      throw new BadRequestException('A soma dos percentuais de propriedade passaria de 100%.');
    }
    const makePrimary = dto.isPrimary || current.length === 0;

    const owner = await this.prisma.$transaction(async (tx) => {
      if (makePrimary) {
        await tx.propertyOwner.updateMany({ where: { workspaceId, propertyId, deletedAt: null }, data: { isPrimary: false } });
        await tx.property.update({ where: { id: propertyId }, data: { ownerId: dto.contactId } });
      }
      return tx.propertyOwner.create({
        data: { workspaceId, propertyId, contactId: dto.contactId, sharePct: dto.sharePct, isPrimary: makePrimary },
      });
    });
    await this.audit.log({ workspaceId, userId, action: 'PROPERTY_OWNER_ADDED', entity: 'Property', entityId: propertyId });
    return owner;
  }

  async removeOwner(workspaceId: string, propertyId: string, ownerLinkId: string, userId: string) {
    await this.assertProperty(workspaceId, propertyId);
    const link = await this.prisma.propertyOwner.findFirst({
      where: { id: ownerLinkId, workspaceId, propertyId, deletedAt: null },
    });
    if (!link) throw new NotFoundException('Proprietário não encontrado neste imóvel.');

    await this.prisma.$transaction(async (tx) => {
      await tx.propertyOwner.update({ where: { id: link.id }, data: { deletedAt: new Date(), isPrimary: false } });
      if (link.isPrimary) {
        // promove o próximo proprietário (se houver) a principal
        const next = await tx.propertyOwner.findFirst({
          where: { workspaceId, propertyId, deletedAt: null },
          orderBy: { createdAt: 'asc' },
        });
        if (next) await tx.propertyOwner.update({ where: { id: next.id }, data: { isPrimary: true } });
        await tx.property.update({ where: { id: propertyId }, data: { ownerId: next?.contactId ?? null } });
      }
    });
    await this.audit.log({ workspaceId, userId, action: 'PROPERTY_OWNER_REMOVED', entity: 'Property', entityId: propertyId });
    return { removed: true };
  }

  // ── Autorização de venda ────────────────────────────────────────────

  private decorateAuthorization<T extends { status: string; validUntil: Date }>(a: T, now = new Date()) {
    const s = authorizationStatus(a, now);
    return { ...a, situation: s.status, daysLeft: s.daysLeft };
  }

  async listAuthorizations(workspaceId: string, propertyId: string) {
    await this.assertProperty(workspaceId, propertyId);
    const items = await this.prisma.propertyAuthorization.findMany({
      where: { workspaceId, propertyId, deletedAt: null },
      orderBy: { signedAt: 'desc' },
    });
    return this.attachCaptors(workspaceId, items.map((a) => this.decorateAuthorization(a)));
  }

  private async attachCaptors<T extends { captorUserId: string | null }>(workspaceId: string, items: T[]) {
    const ids = [...new Set(items.map((i) => i.captorUserId).filter((v): v is string => !!v))];
    if (!ids.length) return items.map((i) => ({ ...i, captor: null }));
    const members = await this.prisma.workspaceUser.findMany({
      where: { workspaceId, id: { in: ids } },
      select: { id: true, user: { select: { name: true } } },
    });
    const byId = new Map(members.map((m) => [m.id, { id: m.id, name: m.user.name }]));
    return items.map((i) => ({ ...i, captor: i.captorUserId ? byId.get(i.captorUserId) ?? null : null }));
  }

  async createAuthorization(workspaceId: string, propertyId: string, dto: CreateAuthorizationDto, userId: string) {
    await this.assertProperty(workspaceId, propertyId);
    const signedAt = new Date(dto.signedAt);
    const validUntil = new Date(dto.validUntil);
    if (validUntil <= signedAt) {
      throw new BadRequestException('A validade precisa ser depois da data de assinatura.');
    }
    if (dto.captorUserId) {
      const member = await this.prisma.workspaceUser.findFirst({
        where: { id: dto.captorUserId, workspaceId },
        select: { id: true },
      });
      if (!member) throw new BadRequestException('Corretor captador não pertence a esta imobiliária.');
    }
    if (dto.documentId) {
      const doc = await this.prisma.document.findFirst({
        where: { id: dto.documentId, workspaceId, propertyId, deletedAt: null },
        select: { id: true },
      });
      if (!doc) throw new BadRequestException('Documento da autorização não encontrado neste imóvel.');
    }
    const created = await this.prisma.propertyAuthorization.create({
      data: {
        workspaceId,
        propertyId,
        signedAt,
        validUntil,
        exclusive: dto.exclusive ?? false,
        commissionRate: dto.commissionRate,
        askingPrice: dto.askingPrice,
        captorUserId: dto.captorUserId,
        documentId: dto.documentId,
        notes: dto.notes,
      },
    });
    await this.audit.log({ workspaceId, userId, action: 'PROPERTY_AUTHORIZATION_CREATED', entity: 'Property', entityId: propertyId });
    return this.decorateAuthorization(created);
  }

  async cancelAuthorization(workspaceId: string, propertyId: string, id: string, dto: CancelAuthorizationDto, userId: string) {
    await this.assertProperty(workspaceId, propertyId);
    const a = await this.prisma.propertyAuthorization.findFirst({
      where: { id, workspaceId, propertyId, deletedAt: null },
    });
    if (!a) throw new NotFoundException('Autorização não encontrada.');
    if (a.status === 'CANCELLED') throw new BadRequestException('Esta autorização já foi cancelada.');
    if (!dto.reason?.trim()) throw new BadRequestException('Informe o motivo do cancelamento.');
    const updated = await this.prisma.propertyAuthorization.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: dto.reason.trim() },
    });
    await this.audit.log({ workspaceId, userId, action: 'PROPERTY_AUTHORIZATION_CANCELLED', entity: 'Property', entityId: propertyId });
    return this.decorateAuthorization(updated);
  }

  /** Autorizações ativas que vencem em até N dias ou já venceram (imóvel ainda à venda). */
  async expiringAuthorizations(workspaceId: string, days = EXPIRING_WINDOW_DAYS, now = new Date()) {
    const limit = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const items = await this.prisma.propertyAuthorization.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        status: 'ACTIVE',
        validUntil: { lte: limit },
        property: { deletedAt: null, status: { in: ['AVAILABLE', 'RESERVED'] } },
      },
      include: { property: { select: { id: true, code: true, street: true, number: true, neighborhood: true, city: true } } },
      orderBy: { validUntil: 'asc' },
    });
    // Só a autorização mais recente de cada imóvel importa
    const latestByProperty = new Map<string, (typeof items)[number]>();
    for (const a of items) {
      const prev = latestByProperty.get(a.propertyId);
      if (!prev || prev.validUntil < a.validUntil) latestByProperty.set(a.propertyId, a);
    }
    const newer = await this.prisma.propertyAuthorization.findMany({
      where: {
        workspaceId, deletedAt: null, status: 'ACTIVE',
        propertyId: { in: [...latestByProperty.keys()] },
        validUntil: { gt: limit },
      },
      select: { propertyId: true },
    });
    const renewed = new Set(newer.map((n) => n.propertyId));
    const list = [...latestByProperty.values()]
      .filter((a) => !renewed.has(a.propertyId))
      .map((a) => this.decorateAuthorization(a, now));
    return this.attachCaptors(workspaceId, list);
  }

  // ── Chaves ──────────────────────────────────────────────────────────

  async listKeyMovements(workspaceId: string, propertyId: string) {
    await this.assertProperty(workspaceId, propertyId);
    const movements = await this.prisma.propertyKeyMovement.findMany({
      where: { workspaceId, propertyId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const last = movements[0];
    return {
      currentlyOut: last?.action === 'CHECKOUT',
      holder: last?.action === 'CHECKOUT' ? { name: last.holderName, since: last.createdAt, expectedReturnAt: last.expectedReturnAt } : null,
      movements,
    };
  }

  async registerKeyMovement(workspaceId: string, propertyId: string, dto: KeyMovementDto, userId: string) {
    await this.assertProperty(workspaceId, propertyId);
    const last = await this.prisma.propertyKeyMovement.findFirst({
      where: { workspaceId, propertyId },
      orderBy: { createdAt: 'desc' },
    });
    const isOut = last?.action === 'CHECKOUT';
    if (dto.action === 'CHECKOUT' && isOut) {
      throw new BadRequestException(`A chave já está com ${last!.holderName}. Registre a devolução antes.`);
    }
    if (dto.action === 'RETURN' && !isOut) {
      throw new BadRequestException('A chave não está retirada; não há o que devolver.');
    }
    let holderName = dto.holderName?.trim();
    if (dto.holderContactId) {
      const c = await this.assertContact(workspaceId, dto.holderContactId);
      holderName = holderName || c.name;
    }
    if (dto.action === 'CHECKOUT' && !holderName) {
      throw new BadRequestException('Informe quem está retirando a chave.');
    }
    return this.prisma.propertyKeyMovement.create({
      data: {
        workspaceId,
        propertyId,
        action: dto.action,
        keyLabel: dto.keyLabel ?? last?.keyLabel ?? null,
        holderName: dto.action === 'RETURN' ? (holderName || last!.holderName) : holderName!,
        holderContactId: dto.holderContactId,
        userId,
        expectedReturnAt: dto.expectedReturnAt ? new Date(dto.expectedReturnAt) : null,
        notes: dto.notes,
      },
    });
  }

  // ── Histórico de preço ──────────────────────────────────────────────

  async listPriceHistory(workspaceId: string, propertyId: string) {
    await this.assertProperty(workspaceId, propertyId);
    return this.prisma.propertyPriceHistory.findMany({
      where: { workspaceId, propertyId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // ── Fotos (upload) ──────────────────────────────────────────────────

  async uploadPhoto(workspaceId: string, propertyId: string, file: UploadedFileInput, dto: UploadPhotoDto, userId: string) {
    await this.assertProperty(workspaceId, propertyId);
    this.files.validate(file, 'IMAGE');
    const stored = await this.files.store(workspaceId, file, 'IMAGE', userId);
    const count = await this.prisma.propertyPhoto.count({ where: { propertyId } });
    const photo = await this.prisma.propertyPhoto.create({
      data: { propertyId, url: `${FILE_URL_PREFIX}${stored.id}`, fileId: stored.id, caption: dto.caption, order: count },
    });
    return { ...photo, url: this.files.resolveUrl(photo.url) };
  }

  // ── Documentos (upload) ─────────────────────────────────────────────

  async listDocuments(workspaceId: string, propertyId: string) {
    await this.assertProperty(workspaceId, propertyId);
    const docs = await this.prisma.document.findMany({
      where: { workspaceId, propertyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return docs.map((d) => ({ ...d, url: this.files.resolveUrl(d.url) }));
  }

  async uploadDocument(workspaceId: string, propertyId: string, file: UploadedFileInput, dto: UploadDocumentDto, userId: string) {
    await this.assertProperty(workspaceId, propertyId);
    this.files.validate(file, 'DOCUMENT');
    const stored = await this.files.store(workspaceId, file, 'DOCUMENT', userId);
    const doc = await this.prisma.document.create({
      data: {
        workspaceId,
        propertyId,
        name: dto.name?.trim() || stored.fileName,
        type: dto.type,
        url: `${FILE_URL_PREFIX}${stored.id}`,
        size: stored.size,
        mimeType: stored.mimeType,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        notes: dto.notes,
      },
    });
    await this.audit.log({ workspaceId, userId, action: 'PROPERTY_DOCUMENT_UPLOADED', entity: 'Property', entityId: propertyId });
    return { ...doc, url: this.files.resolveUrl(doc.url) };
  }

  async removeDocument(workspaceId: string, propertyId: string, documentId: string, userId: string) {
    await this.assertProperty(workspaceId, propertyId);
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, workspaceId, propertyId, deletedAt: null },
    });
    if (!doc) throw new NotFoundException('Documento não encontrado neste imóvel.');
    await this.prisma.document.update({ where: { id: documentId }, data: { deletedAt: new Date() } });
    await this.audit.log({ workspaceId, userId, action: 'PROPERTY_DOCUMENT_REMOVED', entity: 'Property', entityId: propertyId });
    return { removed: true };
  }

  // ── Clientes compatíveis com o imóvel ───────────────────────────────

  async matchingContacts(workspaceId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, workspaceId, deletedAt: null },
      select: {
        type: true, purpose: true, status: true, city: true, neighborhood: true,
        salePrice: true, bedrooms: true, parkingSpaces: true,
      },
    });
    if (!property) throw new NotFoundException('Imóvel não encontrado.');

    const profiles = await this.prisma.contactInterestProfile.findMany({
      where: { workspaceId, contact: { deletedAt: null } },
      include: { contact: { select: { id: true, name: true, phone: true, email: true } } },
      take: 2000,
    });

    const p = { ...property, salePrice: property.salePrice != null ? Number(property.salePrice) : null };
    return profiles
      .map((pr) => ({
        contact: pr.contact,
        result: matchProfileToProperty(
          {
            propertyTypes: pr.propertyTypes, cities: pr.cities, neighborhoods: pr.neighborhoods,
            minPrice: pr.minPrice != null ? Number(pr.minPrice) : null,
            maxPrice: pr.maxPrice != null ? Number(pr.maxPrice) : null,
            minBedrooms: pr.minBedrooms, minParkingSpaces: pr.minParkingSpaces,
          },
          p,
        ),
      }))
      .filter((m) => m.result.match)
      .sort((a, b) => b.result.score - a.result.score)
      .slice(0, 50)
      .map((m) => ({ contact: m.contact, score: m.result.score, reasons: m.result.reasons }));
  }
}
