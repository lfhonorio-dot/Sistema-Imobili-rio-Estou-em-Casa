// Serviço de Campos Personalizados
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCustomFieldDto,
  UpdateCustomFieldDto,
  CustomFieldQueryDto,
} from './custom-fields.dto';

@Injectable()
export class CustomFieldsService {
  constructor(private prisma: PrismaService) {}

  async findAll(workspaceId: string, query: CustomFieldQueryDto) {
    const fields = await this.prisma.customField.findMany({
      where: {
        workspaceId,
        ...(query.module && { module: query.module }),
      },
      orderBy: [{ module: 'asc' }, { order: 'asc' }],
    });

    return { success: true, data: fields };
  }

  async create(workspaceId: string, dto: CreateCustomFieldDto) {
    const field = await this.prisma.customField.create({
      data: {
        workspaceId,
        module: dto.module,
        name: dto.name,
        key: dto.key,
        type: dto.type,
        options: (dto.options ?? null) as Prisma.NullableJsonNullValueInput | Prisma.JsonObject,
        required: dto.required ?? false,
        order: dto.order ?? 0,
      },
    });

    return { success: true, data: field };
  }

  async update(workspaceId: string, id: string, dto: UpdateCustomFieldDto) {
    const field = await this.prisma.customField.findFirst({
      where: { id, workspaceId },
    });

    if (!field) throw new NotFoundException('Campo personalizado não encontrado');

    const updated = await this.prisma.customField.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.options !== undefined && { options: dto.options as Prisma.NullableJsonNullValueInput | Prisma.JsonObject }),
        ...(dto.required !== undefined && { required: dto.required }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
    });

    return { success: true, data: updated };
  }

  async remove(workspaceId: string, id: string) {
    const field = await this.prisma.customField.findFirst({
      where: { id, workspaceId },
    });

    if (!field) throw new NotFoundException('Campo personalizado não encontrado');

    await this.prisma.customField.delete({ where: { id } });

    return { success: true, data: { deleted: true } };
  }
}
