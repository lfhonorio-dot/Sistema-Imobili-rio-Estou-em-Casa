// Módulo Prisma - exporta o serviço de banco de dados globalmente

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Disponível em todos os módulos sem importação explícita
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
