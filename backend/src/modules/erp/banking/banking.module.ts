// Módulo Bancário
import { Module } from '@nestjs/common';
import { BankingController } from './banking.controller';
import { BankingService } from './banking.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { PaymentsModule } from '../financial/payments.module';

@Module({
  imports: [PrismaModule, PaymentsModule],
  controllers: [BankingController],
  providers: [BankingService],
  exports: [BankingService],
})
export class BankingModule {}
