// Módulo de Conversas
import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, AuditModule, WhatsAppModule, EmailModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
