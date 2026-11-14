// Módulo de Contatos NestJS
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { ContactInterestController, ContactInterestService } from './contact-interest';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    MulterModule.register({ storage: require('multer').memoryStorage() }),
  ],
  controllers: [ContactInterestController, ContactsController],
  providers: [ContactsService, ContactInterestService],
  exports: [ContactsService],
})
export class ContactsModule {}
