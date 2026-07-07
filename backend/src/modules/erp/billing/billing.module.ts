// Módulo de Cobranças
import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AsaasClient } from './asaas.client';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BillingController],
  providers: [BillingService, AsaasClient],
  exports: [BillingService, AsaasClient],
})
export class BillingModule {}
