import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AssetsModule } from './assets/assets.module';
import { PropertiesModule } from './properties/properties.module';
import { CashFlowModule } from './cash-flow/cash-flow.module';
import { ReceivablesModule } from './receivables/receivables.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { RetirementModule } from './retirement/retirement.module';
import { ImportModule } from './import/import.module';
import { SnapshotModule } from './snapshot/snapshot.module';
import { AdvisorModule } from './advisor/advisor.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AssetsModule,
    PropertiesModule,
    CashFlowModule,
    ReceivablesModule,
    DashboardModule,
    RetirementModule,
    ImportModule,
    SnapshotModule,
    AdvisorModule,
  ],
})
export class AppModule {}
