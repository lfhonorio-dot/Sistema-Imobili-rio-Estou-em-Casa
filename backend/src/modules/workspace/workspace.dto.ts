// DTOs do módulo de workspace

import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEmail,
  MaxLength,
  Matches,
  IsObject,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

// DTO para atualizar configurações do workspace
export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ description: 'Nome da imobiliária' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'CNPJ da empresa' })
  @IsOptional()
  @IsString()
  cnpj?: string;

  @ApiPropertyOptional({ description: 'Endereço completo' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Telefone de contato' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Fuso horário (ex: America/Sao_Paulo)' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Nome do DPO (Encarregado de Dados)' })
  @IsOptional()
  @IsString()
  dpoName?: string;

  @ApiPropertyOptional({ description: 'E-mail do DPO' })
  @IsOptional()
  @IsEmail()
  dpoEmail?: string;

  @ApiPropertyOptional({ description: 'Exigir 2FA para todos os membros' })
  @IsOptional()
  @IsBoolean()
  twoFactorRequired?: boolean;
}

// DTO para criar papel no workspace
export class CreateRoleDto {
  @ApiProperty({ description: 'Nome do papel' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: 'Permissões do papel (objeto JSON)' })
  @IsOptional()
  @IsObject()
  permissions?: Record<string, boolean>;
}

// DTO para atualizar papel
export class UpdateRoleDto {
  @ApiPropertyOptional({ description: 'Nome do papel' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Permissões do papel' })
  @IsOptional()
  @IsObject()
  permissions?: Record<string, boolean>;
}
