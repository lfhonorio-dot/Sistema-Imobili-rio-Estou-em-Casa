// Fase 3 — funil de venda: visitas, propostas e ligação negócio → contrato.
import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { DealFunnelController, ProposalsController, VisitsController } from './funnel.controller';
import { VisitsService } from './visits.service';
import { ProposalsService } from './proposals.service';
import { DealFunnelService } from './deal-funnel.service';

@Module({
  imports: [AuditModule],
  controllers: [VisitsController, ProposalsController, DealFunnelController],
  providers: [VisitsService, ProposalsService, DealFunnelService],
  exports: [VisitsService, ProposalsService, DealFunnelService],
})
export class FunnelModule {}
