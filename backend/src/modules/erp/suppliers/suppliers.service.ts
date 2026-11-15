// Fornecedores / favorecidos (Fase 2) — usados em contas a pagar.
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierDto, SupplierQueryDto, UpdateSupplierDto } from './suppliers.dto';

export function normalizeDocument(doc?: string | null): string | null {
  const digits = (doc ?? '').replace(/\D/g, '');
  return digits.length ? digits : null;
}

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async findAll(workspaceId: string, query: SupplierQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 100;
    const where: Prisma.SupplierWhereInput = {
      workspaceId,
      deletedAt: null,
      ...(query.category && { category: query.category }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { document: { contains: query.search.replace(/\D/g, '') || query.search } },
        ],
      }),
    };
    const [items, total] = await Promise.all([
      this.prisma.supplier.findMany({ where, orderBy: { name: 'asc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.supplier.count({ where }),
    ]);
    return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async findOne(workspaceId: string, id: string) {
    const s = await this.prisma.supplier.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!s) throw new NotFoundException('Fornecedor não encontrado.');
    return s;
  }

  private validateDocument(personType: string | undefined, document: string | null) {
    if (!document) return;
    const expected = personType === 'PF' ? 11 : 14;
    if (document.length !== expected) {
      throw new BadRequestException(
        personType === 'PF' ? 'CPF deve ter 11 dígitos.' : 'CNPJ deve ter 14 dígitos.',
      );
    }
  }

  private async assertNoDuplicate(workspaceId: string, document: string | null, ignoreId?: string) {
    if (!document) return;
    const dup = await this.prisma.supplier.findFirst({
      where: { workspaceId, document, deletedAt: null, ...(ignoreId && { id: { not: ignoreId } }) },
      select: { id: true, name: true },
    });
    if (dup) throw new ConflictException(`Já existe um fornecedor com este documento: ${dup.name}.`);
  }

  async create(workspaceId: string, dto: CreateSupplierDto) {
    const document = normalizeDocument(dto.document);
    const personType = dto.personType ?? 'PJ';
    this.validateDocument(personType, document);
    await this.assertNoDuplicate(workspaceId, document);
    return this.prisma.supplier.create({
      data: { ...dto, workspaceId, personType, document, name: dto.name.trim() },
    });
  }

  async update(workspaceId: string, id: string, dto: UpdateSupplierDto) {
    const existing = await this.findOne(workspaceId, id);
    const document = dto.document !== undefined ? normalizeDocument(dto.document) : existing.document;
    const personType = dto.personType ?? existing.personType;
    this.validateDocument(personType, document);
    await this.assertNoDuplicate(workspaceId, document, id);
    return this.prisma.supplier.update({
      where: { id },
      data: { ...dto, personType, document, ...(dto.name && { name: dto.name.trim() }) },
    });
  }

  // Soft delete. Contas a pagar antigas continuam apontando para ele.
  async remove(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);
    await this.prisma.supplier.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    return { deleted: true };
  }
}
