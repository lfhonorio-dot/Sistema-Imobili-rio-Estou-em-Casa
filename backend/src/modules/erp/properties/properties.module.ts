// Módulo de Imóveis
import { Module } from '@nestjs/common';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { PropertyRegistryController } from './property-registry.controller';
import { PropertyRegistryService } from './property-registry.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  // PropertyRegistryController primeiro: a rota fixa
  // GET /properties/authorizations/expiring precisa ser registrada antes
  // das rotas com parâmetro.
  controllers: [PropertyRegistryController, PropertiesController],
  providers: [PropertiesService, PropertyRegistryService],
  exports: [PropertiesService, PropertyRegistryService],
})
export class PropertiesModule {}
