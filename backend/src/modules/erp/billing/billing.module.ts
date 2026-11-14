// Módulo de Cobranças
import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AsaasClient } from './asaas.client';
import { PrismaModule } from '../../prisma/prisma.module';
import { SecurityModule } from '../../../security/security.module';
import { PaymentsModule } from '../financial/payments.module';
import { EmailModule } from '../../hub/email/email.module';
import { WhatsAppModule } from '../../hub/whatsapp/whatsapp.module';

@Module({
  imports: [PrismaModule, SecurityModule, PaymentsModule, EmailModule, WhatsAppModule],
  controllers: [BillingController],
  providers: [BillingService, AsaasClient],
  exports: [BillingService, AsaasClient],
})
export class BillingModule {}
