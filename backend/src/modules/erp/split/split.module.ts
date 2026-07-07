// Módulo de Split de Pagamento
import { Module } from '@nestjs/common';
import { SplitController } from './split.controller';
import { SplitService } from './split.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [PrismaModule, BillingModule],
  controllers: [SplitController],
  providers: [SplitService],
  exports: [SplitService],
})
export class SplitModule {}
