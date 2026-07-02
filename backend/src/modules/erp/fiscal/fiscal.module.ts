// Módulo Fiscal
import { Module } from '@nestjs/common';
import { FiscalController } from './fiscal.controller';
import { FiscalService } from './fiscal.service';
import { DimobService } from './dimob.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FiscalController],
  providers: [FiscalService, DimobService],
  exports: [FiscalService, DimobService],
})
export class FiscalModule {}
