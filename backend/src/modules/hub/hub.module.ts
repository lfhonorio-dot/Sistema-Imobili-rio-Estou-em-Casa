// Módulo Hub de Comunicação — agrupa todos os sub-módulos
import { Module } from '@nestjs/common';
import { ConversationsModule } from './conversations/conversations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EmailModule } from './email/email.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    ConversationsModule,
    NotificationsModule,
    EmailModule,
    WhatsAppModule,
  ],
  exports: [
    ConversationsModule,
    NotificationsModule,
    EmailModule,
    WhatsAppModule,
  ],
})
export class HubModule {}
