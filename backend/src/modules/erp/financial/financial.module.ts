import { Module } from '@nestjs/common';
import { FinancialController } from './financial.controller';
import { FinancialService } from './financial.service';
import { CommissionReceiptService } from './commission-receipt.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../../hub/email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [FinancialController],
  providers: [FinancialService, CommissionReceiptService],
  exports: [FinancialService],
})
export class FinancialModule {}
