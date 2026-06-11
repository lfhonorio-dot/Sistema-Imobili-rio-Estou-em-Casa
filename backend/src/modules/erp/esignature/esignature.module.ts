// Módulo de Assinatura Eletrônica
import { Module } from '@nestjs/common';
import { EsignatureController } from './esignature.controller';
import { EsignatureService } from './esignature.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EsignatureController],
  providers: [EsignatureService],
  exports: [EsignatureService],
})
export class EsignatureModule {}
