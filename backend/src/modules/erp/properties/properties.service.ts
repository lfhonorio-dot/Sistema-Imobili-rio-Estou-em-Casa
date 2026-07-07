// Serviço de Imóveis - lógica de negócio completa
// Gerencia: CRUD, fotos, status, duplicação, QR code

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  CreatePropertyDto,
  UpdatePropertyDto,
  PropertyQueryDto,
  ChangeStatusDto,
  AddPhotosDto,
  ReorderPhotosDto,
} from './properties.dto';

@Injectable()
export class PropertiesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // Lista imóveis com paginação e filtros
  async findAll(workspaceId: string, query: PropertyQueryDto) {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      purpose,
      city,
      neighborhood,
      bedrooms,
      priceMin,
      priceMax,
      areaMin,
      areaMax,
      search,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.PropertyWhereInput = {
      workspaceId,
      deletedAt: null,
      ...(type && { type }),
      ...(status && { status }),
      ...(purpose && { purpose }),
      ...(city && { city: { contains: city, mode: 'insensitive' } }),
      ...(neighborhood && { neighborhood: { contains: neighborhood, mode: 'insensitive' } }),
      ...(bedrooms !== undefined && { bedrooms }),
      ...(priceMin !== undefined || priceMax !== undefined
        ? {
            OR: [
              {
                salePrice: {
                  ...(priceMin !== undefined && { gte: priceMin }),
                  ...(priceMax !== undefined && { lte: priceMax }),
                },
              },
              {
                rentalPrice: {
                  ...(priceMin !== undefined && { gte: priceMin }),
                  ...(priceMax !== undefined && { lte: priceMax }),
                },
              },
            ],
          }
        : {}),
      ...(areaMin !== undefined && { totalArea: { gte: areaMin } }),
      ...(areaMax !== undefined && { totalArea: { lte: areaMax } }),
      ...(search && {
        OR: [
          { street: { contains: search, mode: 'insensitive' } },
          { neighborhood: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [properties, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          photos: {
            orderBy: { order: 'asc' },
            take: 1,
          },
          owner: { select: { id: true, name: true } },
          _count: { select: { contracts: true } },
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      items: properties,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  // Busca imóvel por ID com detalhes completos
  // Precificação assistida: mediana do preço/m² de imóveis comparáveis do
  // próprio workspace (mesma cidade + tipo, área ±35%), para venda e locação.
  async priceSuggestion(workspaceId: string, id: string) {
    const target = await this.prisma.property.findFirst({
      where: { id, workspaceId, deletedAt: null },
      select: { id: true, city: true, type: true, totalArea: true, salePrice: true, rentalPrice: true },
    });
    if (!target) throw new NotFoundException('Imóvel não encontrado');
    if (!target.totalArea || Number(target.totalArea) <= 0) {
      return { available: false, reason: 'Informe a área total do imóvel para calcular a sugestão.' };
    }

    const area = Number(target.totalArea);
    const comparables = await this.prisma.property.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        id: { not: id },
        type: target.type,
        ...(target.city ? { city: { equals: target.city, mode: 'insensitive' } } : {}),
        totalArea: { gte: area * 0.65, lte: area * 1.35 },
      },
      select: { code: true, totalArea: true, salePrice: true, rentalPrice: true, status: true, neighborhood: true },
      take: 50,
    });

    const median = (xs: number[]) => {
      if (!xs.length) return null;
      const s = [...xs].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    };

    const salePerSqm = comparables
      .filter((c) => c.salePrice && c.totalArea && Number(c.totalArea) > 0)
      .map((c) => Number(c.salePrice) / Number(c.totalArea));
    const rentPerSqm = comparables
      .filter((c) => c.rentalPrice && c.totalArea && Number(c.totalArea) > 0)
      .map((c) => Number(c.rentalPrice) / Number(c.totalArea));

    const saleMedian = median(salePerSqm);
    const rentMedian = median(rentPerSqm);

    return {
      available: salePerSqm.length > 0 || rentPerSqm.length > 0,
      area,
      sale: saleMedian
        ? {
            samples: salePerSqm.length,
            medianPerSqm: Math.round(saleMedian),
            suggested: Math.round(saleMedian * area),
            current: target.salePrice ? Number(target.salePrice) : null,
          }
        : null,
      rental: rentMedian
        ? {
            samples: rentPerSqm.length,
            medianPerSqm: Math.round(rentMedian * 100) / 100,
            suggested: Math.round(rentMedian * area),
            current: target.rentalPrice ? Number(target.rentalPrice) : null,
          }
        : null,
      comparables: comparables.slice(0, 10).map((c) => ({
        code: c.code,
        neighborhood: c.neighborhood,
        area: Number(c.totalArea),
        salePrice: c.salePrice ? Number(c.salePrice) : null,
        rentalPrice: c.rentalPrice ? Number(c.rentalPrice) : null,
        status: c.status,
      })),
    };
  }

  async findOne(workspaceId: string, id: string) {
    const property = await this.prisma.property.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        photos: { orderBy: { order: 'asc' } },
        owner: { select: { id: true, name: true, phone: true, email: true } },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        contracts: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: {
            tenant: { select: { id: true, name: true } },
            owner: { select: { id: true, name: true } },
          },
        },
        maintenanceOrders: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        documents: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!property) {
      throw new NotFoundException('Imóvel não encontrado');
    }

    return property;
  }

  // Cria novo imóvel gerando código automático
  async create(workspaceId: string, dto: CreatePropertyDto, userId: string) {
    // Valida proprietário se informado
    if (dto.ownerId) {
      const owner = await this.prisma.contact.findFirst({
        where: { id: dto.ownerId, workspaceId, deletedAt: null },
      });
      if (!owner) {
        throw new BadRequestException('Proprietário não encontrado neste workspace');
      }
    }

    // Gera código automático: P-{ano}-{sequência}
    const year = new Date().getFullYear();
    const lastProperty = await this.prisma.property.findFirst({
      where: { workspaceId, code: { startsWith: `P-${year}-` } },
      orderBy: { createdAt: 'desc' },
    });

    let sequence = 1;
    if (lastProperty) {
      const parts = lastProperty.code.split('-');
      sequence = parseInt(parts[2] || '0', 10) + 1;
    }
    const code = `P-${year}-${String(sequence).padStart(4, '0')}`;

    const property = await this.prisma.property.create({
      data: {
        workspaceId,
        code,
        ...dto,
        customFields: (dto.customFields as Prisma.InputJsonValue) ?? {},
      },
      include: { photos: true, owner: { select: { id: true, name: true } } },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'CREATE',
      entity: 'Property',
      entityId: property.id,
      after: property,
    });

    return property;
  }

  // Atualiza imóvel com auditoria
  async update(
    workspaceId: string,
    id: string,
    dto: UpdatePropertyDto,
    userId: string,
  ) {
    const existing = await this.prisma.property.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Imóvel não encontrado');

    if (dto.ownerId && dto.ownerId !== existing.ownerId) {
      const owner = await this.prisma.contact.findFirst({
        where: { id: dto.ownerId, workspaceId, deletedAt: null },
      });
      if (!owner) throw new BadRequestException('Proprietário não encontrado');
    }

    const updated = await this.prisma.property.update({
      where: { id },
      data: {
        ...dto,
        customFields: dto.customFields
          ? (dto.customFields as Prisma.InputJsonValue)
          : undefined,
      },
      include: { photos: true, owner: { select: { id: true, name: true } } },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'UPDATE',
      entity: 'Property',
      entityId: id,
      before: existing,
      after: updated,
    });

    return updated;
  }

  // Soft delete do imóvel
  async remove(workspaceId: string, id: string, userId: string) {
    const existing = await this.prisma.property.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Imóvel não encontrado');

    await this.prisma.property.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'DELETE',
      entity: 'Property',
      entityId: id,
    });

    return { success: true };
  }

  // Altera status do imóvel com histórico
  async changeStatus(
    workspaceId: string,
    id: string,
    dto: ChangeStatusDto,
    userId: string,
  ) {
    const property = await this.prisma.property.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!property) throw new NotFoundException('Imóvel não encontrado');

    const [updated] = await this.prisma.$transaction([
      this.prisma.property.update({
        where: { id },
        data: { status: dto.status },
      }),
      this.prisma.propertyStatusHistory.create({
        data: {
          propertyId: id,
          status: dto.status,
          userId,
          note: dto.note,
        },
      }),
    ]);

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'UPDATE',
      entity: 'Property',
      entityId: id,
      before: { status: property.status },
      after: { status: dto.status },
    });

    return updated;
  }

  // Adiciona fotos ao imóvel
  async addPhotos(workspaceId: string, id: string, dto: AddPhotosDto) {
    const property = await this.prisma.property.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!property) throw new NotFoundException('Imóvel não encontrado');

    await this.prisma.propertyPhoto.createMany({
      data: dto.photos.map((p) => ({
        propertyId: id,
        url: p.url,
        caption: p.caption,
        order: p.order ?? 0,
      })),
    });

    return this.prisma.propertyPhoto.findMany({
      where: { propertyId: id },
      orderBy: { order: 'asc' },
    });
  }

  // Remove foto específica do imóvel
  async removePhoto(workspaceId: string, id: string, photoId: string) {
    const photo = await this.prisma.propertyPhoto.findFirst({
      where: { id: photoId, propertyId: id },
    });
    if (!photo) throw new NotFoundException('Foto não encontrada');

    await this.prisma.propertyPhoto.delete({ where: { id: photoId } });
    return { success: true };
  }

  // Reordena fotos do imóvel
  async reorderPhotos(
    workspaceId: string,
    id: string,
    dto: ReorderPhotosDto,
  ) {
    const property = await this.prisma.property.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!property) throw new NotFoundException('Imóvel não encontrado');

    await Promise.all(
      dto.photos.map((p) =>
        this.prisma.propertyPhoto.update({
          where: { id: p.id },
          data: { order: p.order },
        }),
      ),
    );

    return this.prisma.propertyPhoto.findMany({
      where: { propertyId: id },
      orderBy: { order: 'asc' },
    });
  }

  // Duplica imóvel gerando novo código
  async duplicateProperty(workspaceId: string, id: string, userId: string) {
    const source = await this.prisma.property.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!source) throw new NotFoundException('Imóvel não encontrado');

    // Gera novo código
    const year = new Date().getFullYear();
    const lastProperty = await this.prisma.property.findFirst({
      where: { workspaceId, code: { startsWith: `P-${year}-` } },
      orderBy: { createdAt: 'desc' },
    });

    let sequence = 1;
    if (lastProperty) {
      const parts = lastProperty.code.split('-');
      sequence = parseInt(parts[2] || '0', 10) + 1;
    }
    const code = `P-${year}-${String(sequence).padStart(4, '0')}`;

    const {
      id: _id,
      code: _code,
      createdAt: _c,
      updatedAt: _u,
      deletedAt: _d,
      customFields,
      ...data
    } = source;

    const newProperty = await this.prisma.property.create({
      data: {
        ...data,
        code,
        workspaceId,
        customFields: (customFields ?? {}) as Prisma.InputJsonValue,
      },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'CREATE',
      entity: 'Property',
      entityId: newProperty.id,
      after: { duplicatedFrom: id },
    });

    return { id: newProperty.id, code: newProperty.code };
  }

  // Gera QR code como data URL para o link do imóvel
  async generateQrCode(workspaceId: string, id: string) {
    const property = await this.prisma.property.findFirst({
      where: { id, workspaceId, deletedAt: null },
      select: { id: true, code: true },
    });
    if (!property) throw new NotFoundException('Imóvel não encontrado');

    const url = `${process.env.FRONTEND_URL ?? 'https://app.estouemcasa.com.br'}/properties/${id}`;
    const dataUrl = await QRCode.toDataURL(url);
    return { dataUrl, url };
  }
}
