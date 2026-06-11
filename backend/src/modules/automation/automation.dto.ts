import {
  IsString, IsOptional, IsEnum, IsArray, IsObject, IsBoolean, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum AutomationTrigger {
  DEAL_CREATED = 'DEAL_CREATED',
  DEAL_STAGE_CHANGED = 'DEAL_STAGE_CHANGED',
  DEAL_WON = 'DEAL_WON',
  DEAL_LOST = 'DEAL_LOST',
  TAG_ADDED = 'TAG_ADDED',
  TAG_REMOVED = 'TAG_REMOVED',
  LEAD_META_ADS = 'LEAD_META_ADS',
  LEAD_GOOGLE_ADS = 'LEAD_GOOGLE_ADS',
  LEAD_PORTAL = 'LEAD_PORTAL',
  CONTRACT_CREATED = 'CONTRACT_CREATED',
  CONTRACT_EXPIRING = 'CONTRACT_EXPIRING',
  BOLETO_OVERDUE = 'BOLETO_OVERDUE',
  BOLETO_PAID = 'BOLETO_PAID',
  MAINTENANCE_OPENED = 'MAINTENANCE_OPENED',
  WHATSAPP_RECEIVED = 'WHATSAPP_RECEIVED',
  WEBHOOK_RECEIVED = 'WEBHOOK_RECEIVED',
  INACTIVITY = 'INACTIVITY',
  SCHEDULED = 'SCHEDULED',
}

export class AutomationStepDto {
  @IsString() type!: string; // SEND_WHATSAPP, SEND_EMAIL, CREATE_TASK, MOVE_DEAL, ASSIGN, ADD_TAG, REMOVE_TAG, NOTE, WEBHOOK, DELAY, CONDITION
  @IsOptional() @IsObject() config?: Record<string, unknown>;
}

export class CreateAutomationDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(AutomationTrigger) trigger!: AutomationTrigger;
  @IsOptional() @IsObject() triggerConfig?: Record<string, unknown>;
  @IsArray() @ValidateNested({ each: true }) @Type(() => AutomationStepDto) steps!: AutomationStepDto[];
}

export class UpdateAutomationDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(AutomationTrigger) trigger?: AutomationTrigger;
  @IsOptional() @IsObject() triggerConfig?: Record<string, unknown>;
  @IsOptional() @IsArray() steps?: AutomationStepDto[];
  @IsOptional() @IsBoolean() status?: boolean; // true=ACTIVE, false=PAUSED
}

export class TriggerAutomationDto {
  @IsEnum(AutomationTrigger) trigger!: AutomationTrigger;
  @IsOptional() @IsString() entityId?: string;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsObject() context?: Record<string, unknown>;
}
