// Serviço de Documentos com auditoria de acesso

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  DocumentQueryDto,
} from './documents.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(workspaceId: string, query: DocumentQueryDto) {
    const { page = 1, limit = 20, contactId, propertyId, contractId, type } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.DocumentWhereInput = {
      workspaceId,
      deletedAt: null,
      ...(contactId && { contactId }),
      ...(propertyId && { propertyId }),
      ...(contractId && { contractId }),
      ...(type && { type }),
    };

    const [documents, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contact: { select: { id: true, name: true } },
          property: { select: { id: true, code: true, street: true } },
          contract: { select: { id: true, type: true } },
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      items: documents,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(workspaceId: string, id: string, userId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        contact: { select: { id: true, name: true } },
        property: { select: { id: true, code: true, street: true } },
        contract: { select: { id: true, type: true } },
      },
    });

    if (!document) throw new NotFoundException('Documento não encontrado');

    // Auditoria de acesso ao documento
    await this.auditService.log({
      workspaceId,
      userId,
      action: 'READ',
      entity: 'Document',
      entityId: id,
    });

    return document;
  }

  async create(workspaceId: string, dto: CreateDocumentDto, userId: string) {
    const document = await this.prisma.document.create({
      data: {
        workspaceId,
        ...dto,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'CREATE',
      entity: 'Document',
      entityId: document.id,
      after: document,
    });

    return document;
  }

  async update(workspaceId: string, id: string, dto: UpdateDocumentDto, userId: string) {
    const existing = await this.prisma.document.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Documento não encontrado');

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        ...dto,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'UPDATE',
      entity: 'Document',
      entityId: id,
      before: existing,
      after: updated,
    });

    return updated;
  }

  async remove(workspaceId: string, id: string, userId: string) {
    const existing = await this.prisma.document.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Documento não encontrado');

    await this.prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'DELETE',
      entity: 'Document',
      entityId: id,
    });

    return { success: true };
  }
}
