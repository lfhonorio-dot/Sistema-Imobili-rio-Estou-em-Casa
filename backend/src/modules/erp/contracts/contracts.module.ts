import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { ContractTemplateService } from './contract-template.service';
import { AdjustmentService } from './adjustment.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { EmailModule } from '../../hub/email/email.module';
import { FiscalModule } from '../fiscal/fiscal.module';

@Module({
  imports: [PrismaModule, AuditModule, EmailModule, FiscalModule],
  controllers: [ContractsController],
  providers: [ContractsService, ContractTemplateService, AdjustmentService],
  exports: [ContractsService],
})
export class ContractsModule {}
