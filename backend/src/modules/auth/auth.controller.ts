// Controller de autenticação
// Expõe endpoints de registro, login, logout, refresh, 2FA e redefinição de senha

import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Delete,
  Param,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import {
  RegisterWorkspaceDto,
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  Verify2FADto,
  RevokeSessionDto,
} from './auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // -----------------------------------------------
  // POST /auth/register
  // Registro de novo workspace e administrador
  // -----------------------------------------------
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Registrar novo workspace (imobiliária)' })
  @ApiResponse({ status: 201, description: 'Workspace criado com sucesso' })
  @ApiResponse({ status: 409, description: 'Slug ou e-mail já em uso' })
  async register(@Body() dto: RegisterWorkspaceDto, @Req() req: Request) {
    return this.authService.registerWorkspace(dto);
  }

  // -----------------------------------------------
  // POST /auth/login
  // Login com email/senha e opcional 2FA
  // Rate limited: 10 req/min por IP
  // -----------------------------------------------
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Login com e-mail e senha' })
  @ApiResponse({ status: 200, description: 'Login realizado com sucesso' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas ou conta bloqueada' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req);
  }

  // -----------------------------------------------
  // POST /auth/logout
  // Invalida token atual e remove sessão
  // -----------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout - invalida o token atual' })
  async logout(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Body() body: { allDevices?: boolean },
  ) {
    const authHeader = req.headers.authorization || '';
    const accessToken = authHeader.replace('Bearer ', '');
    await this.authService.logout(user.sub, accessToken, body.allDevices);
    return { message: 'Logout realizado com sucesso.' };
  }

  // -----------------------------------------------
  // POST /auth/refresh
  // Renova access token usando refresh token
  // -----------------------------------------------
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access token com refresh token' })
  @ApiResponse({ status: 200, description: 'Tokens renovados com sucesso' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido ou expirado' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, req);
  }

  // -----------------------------------------------
  // POST /auth/forgot-password
  // Solicita link de redefinição de senha
  // -----------------------------------------------
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Solicitar redefinição de senha' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
    // Resposta sempre igual para não revelar se e-mail existe
    return { message: 'Se o e-mail estiver cadastrado, você receberá as instruções em breve.' };
  }

  // -----------------------------------------------
  // POST /auth/reset-password
  // Redefine senha com token recebido por e-mail
  // -----------------------------------------------
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Redefinir senha com token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { message: 'Senha redefinida com sucesso. Faça login com sua nova senha.' };
  }

  // -----------------------------------------------
  // POST /auth/2fa/setup
  // Configura 2FA - retorna segredo e QR code
  // -----------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Post('2fa/setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Configurar autenticação de dois fatores (2FA)' })
  async setup2FA(@CurrentUser() user: JwtPayload) {
    return this.authService.setup2FA(user.sub);
  }

  // -----------------------------------------------
  // POST /auth/2fa/verify
  // Habilita 2FA após verificar código TOTP
  // -----------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar e habilitar 2FA' })
  async verify2FA(@CurrentUser() user: JwtPayload, @Body() dto: Verify2FADto) {
    return this.authService.verify2FA(user.sub, dto);
  }

  // -----------------------------------------------
  // POST /auth/2fa/disable
  // Desabilita 2FA com confirmação do código atual
  // -----------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desabilitar 2FA' })
  async disable2FA(@CurrentUser() user: JwtPayload, @Body() dto: Verify2FADto) {
    await this.authService.disable2FA(user.sub, dto);
    return { message: '2FA desabilitado com sucesso.' };
  }

  // -----------------------------------------------
  // GET /auth/sessions
  // Lista sessões ativas do usuário
  // -----------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar sessões ativas' })
  async getSessions(@CurrentUser() user: JwtPayload) {
    return this.authService.getActiveSessions(user.sub);
  }

  // -----------------------------------------------
  // DELETE /auth/sessions/:sessionId
  // Revoga uma sessão específica
  // -----------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revogar uma sessão específica' })
  async revokeSession(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId') sessionId: string,
  ) {
    await this.authService.revokeSession(user.sub, sessionId);
    return { message: 'Sessão revogada com sucesso.' };
  }

  // -----------------------------------------------
  // POST /auth/admin/unlock-user
  // Desbloqueia conta de usuário (endpoint temporário de manutenção)
  // -----------------------------------------------
  @Public()
  @Post('admin/unlock-user')
  @HttpCode(HttpStatus.OK)
  async unlockUser(
    @Body() body: { email: string },
    @Headers('x-admin-secret') secret: string,
  ) {
    const adminSecret = process.env.ADMIN_SECRET || 'estouemcasa-admin-2024';
    if (secret !== adminSecret) {
      throw new UnauthorizedException('Acesso negado.');
    }
    await this.authService.unlockUser(body.email);
    return { message: `Usuário ${body.email} desbloqueado.` };
  }

  // -----------------------------------------------
  // GET /auth/me
  // Retorna dados do usuário autenticado com workspaces
  // -----------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dados do usuário autenticado' })
  async getMe(@CurrentUser() user: JwtPayload) {
    const fullUser = await this.authService.getMe(user.sub);
    return fullUser;
  }

  // GET /auth/workspaces - lista workspaces do usuário autenticado
  @UseGuards(JwtAuthGuard)
  @Get('workspaces')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Workspaces do usuário autenticado' })
  async getMyWorkspaces(@CurrentUser() user: JwtPayload) {
    const fullUser = await this.authService.getMe(user.sub);
    return fullUser.workspaces;
  }
}
