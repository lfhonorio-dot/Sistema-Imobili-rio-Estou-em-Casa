// DTOs do módulo LGPD
// Consentimentos, requisições de titulares e incidentes de segurança

import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  MaxLength,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Tipos de requisição LGPD (art. 18)
export enum LgpdRequestType {
  ACCESS = 'ACCESS',               // Acesso aos dados
  CORRECTION = 'CORRECTION',       // Correção de dados incorretos
  DELETION = 'DELETION',           // Exclusão de dados
  PORTABILITY = 'PORTABILITY',     // Portabilidade de dados
  REVOKE_CONSENT = 'REVOKE_CONSENT', // Revogação de consentimento
  INFORMATION = 'INFORMATION',     // Informações sobre compartilhamento
}

// Status das requisições LGPD
export enum LgpdRequestStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

// Severidade de incidentes de segurança
export enum IncidentSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// DTO para registrar consentimento
export class RecordConsentDto {
  @ApiProperty({ description: 'E-mail do titular dos dados' })
  @IsEmail()
  subjectEmail!: string;

  @ApiPropertyOptional({ description: 'Nome do titular' })
  @IsOptional()
  @IsString()
  subjectName?: string;

  @ApiProperty({ description: 'ID da versão da política de privacidade' })
  @IsUUID()
  policyVersionId!: string;

  @ApiProperty({ description: 'Texto do consentimento apresentado ao titular' })
  @IsString()
  consentText!: string;

  @ApiPropertyOptional({ description: 'Endereço IP do titular' })
  @IsOptional()
  @IsString()
  ipAddress?: string;
}

// DTO para retirar consentimento
export class WithdrawConsentDto {
  @ApiProperty({ description: 'E-mail do titular que retira consentimento' })
  @IsEmail()
  subjectEmail!: string;
}

// DTO para criar requisição LGPD
export class CreateLgpdRequestDto {
  @ApiProperty({ enum: LgpdRequestType, description: 'Tipo de requisição' })
  @IsEnum(LgpdRequestType)
  type!: LgpdRequestType;

  @ApiProperty({ description: 'E-mail do titular' })
  @IsEmail()
  subjectEmail!: string;

  @ApiPropertyOptional({ description: 'Nome do titular' })
  @IsOptional()
  @IsString()
  subjectName?: string;
}

// DTO para atualizar status de requisição LGPD
export class UpdateLgpdRequestDto {
  @ApiProperty({ enum: LgpdRequestStatus, description: 'Novo status da requisição' })
  @IsEnum(LgpdRequestStatus)
  status!: LgpdRequestStatus;

  @ApiPropertyOptional({ description: 'Observações sobre o processamento' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

// DTO para criar versão de política de privacidade
export class CreatePrivacyPolicyDto {
  @ApiProperty({ description: 'Versão da política (ex: 1.0, 2.1)' })
  @IsString()
  version!: string;

  @ApiProperty({ description: 'Conteúdo completo da política' })
  @IsString()
  content!: string;

  @ApiProperty({ description: 'Data de vigência da política' })
  @IsDateString()
  effectiveAt!: string;
}

// DTO para registrar incidente de segurança
export class CreateSecurityIncidentDto {
  @ApiProperty({ description: 'Título do incidente' })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ description: 'Descrição detalhada do incidente' })
  @IsString()
  description!: string;

  @ApiProperty({ enum: IncidentSeverity, description: 'Severidade do incidente' })
  @IsEnum(IncidentSeverity)
  severity!: IncidentSeverity;

  @ApiPropertyOptional({ description: 'Dados afetados pelo incidente' })
  @IsOptional()
  @IsString()
  affectedData?: string;
}
