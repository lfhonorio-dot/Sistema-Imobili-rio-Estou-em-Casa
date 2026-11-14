// Fase 5 — motor de baixas e configurações do financeiro, compartilhados por
// Financeiro, Cobranças (webhook do gateway) e Bancário (conciliação).
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PaymentsService } from './payments.service';
import { FinancialConfigService } from './financial-config.service';

@Module({
  imports: [PrismaModule],
  providers: [PaymentsService, FinancialConfigService],
  exports: [PaymentsService, FinancialConfigService],
})
export class PaymentsModule {}
