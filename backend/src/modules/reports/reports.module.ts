import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { SalesReportsService } from './sales/sales-reports.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, SalesReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
