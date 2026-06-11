// Serviço de Notificações — persistência e leitura
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationQueryDto } from './notifications.dto';

export interface CreateNotificationInput {
  workspaceId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(input: CreateNotificationInput) {
    return this.prisma.notification.create({ data: input });
  }

  async findAll(workspaceId: string, userId: string, query: NotificationQueryDto) {
    const { page = 1, limit = 20, unreadOnly } = query;
    const skip = (page - 1) * limit;

    const where = {
      workspaceId,
      userId,
      ...(unreadOnly && { readAt: null }),
    };

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async markRead(workspaceId: string, userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, workspaceId, userId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(workspaceId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { workspaceId, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async getUnreadCount(workspaceId: string, userId: string) {
    const count = await this.prisma.notification.count({
      where: { workspaceId, userId, readAt: null },
    });
    return { count };
  }
}
