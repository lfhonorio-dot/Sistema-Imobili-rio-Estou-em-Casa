import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { ContractTemplateService } from './contract-template.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { EmailModule } from '../../hub/email/email.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [PrismaModule, AuditModule, EmailModule, BillingModule],
  controllers: [ContractsController],
  providers: [ContractsService, ContractTemplateService],
  exports: [ContractsService],
})
export class ContractsModule {}
