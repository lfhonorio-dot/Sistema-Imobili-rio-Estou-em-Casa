// Fase 2 — perfil de interesse do cliente comprador e imóveis compatíveis.
import {
  BadRequestException, Body, Controller, Get, Headers, Injectable, NotFoundException, Param, Put, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from '../../files/files.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';
import { matchProfileToProperty } from '../../erp/properties/matching';

export const PROPERTY_TYPES = ['APARTMENT', 'HOUSE', 'COMMERCIAL', 'LAND', 'WAREHOUSE', 'LAUNCH', 'RURAL'];
export const PAYMENT_METHODS = ['CASH', 'FINANCING', 'FGTS', 'PERMUTA'];

export class UpsertInterestProfileDto {
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsIn(PROPERTY_TYPES, { each: true }) propertyTypes?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(80, { each: true }) cities?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) @MaxLength(80, { each: true }) neighborhoods?: string[];
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minPrice?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxPrice?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(20) minBedrooms?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(20) minParkingSpaces?: number | null;
  @IsOptional() @IsArray() @IsIn(PAYMENT_METHODS, { each: true }) paymentMethods?: string[];
  @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
}

const clean = (list?: string[]) =>
  [...new Set((list ?? []).map((s) => s.trim()).filter(Boolean))];

@Injectable()
export class ContactInterestService {
  constructor(
    private prisma: PrismaService,
    private files: FilesService,
  ) {}

  private async assertContact(workspaceId: string, contactId: string) {
    const c = await this.prisma.contact.findFirst({
      where: { id: contactId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Contato não encontrado.');
  }

  async get(workspaceId: string, contactId: string) {
    await this.assertContact(workspaceId, contactId);
    return this.prisma.contactInterestProfile.findFirst({ where: { workspaceId, contactId } });
  }

  async upsert(workspaceId: string, contactId: string, dto: UpsertInterestProfileDto) {
    await this.assertContact(workspaceId, contactId);
    if (dto.minPrice != null && dto.maxPrice != null && dto.minPrice > dto.maxPrice) {
      throw new BadRequestException('O preço mínimo não pode ser maior que o máximo.');
    }
    const data = {
      propertyTypes: clean(dto.propertyTypes),
      cities: clean(dto.cities),
      neighborhoods: clean(dto.neighborhoods),
      minPrice: dto.minPrice ?? null,
      maxPrice: dto.maxPrice ?? null,
      minBedrooms: dto.minBedrooms ?? null,
      minParkingSpaces: dto.minParkingSpaces ?? null,
      paymentMethods: clean(dto.paymentMethods),
      notes: dto.notes ?? null,
    };
    return this.prisma.contactInterestProfile.upsert({
      where: { contactId },
      create: { workspaceId, contactId, ...data },
      update: data,
    });
  }

  async matchingProperties(workspaceId: string, contactId: string) {
    const profile = await this.get(workspaceId, contactId);
    if (!profile) return { hasProfile: false, items: [] };

    const min = profile.minPrice != null ? Number(profile.minPrice) : null;
    const max = profile.maxPrice != null ? Number(profile.maxPrice) : null;
    const properties = await this.prisma.property.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        status: 'AVAILABLE',
        purpose: { in: ['SALE', 'SALE_RENTAL'] },
        ...(profile.propertyTypes.length && { type: { in: profile.propertyTypes } }),
        // pré-filtro largo no banco (com a tolerância de 10%); a regra fina é a função pura
        ...((min != null || max != null) && {
          OR: [
            { salePrice: null },
            {
              salePrice: {
                ...(min != null && { gte: min * 0.9 }),
                ...(max != null && { lte: max * 1.1 }),
              },
            },
          ],
        }),
      },
      select: {
        id: true, code: true, type: true, purpose: true, status: true, street: true, number: true,
        neighborhood: true, city: true, salePrice: true, bedrooms: true, parkingSpaces: true, privateArea: true,
        photos: { orderBy: { order: 'asc' }, take: 1, select: { url: true } },
      },
      take: 1000,
    });

    const input = {
      propertyTypes: profile.propertyTypes, cities: profile.cities, neighborhoods: profile.neighborhoods,
      minPrice: min, maxPrice: max, minBedrooms: profile.minBedrooms, minParkingSpaces: profile.minParkingSpaces,
    };
    const items = properties
      .map((p) => ({
        p,
        r: matchProfileToProperty(input, { ...p, salePrice: p.salePrice != null ? Number(p.salePrice) : null }),
      }))
      .filter((m) => m.r.match)
      .sort((a, b) => b.r.score - a.r.score)
      .slice(0, 50)
      .map(({ p, r }) => ({
        property: {
          ...p,
          salePrice: p.salePrice != null ? Number(p.salePrice) : null,
          photo: p.photos[0] ? this.files.resolveUrl(p.photos[0].url) : null,
          photos: undefined,
        },
        score: r.score,
        reasons: r.reasons,
      }));
    return { hasProfile: true, items };
  }
}

@ApiTags('contacts')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('contacts')
export class ContactInterestController {
  constructor(private readonly service: ContactInterestService) {}

  @Get(':id/interest-profile')
  get(@Headers('x-workspace-id') ws: string, @Param('id') id: string) {
    return this.service.get(ws, id);
  }

  @Put(':id/interest-profile')
  upsert(@Headers('x-workspace-id') ws: string, @Param('id') id: string, @Body() dto: UpsertInterestProfileDto) {
    return this.service.upsert(ws, id, dto);
  }

  @Get(':id/matching-properties')
  matching(@Headers('x-workspace-id') ws: string, @Param('id') id: string) {
    return this.service.matchingProperties(ws, id);
  }
}
