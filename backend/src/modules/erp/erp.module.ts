// Módulo ERP Imobiliário - Estágio 3
// Agrega todos os sub-módulos do ERP

import { Module } from '@nestjs/common';
import { PropertiesModule } from './properties/properties.module';
import { ContractsModule } from './contracts/contracts.module';
import { FinancialModule } from './financial/financial.module';
import { InspectionsModule } from './inspections/inspections.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [
    PropertiesModule,
    ContractsModule,
    FinancialModule,
    InspectionsModule,
    MaintenanceModule,
    DocumentsModule,
  ],
  exports: [
    PropertiesModule,
    ContractsModule,
    FinancialModule,
    InspectionsModule,
    MaintenanceModule,
    DocumentsModule,
  ],
})
export class ErpModule {}
