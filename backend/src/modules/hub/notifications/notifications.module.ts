// Módulo de Notificações
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { NotificationRulesService } from './notification-rules.service';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationRulesService],
  exports: [NotificationsService, NotificationRulesService],
})
export class NotificationsModule {}
