// Módulo CRM Core - agrega todos os sub-módulos do CRM
// Estágio 2: Contatos, Pipelines, Negócios, Atividades, Tags e Campos Personalizados

import { Module } from '@nestjs/common';
import { ContactsModule } from './contacts/contacts.module';
import { PipelinesModule } from './pipelines/pipelines.module';
import { DealsModule } from './deals/deals.module';
import { ActivitiesModule } from './activities/activities.module';
import { TagsModule } from './tags/tags.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';

@Module({
  imports: [
    ContactsModule,
    PipelinesModule,
    DealsModule,
    ActivitiesModule,
    TagsModule,
    CustomFieldsModule,
  ],
  exports: [
    ContactsModule,
    PipelinesModule,
    DealsModule,
    ActivitiesModule,
    TagsModule,
    CustomFieldsModule,
  ],
})
export class CrmModule {}
