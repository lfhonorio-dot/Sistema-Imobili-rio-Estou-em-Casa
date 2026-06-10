// Módulo de Contatos NestJS
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    MulterModule.register({ dest: '/tmp' }),
  ],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
