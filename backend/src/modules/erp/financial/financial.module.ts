import { Module } from '@nestjs/common';
import { FinancialController } from './financial.controller';
import { FinancialOpsController } from './financial-ops.controller';
import { FinancialService } from './financial.service';
import { DunningService } from './dunning.service';
import { CommissionReceiptService } from './commission-receipt.service';
import { RecurringService } from './recurring.service';
import { CashflowService } from './cashflow.service';
import { PaymentsModule } from './payments.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../../hub/email/email.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [PrismaModule, EmailModule, PaymentsModule, BillingModule],
  controllers: [FinancialController, FinancialOpsController],
  providers: [FinancialService, DunningService, CommissionReceiptService, RecurringService, CashflowService],
  exports: [FinancialService, DunningService, CommissionReceiptService, PaymentsModule],
})
export class FinancialModule {}
