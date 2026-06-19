// Módulo raiz da aplicação NestJS
// Configura todos os módulos globais e de funcionalidade

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
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

// Módulo ERP Imobiliário (Estágio 3)
import { ErpModule } from './modules/erp/erp.module';

// Módulo Hub de Comunicação (Estágio 4)
import { HubModule } from './modules/hub/hub.module';

// Módulo Marketing (Etapa 5)
import { MarketingModule } from './modules/marketing/marketing.module';

// Módulos Etapa 6 — Automações e Notificações
import { AutomationModule } from './modules/automation/automation.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

// Módulo Etapa 7 — Relatórios e Analytics
import { ReportsModule } from './modules/reports/reports.module';

// Módulo Etapa 8 — Integrações e API Pública
import { AdminModule } from './modules/admin/admin.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';

// Módulo Etapa 9 — Super Admin e Configurações Avançadas

@Module({
  controllers: [AppController],
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

    // ERP Imobiliário
    ErpModule,
    HubModule,

    // Marketing
    MarketingModule,

    // Automações e Notificações
    AutomationModule,
    NotificationsModule,

    // Relatórios e Analytics
    ReportsModule,

    // Integrações e API Pública
    IntegrationsModule,

    // Super Admin
    AdminModule,

    // Super Admin e Configurações Avançadas
  ],
})
export class AppModule {}

