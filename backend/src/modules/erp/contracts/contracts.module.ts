import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { ContractTemplateService } from './contract-template.service';
import { AdjustmentService } from './adjustment.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { EmailModule } from '../../hub/email/email.module';
import { FiscalModule } from '../fiscal/fiscal.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [PrismaModule, AuditModule, EmailModule, FiscalModule, BillingModule],
  controllers: [ContractsController],
  providers: [ContractsService, ContractTemplateService, AdjustmentService],
  exports: [ContractsService, ContractTemplateService],
})
export class ContractsModule {}
