// Módulo raiz da aplicação NestJS
// Configura todos os módulos globais e de funcionalidade

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnv } from './config/env.config';

// Módulos de infraestrutura
import { PrismaModule } from './modules/prisma/prisma.module';
import { SecurityModule } from './security/security.module';

// Módulos de funcionalidade
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { LgpdModule } from './modules/lgpd/lgpd.module';
import { AuditModule } from './modules/audit/audit.module';

// Módulo CRM Core (Estágio 2)
import { CrmModule } from './modules/crm/crm.module';

@Module({
  imports: [
    // Configuração de variáveis de ambiente com validação Zod
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      cache: true,
    }),

    // Rate limiting global (100 req/min) - auth tem limite próprio no controller
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60000, // 1 minuto em ms
        limit: 100,
      },
    ]),

    // Emissor de eventos para comunicação entre módulos
    EventEmitterModule.forRoot(),

    // Agendamento de tarefas
    ScheduleModule.forRoot(),

    // Módulos de infraestrutura (globais)
    PrismaModule,
    SecurityModule,

    // Módulos de funcionalidade
    AuthModule,
    UsersModule,
    WorkspaceModule,
    LgpdModule,
    AuditModule,

    // CRM Core
    CrmModule,
  ],
})
export class AppModule {}
