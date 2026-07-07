import { Module } from '@nestjs/common';
import { FinancialController } from './financial.controller';
import { FinancialService } from './financial.service';
import { DunningService } from './dunning.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../../hub/email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [FinancialController],
  providers: [FinancialService, DunningService],
  exports: [FinancialService, DunningService],
})
export class FinancialModule {}
