import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateNotificationPreferenceDto } from './notifications.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  async getPreferences(workspaceId: string, userId: string) {
    const prefs = await this.prisma.notificationPreference.findMany({
      where: { workspaceId, userId },
    });

    // Fase 7: os tipos de aviso que o sistema realmente gera
    const defaults = ['LEAD_NEW', 'VISIT_TODAY', 'TASK_DUE', 'PROPOSAL_STALE', 'INSTALLMENT_OVERDUE', 'AUTH_EXPIRING', 'NFSE_REJECTED'];

    const existing = new Map(prefs.map(p => [p.type, p]));
    return defaults.map(type => existing.get(type) ?? {
      workspaceId, userId, type, inApp: true, email: true, push: false,
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
        email: dto.email ?? true,
        push: dto.push ?? false,
      },
    });
  }

  async getEmailSwitch(workspaceId: string, userId: string) {
    const me = await this.prisma.workspaceUser.findFirst({ where: { workspaceId, userId }, select: { emailNotifications: true } });
    return { emailNotifications: me?.emailNotifications ?? true };
  }

  async setEmailSwitch(workspaceId: string, userId: string, enabled: boolean) {
    await this.prisma.workspaceUser.updateMany({ where: { workspaceId, userId }, data: { emailNotifications: enabled } });
    return { emailNotifications: enabled };
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
