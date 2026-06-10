// Serviço de Contatos - lógica de negócio completa
// Gerencia: CRUD, busca, importação CSV, exportação, merge e timeline

import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  CreateContactDto,
  UpdateContactDto,
  ContactQueryDto,
} from './contacts.dto';

@Injectable()
export class ContactsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // Lista contatos com paginação, busca e filtros
  async findAll(workspaceId: string, query: ContactQueryDto) {
    const {
      page = 1,
      limit = 20,
      search,
      type,
      origin,
      city,
      tags,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    // Construção dinâmica do filtro WHERE
    const where: Prisma.ContactWhereInput = {
      workspaceId,
      deletedAt: null,
      ...(type && { type }),
      ...(origin && { origin }),
      ...(city && { city: { contains: city, mode: 'insensitive' } }),
      ...(tags && tags.length > 0 && {
        tags: { some: { tagId: { in: tags } } },
      }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { cpf: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          tags: { include: { tag: true } },
          _count: { select: { deals: true, activities: true } },
        },
      }),
      this.prisma.contact.count({ where }),
    ]);

    return {
      items: contacts,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Busca contato por ID com todas as relações
  async findOne(workspaceId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        tags: { include: { tag: true } },
        deals: {
          where: { deletedAt: null },
          include: { stage: true, pipeline: true },
        },
        activities: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        documents: { where: { deletedAt: null } },
        companyLinks: { include: { company: true } },
        personLinks: { include: { person: true } },
      },
    });

    if (!contact) {
      throw new NotFoundException('Contato não encontrado');
    }

    return contact;
  }

  // Cria novo contato com verificação de duplicatas
  async create(workspaceId: string, userId: string, dto: CreateContactDto) {
    // Verifica duplicatas por CPF, CNPJ, email ou telefone
    const duplicateCheck = await this.checkDuplicates(workspaceId, dto);
    if (duplicateCheck.length > 0) {
      // Avisa mas não bloqueia - permite criar mesmo com duplicata
      console.warn(`Possíveis duplicatas encontradas para workspace ${workspaceId}:`, duplicateCheck.map(d => d.id));
    }

    const contact = await this.prisma.contact.create({
      data: {
        workspaceId,
        type: dto.type,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        cpf: dto.cpf,
        cnpj: dto.cnpj,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        profession: dto.profession,
        income: dto.income,
        companyName: dto.companyName,
        tradeName: dto.tradeName,
        zipCode: dto.zipCode,
        street: dto.street,
        number: dto.number,
        complement: dto.complement,
        neighborhood: dto.neighborhood,
        city: dto.city,
        state: dto.state,
        marketingConsent: dto.marketingConsent ?? false,
        origin: dto.origin ?? 'MANUAL',
        utmSource: dto.utmSource,
        utmCampaign: dto.utmCampaign,
        utmContent: dto.utmContent,
        utmAdset: dto.utmAdset,
        utmAd: dto.utmAd,
        customFields: (dto.customFields ?? {}) as Prisma.JsonObject,
      },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'CONTACT_CREATED',
      entity: 'Contact',
      entityId: contact.id,
      after: contact,
    });

    return contact;
  }

  // Atualiza contato com log de auditoria
  async update(workspaceId: string, userId: string, id: string, dto: UpdateContactDto) {
    const existing = await this.prisma.contact.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Contato não encontrado');
    }

    const updated = await this.prisma.contact.update({
      where: { id },
      data: {
        ...(dto.type && { type: dto.type }),
        ...(dto.name && { name: dto.name }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.cpf !== undefined && { cpf: dto.cpf }),
        ...(dto.cnpj !== undefined && { cnpj: dto.cnpj }),
        ...(dto.birthDate !== undefined && { birthDate: dto.birthDate ? new Date(dto.birthDate) : null }),
        ...(dto.profession !== undefined && { profession: dto.profession }),
        ...(dto.income !== undefined && { income: dto.income }),
        ...(dto.companyName !== undefined && { companyName: dto.companyName }),
        ...(dto.tradeName !== undefined && { tradeName: dto.tradeName }),
        ...(dto.zipCode !== undefined && { zipCode: dto.zipCode }),
        ...(dto.street !== undefined && { street: dto.street }),
        ...(dto.number !== undefined && { number: dto.number }),
        ...(dto.complement !== undefined && { complement: dto.complement }),
        ...(dto.neighborhood !== undefined && { neighborhood: dto.neighborhood }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.marketingConsent !== undefined && { marketingConsent: dto.marketingConsent }),
        ...(dto.origin !== undefined && { origin: dto.origin }),
        ...(dto.customFields !== undefined && { customFields: dto.customFields as Prisma.JsonObject }),
      },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'CONTACT_UPDATED',
      entity: 'Contact',
      entityId: id,
      before: existing,
      after: updated,
    });

    return updated;
  }

  // Soft delete de contato
  async remove(workspaceId: string, userId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!contact) {
      throw new NotFoundException('Contato não encontrado');
    }

    await this.prisma.contact.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'CONTACT_DELETED',
      entity: 'Contact',
      entityId: id,
    });

    return { deleted: true };
  }

  // Importa contatos via CSV
  async importCsv(
    workspaceId: string,
    userId: string,
    fileContent: string,
    mapping: Record<string, string>,
  ) {
    const lines = fileContent.split('\n').filter((l) => l.trim());
    const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1);

    let created = 0;
    let updated = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const values = rows[i].split(',').map((v) => v.trim().replace(/"/g, ''));
      const rowData: Record<string, string> = {};

      headers.forEach((header, idx) => {
        const mappedField = mapping[header] || header;
        rowData[mappedField] = values[idx] || '';
      });

      try {
        if (!rowData.name) {
          errors.push({ row: i + 2, error: 'Nome é obrigatório' });
          continue;
        }

        // Verifica se já existe por email
        if (rowData.email) {
          const existing = await this.prisma.contact.findFirst({
            where: { workspaceId, email: rowData.email, deletedAt: null },
          });

          if (existing) {
            await this.prisma.contact.update({
              where: { id: existing.id },
              data: { phone: rowData.phone || existing.phone },
            });
            updated++;
            continue;
          }
        }

        await this.prisma.contact.create({
          data: {
            workspaceId,
            type: rowData.type || 'PERSON',
            name: rowData.name,
            email: rowData.email || undefined,
            phone: rowData.phone || undefined,
            cpf: rowData.cpf || undefined,
            city: rowData.city || undefined,
            state: rowData.state || undefined,
            origin: 'MANUAL',
          },
        });
        created++;
      } catch (err) {
        errors.push({ row: i + 2, error: String(err) });
      }
    }

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'CONTACTS_IMPORTED',
      entity: 'Contact',
      after: { created, updated, errors: errors.length },
    });

    return { created, updated, errors };
  }

  // Exporta contatos como CSV (apenas Admin/Manager)
  async exportCsv(workspaceId: string, userId: string, ipAddress?: string): Promise<string> {
    const contacts = await this.prisma.contact.findMany({
      where: { workspaceId, deletedAt: null },
      include: { tags: { include: { tag: true } } },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'CONTACTS_EXPORTED',
      entity: 'Contact',
      after: { count: contacts.length },
      ipAddress,
    });

    const headers = ['ID', 'Tipo', 'Nome', 'Email', 'Telefone', 'CPF/CNPJ', 'Cidade', 'Estado', 'Origem', 'Criado em'];
    const rows = contacts.map((c) => [
      c.id,
      c.type,
      c.name,
      c.email || '',
      c.phone || '',
      c.cpf || c.cnpj || '',
      c.city || '',
      c.state || '',
      c.origin || '',
      c.createdAt.toISOString(),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return csv;
  }

  // Retorna timeline de atividades do contato
  async getTimeline(workspaceId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!contact) {
      throw new NotFoundException('Contato não encontrado');
    }

    const activities = await this.prisma.activity.findMany({
      where: { contactId: id, workspaceId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return activities;
  }

  // Merge de duplicatas: move dados do source para o target
  async mergeDuplicates(
    workspaceId: string,
    userId: string,
    targetId: string,
    sourceId: string,
  ) {
    const [target, source] = await Promise.all([
      this.prisma.contact.findFirst({ where: { id: targetId, workspaceId, deletedAt: null } }),
      this.prisma.contact.findFirst({ where: { id: sourceId, workspaceId, deletedAt: null } }),
    ]);

    if (!target || !source) {
      throw new NotFoundException('Contato não encontrado');
    }

    // Move atividades para o contato principal
    await this.prisma.activity.updateMany({
      where: { contactId: sourceId },
      data: { contactId: targetId },
    });

    // Move negócios para o contato principal
    await this.prisma.deal.updateMany({
      where: { contactId: sourceId },
      data: { contactId: targetId },
    });

    // Move documentos para o contato principal
    await this.prisma.document.updateMany({
      where: { contactId: sourceId },
      data: { contactId: targetId },
    });

    // Soft delete do contato fonte
    await this.prisma.contact.update({
      where: { id: sourceId },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'CONTACT_MERGED',
      entity: 'Contact',
      entityId: targetId,
      after: { mergedFrom: sourceId },
    });

    return { merged: true, targetId, sourceId };
  }

  // Encontra possíveis duplicatas por CPF, CNPJ, email ou telefone
  async findDuplicates(workspaceId: string) {
    const contacts = await this.prisma.contact.findMany({
      where: { workspaceId, deletedAt: null },
      select: { id: true, name: true, email: true, phone: true, cpf: true, cnpj: true, type: true },
    });

    const duplicateGroups: Array<{ field: string; value: string; contacts: typeof contacts }> = [];
    const seen = new Map<string, typeof contacts>();

    for (const contact of contacts) {
      const keys = [
        contact.email ? `email:${contact.email}` : null,
        contact.phone ? `phone:${contact.phone}` : null,
        contact.cpf ? `cpf:${contact.cpf}` : null,
        contact.cnpj ? `cnpj:${contact.cnpj}` : null,
      ].filter(Boolean) as string[];

      for (const key of keys) {
        const group = seen.get(key) || [];
        group.push(contact);
        seen.set(key, group);
      }
    }

    seen.forEach((group, key) => {
      if (group.length > 1) {
        const [field, value] = key.split(':');
        duplicateGroups.push({ field, value, contacts: group });
      }
    });

    return duplicateGroups;
  }

  // Adiciona tag a um contato
  async addTag(workspaceId: string, contactId: string, tagId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, workspaceId, deletedAt: null },
    });

    if (!contact) throw new NotFoundException('Contato não encontrado');

    // Verifica se a tag pertence ao workspace
    const tag = await this.prisma.tag.findFirst({
      where: { id: tagId, workspaceId },
    });

    if (!tag) throw new NotFoundException('Tag não encontrada');

    await this.prisma.contactTag.upsert({
      where: { contactId_tagId: { contactId, tagId } },
      create: { contactId, tagId },
      update: {},
    });

    return { added: true };
  }

  // Remove tag de um contato
  async removeTag(workspaceId: string, contactId: string, tagId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, workspaceId, deletedAt: null },
    });

    if (!contact) throw new NotFoundException('Contato não encontrado');

    await this.prisma.contactTag.deleteMany({
      where: { contactId, tagId },
    });

    return { removed: true };
  }

  // Método auxiliar: verifica duplicatas antes de criar
  private async checkDuplicates(workspaceId: string, dto: CreateContactDto) {
    const orConditions: Prisma.ContactWhereInput[] = [];

    if (dto.email) orConditions.push({ email: dto.email });
    if (dto.phone) orConditions.push({ phone: dto.phone });
    if (dto.cpf) orConditions.push({ cpf: dto.cpf });
    if (dto.cnpj) orConditions.push({ cnpj: dto.cnpj });

    if (orConditions.length === 0) return [];

    return this.prisma.contact.findMany({
      where: { workspaceId, deletedAt: null, OR: orConditions },
      select: { id: true, name: true, email: true, phone: true },
    });
  }
}
