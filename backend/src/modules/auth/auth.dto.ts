// DTOs de autenticação com validação class-validator
// Todos os inputs da API são validados antes de processar

import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// DTO de registro de novo workspace
export class RegisterWorkspaceDto {
  @ApiProperty({ description: 'Nome da imobiliária/empresa' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  workspaceName!: string;

  @ApiProperty({ description: 'Slug único do workspace (apenas letras, números e hífens)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug deve conter apenas letras minúsculas, números e hífens',
  })
  @MaxLength(100)
  workspaceSlug!: string;

  @ApiProperty({ description: 'E-mail do administrador' })
  @IsEmail({}, { message: 'E-mail inválido' })
  email!: string;

  @ApiProperty({ description: 'Nome completo do administrador' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ description: 'Senha (mínimo 8 caracteres, com letra maiúscula, minúscula, número e símbolo)' })
  @IsString()
  @MinLength(8, { message: 'Senha deve ter no mínimo 8 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Senha deve conter letra maiúscula, minúscula, número e símbolo',
  })
  password!: string;

  @ApiPropertyOptional({ description: 'CNPJ da empresa' })
  @IsOptional()
  @IsString()
  cnpj?: string;
}

// DTO de login
export class LoginDto {
  @ApiProperty({ description: 'E-mail do usuário' })
  @IsEmail({}, { message: 'E-mail inválido' })
  email!: string;

  @ApiProperty({ description: 'Senha do usuário' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiPropertyOptional({ description: 'Código TOTP para 2FA (6 dígitos)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Código 2FA deve ter 6 dígitos' })
  totpCode?: string;
}

// DTO de refresh token
export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token para renovar access token' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

// DTO de logout
export class LogoutDto {
  @ApiPropertyOptional({ description: 'Logout em todos os dispositivos' })
  @IsOptional()
  allDevices?: boolean;
}

// DTO de redefinição de senha (solicitação)
export class ForgotPasswordDto {
  @ApiProperty({ description: 'E-mail cadastrado para envio do link de redefinição' })
  @IsEmail({}, { message: 'E-mail inválido' })
  email!: string;
}

// DTO de redefinição de senha (confirmação)
export class ResetPasswordDto {
  @ApiProperty({ description: 'Token recebido por e-mail' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ description: 'Nova senha' })
  @IsString()
  @MinLength(8, { message: 'Senha deve ter no mínimo 8 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Senha deve conter letra maiúscula, minúscula, número e símbolo',
  })
  newPassword!: string;
}

// DTO de verificação do 2FA
export class Verify2FADto {
  @ApiProperty({ description: 'Código TOTP de 6 dígitos' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Código deve ter exatamente 6 dígitos' })
  token!: string;
}

// DTO de revogação de sessão específica
export class RevokeSessionDto {
  @ApiProperty({ description: 'ID da sessão a revogar' })
  @IsString()
  @IsNotEmpty()
  sessionId!: string;
}
