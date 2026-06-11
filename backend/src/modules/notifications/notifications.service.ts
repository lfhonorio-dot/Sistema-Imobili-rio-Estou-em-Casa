import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateNotificationPreferenceDto, CreateInAppNotificationDto } from './notifications.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  async getPreferences(workspaceId: string, userId: string) {
    const prefs = await this.prisma.notificationPreference.findMany({
      where: { workspaceId, userId },
    });

    const defaults = [
      'DEAL_CREATED', 'DEAL_WON', 'DEAL_LOST', 'TASK_DUE', 'LEAD_RECEIVED',
      'CONTRACT_EXPIRING', 'BOLETO_OVERDUE', 'MAINTENANCE_OPENED',
    ];

    const existing = new Map(prefs.map(p => [p.type, p]));
    return defaults.map(type => existing.get(type) ?? {
      workspaceId, userId, type, inApp: true, email: false, push: false,
    });
  }

  async updatePreference(workspaceId: string, userId: string, dto: UpdateNotificationPreferenceDto) {
    return this.prisma.notificationPreference.upsert({
      where: { workspaceId_userId_type: { workspaceId, userId, type: dto.type } },
      update: {
        ...(dto.inApp !== undefined && { inApp: dto.inApp }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.push !== undefined && { push: dto.push }),
      },
      create: {
        workspaceId,
        userId,
        type: dto.type,
        inApp: dto.inApp ?? true,
        email: dto.email ?? false,
        push: dto.push ?? false,
      },
    });
  }

  async createNotification(workspaceId: string, dto: CreateInAppNotificationDto) {
    // In-app notifications are stored as a simple log — no dedicated model yet
    // Returns simulated notification IDs for now
    const notifType = dto.type ?? 'INFO';
    const targets = dto.userIds ?? [];

    this.logger.log(`Notification [${notifType}] sent to ${targets.length} users in workspace ${workspaceId}`);

    return {
      sent: targets.length,
      title: dto.title,
      body: dto.body,
      type: notifType,
      entityId: dto.entityId,
      entityType: dto.entityType,
      userIds: targets,
      createdAt: new Date().toISOString(),
    };
  }

  async getStats(workspaceId: string) {
    const total = await this.prisma.notificationPreference.count({ where: { workspaceId } });
    const emailEnabled = await this.prisma.notificationPreference.count({
      where: { workspaceId, email: true },
    });
    const pushEnabled = await this.prisma.notificationPreference.count({
      where: { workspaceId, push: true },
    });
    return { total, emailEnabled, pushEnabled };
  }
}
