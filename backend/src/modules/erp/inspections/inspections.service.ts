// Serviço de Vistorias - entry/exit, comparativo por contrato

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateInspectionDto,
  UpdateInspectionDto,
  AddRoomDto,
  InspectionQueryDto,
} from './inspections.dto';

@Injectable()
export class InspectionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(workspaceId: string, query: InspectionQueryDto) {
    const { page = 1, limit = 20, type, propertyId, contractId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.InspectionWhereInput = {
      workspaceId,
      deletedAt: null,
      ...(type && { type }),
      ...(propertyId && { propertyId }),
      ...(contractId && { contractId }),
    };

    const [inspections, total] = await Promise.all([
      this.prisma.inspection.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          property: { select: { id: true, code: true, street: true, city: true } },
          contract: { select: { id: true, type: true } },
          _count: { select: { rooms: true } },
        },
      }),
      this.prisma.inspection.count({ where }),
    ]);

    return {
      items: inspections,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(workspaceId: string, id: string) {
    const inspection = await this.prisma.inspection.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        rooms: { orderBy: { createdAt: 'asc' } },
        property: true,
        contract: { select: { id: true, type: true } },
      },
    });
    if (!inspection) throw new NotFoundException('Vistoria não encontrada');
    return inspection;
  }

  async create(workspaceId: string, dto: CreateInspectionDto) {
    return this.prisma.inspection.create({
      data: {
        workspaceId,
        ...dto,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        doneAt: dto.doneAt ? new Date(dto.doneAt) : undefined,
      },
    });
  }

  async update(workspaceId: string, id: string, dto: UpdateInspectionDto) {
    const existing = await this.prisma.inspection.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Vistoria não encontrada');

    return this.prisma.inspection.update({
      where: { id },
      data: {
        ...dto,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        doneAt: dto.doneAt ? new Date(dto.doneAt) : undefined,
      },
    });
  }

  async addRoom(workspaceId: string, inspectionId: string, dto: AddRoomDto) {
    const inspection = await this.prisma.inspection.findFirst({
      where: { id: inspectionId, workspaceId, deletedAt: null },
    });
    if (!inspection) throw new NotFoundException('Vistoria não encontrada');

    return this.prisma.inspectionRoom.create({
      data: {
        inspectionId,
        name: dto.name,
        items: (dto.items ?? []) as Prisma.InputJsonValue,
      },
    });
  }

  async updateRoom(
    workspaceId: string,
    inspectionId: string,
    roomId: string,
    dto: AddRoomDto,
  ) {
    const room = await this.prisma.inspectionRoom.findFirst({
      where: { id: roomId, inspectionId },
    });
    if (!room) throw new NotFoundException('Cômodo não encontrado');

    return this.prisma.inspectionRoom.update({
      where: { id: roomId },
      data: {
        name: dto.name,
        items: (dto.items ?? []) as Prisma.InputJsonValue,
      },
    });
  }

  async removeRoom(workspaceId: string, inspectionId: string, roomId: string) {
    const room = await this.prisma.inspectionRoom.findFirst({
      where: { id: roomId, inspectionId },
    });
    if (!room) throw new NotFoundException('Cômodo não encontrado');

    await this.prisma.inspectionRoom.delete({ where: { id: roomId } });
    return { success: true };
  }

  // Compara vistoria de entrada vs saída do mesmo contrato
  async compare(workspaceId: string, id: string) {
    const inspection = await this.prisma.inspection.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: { rooms: true },
    });
    if (!inspection) throw new NotFoundException('Vistoria não encontrada');

    if (!inspection.contractId) {
      return { inspection, comparison: null, message: 'Vistoria sem contrato associado' };
    }

    // Busca a vistoria oposta (ENTRY se this é EXIT, e vice-versa)
    const counterType = inspection.type === 'ENTRY' ? 'EXIT' : 'ENTRY';
    const counterInspection = await this.prisma.inspection.findFirst({
      where: {
        workspaceId,
        contractId: inspection.contractId,
        type: counterType,
        deletedAt: null,
      },
      include: { rooms: true },
    });

    if (!counterInspection) {
      return { inspection, comparison: null, message: `Vistoria de ${counterType === 'ENTRY' ? 'entrada' : 'saída'} não encontrada` };
    }

    const entry = inspection.type === 'ENTRY' ? inspection : counterInspection;
    const exit = inspection.type === 'EXIT' ? inspection : counterInspection;

    // Constrói diff por cômodo
    const diffs = entry.rooms.map((entryRoom) => {
      const exitRoom = exit.rooms.find((r) => r.name === entryRoom.name);
      return {
        roomName: entryRoom.name,
        entry: entryRoom.items,
        exit: exitRoom?.items ?? [],
        hasChanges: JSON.stringify(entryRoom.items) !== JSON.stringify(exitRoom?.items ?? []),
      };
    });

    return { entry, exit, diffs };
  }
}
