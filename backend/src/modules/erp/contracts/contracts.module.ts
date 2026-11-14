import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { ContractTemplateService } from './contract-template.service';
import { AdjustmentService } from './adjustment.service';
import { SaleLifecycleController } from './sale-lifecycle.controller';
import { SaleLifecycleService } from './sale-lifecycle.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { EmailModule } from '../../hub/email/email.module';
import { FiscalModule } from '../fiscal/fiscal.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [PrismaModule, AuditModule, EmailModule, FiscalModule, BillingModule],
  controllers: [SaleLifecycleController, ContractsController],
  providers: [ContractsService, ContractTemplateService, AdjustmentService, SaleLifecycleService],
  exports: [ContractsService, ContractTemplateService],
})
export class ContractsModule {}
