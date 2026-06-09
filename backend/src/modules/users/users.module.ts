// Módulo de usuários

import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SecurityModule } from '../../security/security.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [SecurityModule, AuditModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
