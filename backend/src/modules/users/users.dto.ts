// DTOs do módulo de usuários

import {
  IsEmail,
  IsString,
  IsOptional,
  MaxLength,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

// DTO para atualizar perfil do próprio usuário
export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Nome completo' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'Número de telefone' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}

// DTO para convidar usuário ao workspace
export class InviteUserDto {
  @ApiProperty({ description: 'E-mail do usuário a convidar' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'ID do papel a atribuir' })
  @IsUUID()
  roleId!: string;
}

// DTO para atualizar papel de usuário no workspace
export class UpdateUserRoleDto {
  @ApiProperty({ description: 'Novo papel do usuário' })
  @IsUUID()
  roleId!: string;
}

// DTO para alterar senha
export class ChangePasswordDto {
  @ApiProperty({ description: 'Senha atual' })
  @IsString()
  currentPassword!: string;

  @ApiProperty({ description: 'Nova senha' })
  @IsString()
  newPassword!: string;
}
