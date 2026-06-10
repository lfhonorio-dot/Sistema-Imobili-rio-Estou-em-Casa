// Serviço de Atividades - lógica de negócio
// Gerencia: notas, tarefas, ligações, visitas, reuniões e calendário

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateActivityDto,
  UpdateActivityDto,
  ActivityQueryDto,
  CalendarQueryDto,
} from './activities.dto';

@Injectable()
export class ActivitiesService {
  constructor(private prisma: PrismaService) {}

  // Lista atividades com filtros
  async findAll(workspaceId: string, userId: string, query: ActivityQueryDto) {
    const {
      page = 1,
      limit = 20,
      type,
      contactId,
      dealId,
      startDate,
      endDate,
      done,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.ActivityWhereInput = {
      workspaceId,
      deletedAt: null,
      ...(type && { type }),
      ...(contactId && { contactId }),
      ...(dealId && { dealId }),
      ...(startDate && { dueAt: { gte: new Date(startDate) } }),
      ...(endDate && { dueAt: { lte: new Date(endDate) } }),
      ...(done === 'true' && { doneAt: { not: null } }),
      ...(done === 'false' && { doneAt: null }),
    };

    const [activities, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
        include: {
          contact: { select: { id: true, name: true } },
          deal: { select: { id: true, title: true } },
        },
      }),
      this.prisma.activity.count({ where }),
    ]);

    return {
      success: true,
      data: activities,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  // Busca atividade por ID
  async findOne(workspaceId: string, id: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        contact: { select: { id: true, name: true } },
        deal: { select: { id: true, title: true } },
      },
    });

    if (!activity) throw new NotFoundException('Atividade não encontrada');

    return { success: true, data: activity };
  }

  // Cria nova atividade
  async create(workspaceId: string, userId: string, dto: CreateActivityDto) {
    const activity = await this.prisma.activity.create({
      data: {
        workspaceId,
        type: dto.type,
        title: dto.title,
        content: dto.content,
        contactId: dto.contactId,
        dealId: dto.dealId,
        userId,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        priority: dto.priority,
        reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : undefined,
        recurrence: dto.recurrence,
      },
    });

    // Atualiza lastActivityAt do negócio relacionado
    if (dto.dealId) {
      await this.prisma.deal.update({
        where: { id: dto.dealId },
        data: { lastActivityAt: new Date() },
      });
    }

    return { success: true, data: activity };
  }

  // Atualiza atividade
  async update(workspaceId: string, id: string, dto: UpdateActivityDto) {
    const existing = await this.prisma.activity.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!existing) throw new NotFoundException('Atividade não encontrada');

    const updated = await this.prisma.activity.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.dueAt !== undefined && { dueAt: dto.dueAt ? new Date(dto.dueAt) : null }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.reminderAt !== undefined && { reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : null }),
      },
    });

    return { success: true, data: updated };
  }

  // Soft delete de atividade
  async remove(workspaceId: string, id: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!activity) throw new NotFoundException('Atividade não encontrada');

    await this.prisma.activity.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true, data: { deleted: true } };
  }

  // Marca atividade como concluída
  async markDone(workspaceId: string, id: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!activity) throw new NotFoundException('Atividade não encontrada');

    const updated = await this.prisma.activity.update({
      where: { id },
      data: { doneAt: new Date() },
    });

    return { success: true, data: updated };
  }

  // Retorna atividades para visualização de calendário
  async getCalendar(workspaceId: string, query: CalendarQueryDto) {
    const now = new Date();
    const year = query.year ?? now.getFullYear();
    const month = query.month ?? now.getMonth() + 1;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const activities = await this.prisma.activity.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        type: { in: ['TASK', 'CALL', 'VISIT', 'MEETING'] },
        dueAt: { gte: startDate, lte: endDate },
      },
      orderBy: { dueAt: 'asc' },
      include: {
        contact: { select: { id: true, name: true } },
        deal: { select: { id: true, title: true } },
      },
    });

    // Agrupa por dia
    const byDay: Record<string, typeof activities> = {};
    for (const activity of activities) {
      if (activity.dueAt) {
        const day = activity.dueAt.toISOString().split('T')[0];
        if (!byDay[day]) byDay[day] = [];
        byDay[day].push(activity);
      }
    }

    return { success: true, data: { activities, byDay } };
  }

  // Retorna tarefas pendentes para hoje
  async getToday(workspaceId: string) {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const activities = await this.prisma.activity.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        doneAt: null,
        dueAt: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: [{ priority: 'asc' }, { dueAt: 'asc' }],
      include: {
        contact: { select: { id: true, name: true } },
        deal: { select: { id: true, title: true } },
      },
    });

    return { success: true, data: activities };
  }
}
