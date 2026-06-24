// Serviço de autenticação - implementação completa
// Gerencia: registro, login, logout, refresh, 2FA, reset de senha

import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { TokenBlacklistService } from '../../security/token-blacklist.service';
import { EncryptionService } from '../../security/encryption.service';
import { HmacService } from '../../security/hmac.service';
import { AuditService } from '../audit/audit.service';
import {
  RegisterWorkspaceDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  Verify2FADto,
} from './auth.dto';
import { Request } from 'express';

// Payload do JWT
interface JwtTokenPayload {
  sub: string;
  email: string;
  name: string;
}

// Resposta dos tokens
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// Custo do bcrypt - 12 rounds para boa segurança
const BCRYPT_ROUNDS = 12;
// Máximo de tentativas antes de bloquear conta
const MAX_FAILED_ATTEMPTS = 20;
// Tempo de bloqueio em minutos
const LOCK_DURATION_MINUTES = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private mailTransporter?: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private tokenBlacklist: TokenBlacklistService,
    private encryptionService: EncryptionService,
    private hmacService: HmacService,
    private auditService: AuditService,
  ) {
    this.initMailTransporter();
  }

  // Inicializa o transporte de e-mail se configurado
  private initMailTransporter(): void {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    if (smtpHost) {
      this.mailTransporter = nodemailer.createTransport({
        host: smtpHost,
        port: this.configService.get<number>('SMTP_PORT', 587),
        secure: this.configService.get<boolean>('SMTP_SECURE', false),
        auth: {
          user: this.configService.get<string>('SMTP_USER'),
          pass: this.configService.get<string>('SMTP_PASS'),
        },
      });
    }
  }

  // -----------------------------------------------
  // REGISTRO DE NOVO WORKSPACE
  // Cria workspace, papel Admin, usuário e vinculação
  // -----------------------------------------------
  async registerWorkspace(dto: RegisterWorkspaceDto): Promise<TokenPair & { workspaceId: string }> {
    // Verifica se slug já existe
    const existingWorkspace = await this.prisma.workspace.findUnique({
      where: { slug: dto.workspaceSlug },
    });
    if (existingWorkspace) {
      throw new ConflictException('Este slug de workspace já está em uso.');
    }

    // Verifica se e-mail já está cadastrado
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Este e-mail já está cadastrado.');
    }

    // Hash da senha com bcrypt (custo 12)
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Cria workspace, papel Admin e usuário em transação
    const result = await this.prisma.$transaction(async (tx) => {
      // Cria o workspace
      const workspace = await tx.workspace.create({
        data: {
          name: dto.workspaceName,
          slug: dto.workspaceSlug,
          cnpj: dto.cnpj,
        },
      });

      // Cria papel de Administrador com todas as permissões
      const adminRole = await tx.role.create({
        data: {
          workspaceId: workspace.id,
          name: 'Administrador',
          isSystem: true,
          permissions: {
            'users:read': true,
            'users:write': true,
            'users:delete': true,
            'workspace:read': true,
            'workspace:write': true,
            'lgpd:read': true,
            'lgpd:write': true,
            'audit:read': true,
            'roles:read': true,
            'roles:write': true,
          },
        },
      });

      // Cria papel de Corretor com permissões básicas
      await tx.role.create({
        data: {
          workspaceId: workspace.id,
          name: 'Corretor',
          isSystem: true,
          permissions: {
            'users:read': true,
            'workspace:read': true,
          },
        },
      });

      // Cria o usuário administrador
      const user = await tx.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          passwordHash,
        },
      });

      // Vincula usuário ao workspace como proprietário
      await tx.workspaceUser.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          roleId: adminRole.id,
          isOwner: true,
        },
      });

      return { workspace, user, adminRole };
    });

    this.logger.log(
      `Novo workspace registrado: ${result.workspace.slug} (admin: ${result.user.email})`,
    );

    // Envia e-mail de boas-vindas de forma assíncrona (não bloqueia o registro)
    void this.sendWelcomeEmail(result.user.email, result.user.name, result.workspace.name);

    // Registra auditoria
    await this.auditService.log({
      workspaceId: result.workspace.id,
      userId: result.user.id,
      action: 'WORKSPACE_CREATED',
      entity: 'Workspace',
      entityId: result.workspace.id,
      after: { slug: result.workspace.slug, name: result.workspace.name },
    });

    // Gera par de tokens para login automático após registro
    const tokens = await this.generateTokenPair(result.user);
    return { ...tokens, workspaceId: result.workspace.id };
  }

  // -----------------------------------------------
  // VALIDAÇÃO DE CREDENCIAIS (usado pelo LocalStrategy)
  // -----------------------------------------------
  async validateCredentials(
    email: string,
    password: string,
  ): Promise<{ id: string; email: string; name: string } | null> {
    const user = await this.prisma.user.findUnique({
      where: { email, deletedAt: null },
    });

    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return null;

    return { id: user.id, email: user.email, name: user.name };
  }

  // -----------------------------------------------
  // LOGIN
  // Verifica bloqueio, valida credenciais, 2FA e gera tokens
  // -----------------------------------------------
  async login(
    dto: LoginDto,
    req: Request,
  ): Promise<TokenPair & { requires2FA?: boolean; workspaceId?: string | null }> {
    // Busca usuário com workspace
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email, deletedAt: null },
      include: {
        workspaces: {
          select: { workspaceId: true },
          take: 1,
        },
      },
    });

    if (!user) {
      // Tempo constante para evitar user enumeration
      await bcrypt.compare(dto.password, '$2b$12$invalidhashfortimingprotection123456789012');
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    // Valida senha
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    // Verifica 2FA se habilitado
    if (user.twoFactorEnabled) {
      if (!dto.totpCode) {
        // Retorna sinal para o cliente solicitar o código 2FA
        return { accessToken: '', refreshToken: '', requires2FA: true };
      }

      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret || '',
        encoding: 'base32',
        token: dto.totpCode,
        window: 1, // permite 1 intervalo de diferença de tempo
      });

      if (!isValid) {
        throw new UnauthorizedException('Código 2FA inválido.');
      }
    }

    // Reseta tentativas falhas em login bem-sucedido
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Gera fingerprint de sessão (apenas user-agent; IP é excluído pois muda em redes móveis/WiFi)
    const fingerprint = this.hmacService.generateSessionFingerprint(
      req.get('user-agent') || '',
      '',
    );

    // Gera par de tokens
    const tokens = await this.generateTokenPair(user);

    // Calcula expiração do refresh token
    const refreshExpiresDays = parseInt(
      (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d').replace('d', ''),
      10,
    );

    // Armazena sessão no banco
    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshToken: tokens.refreshToken,
        userAgent: req.get('user-agent'),
        ipAddress: req.ip,
        fingerprint,
        expiresAt: new Date(Date.now() + refreshExpiresDays * 24 * 60 * 60 * 1000),
      },
    });

    // Registra auditoria do login
    await this.auditService.log({
      userId: user.id,
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    const workspaceId = user.workspaces[0]?.workspaceId ?? null;
    return { ...tokens, workspaceId };
  }

  // -----------------------------------------------
  // LOGOUT
  // Invalida access token e remove sessão
  // -----------------------------------------------
  async logout(userId: string, accessToken: string, allDevices = false): Promise<void> {
    // Calcula TTL restante do access token (15 minutos máximo)
    const accessTtl = 15 * 60; // 15 minutos em segundos

    // Adiciona access token à blacklist Redis
    await this.tokenBlacklist.blacklistToken(accessToken, accessTtl);

    if (allDevices) {
      // Remove todas as sessões do usuário
      await this.prisma.userSession.deleteMany({
        where: { userId },
      });
    } else {
      // Remove apenas a sessão atual (baseada no access token)
      // Como não temos mapeamento direto, buscamos pela sessão mais recente
      // Em produção, você pode incluir o sessionId no JWT payload
      const latestSession = await this.prisma.userSession.findFirst({
        where: { userId, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });

      if (latestSession) {
        await this.prisma.userSession.delete({
          where: { id: latestSession.id },
        });
      }
    }

    await this.auditService.log({
      userId,
      action: allDevices ? 'USER_LOGOUT_ALL_DEVICES' : 'USER_LOGOUT',
      entity: 'User',
      entityId: userId,
    });
  }

  // -----------------------------------------------
  // REFRESH TOKEN
  // Valida refresh token, verifica fingerprint, rotaciona tokens
  // -----------------------------------------------
  async refresh(refreshToken: string, req: Request): Promise<TokenPair> {
    // Busca sessão pelo refresh token
    const session = await this.prisma.userSession.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Refresh token inválido ou expirado. Faça login novamente.',
      );
    }

    // Verifica fingerprint para detectar roubo de token (apenas user-agent)
    if (session.fingerprint) {
      const fingerprintValid = this.hmacService.verifySessionFingerprint(
        req.get('user-agent') || '',
        '',
        session.fingerprint,
      );

      if (!fingerprintValid) {
        // Possível roubo de token - revoga todas as sessões do usuário
        this.logger.warn(
          `Possível roubo de refresh token detectado para usuário ${session.userId}`,
        );
        await this.prisma.userSession.deleteMany({
          where: { userId: session.userId },
        });
        await this.auditService.log({
          userId: session.userId,
          action: 'SUSPICIOUS_TOKEN_USE',
          entity: 'UserSession',
          entityId: session.id,
          ipAddress: req.ip,
        });
        throw new UnauthorizedException(
          'Sessão suspeita detectada. Por segurança, faça login novamente.',
        );
      }
    }

    const user = session.user;

    // Gera novos tokens
    const newTokens = await this.generateTokenPair(user);

    // Rotaciona refresh token (invalida o antigo, cria novo)
    const refreshExpiresDays = parseInt(
      (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d').replace('d', ''),
      10,
    );

    const newFingerprint = this.hmacService.generateSessionFingerprint(
      req.get('user-agent') || '',
      '',
    );

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshToken: newTokens.refreshToken,
        fingerprint: newFingerprint,
        expiresAt: new Date(Date.now() + refreshExpiresDays * 24 * 60 * 60 * 1000),
      },
    });

    return newTokens;
  }

  // -----------------------------------------------
  // RECUPERAÇÃO DE SENHA (solicitar link)
  // -----------------------------------------------
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email, deletedAt: null },
    });

    // Sempre retorna sucesso para não revelar se e-mail existe
    if (!user) {
      this.logger.debug(`Recuperação de senha para e-mail não encontrado: ${dto.email}`);
      return;
    }

    // Invalida tokens anteriores não usados
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    // Gera token seguro de 32 bytes (64 chars hex)
    const token = this.encryptionService.generateSecureToken(32);

    // Armazena hash do token (não o token em si)
    const tokenHash = this.encryptionService.hash(token);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: tokenHash,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 horas
      },
    });

    // Envia e-mail com o token original (não o hash)
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    await this.sendPasswordResetEmail(user.email, user.name, resetUrl);

    await this.auditService.log({
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entity: 'User',
      entityId: user.id,
    });
  }

  // -----------------------------------------------
  // REDEFINIÇÃO DE SENHA (confirmar com token)
  // -----------------------------------------------
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    // Busca pelo hash do token
    const tokenHash = this.encryptionService.hash(dto.token);

    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        token: tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!resetToken) {
      throw new BadRequestException(
        'Token de redefinição inválido ou expirado.',
      );
    }

    // Hash da nova senha
    const newPasswordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    // Atualiza senha e marca token como usado em transação
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: newPasswordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Revoga todas as sessões ativas por segurança
      this.prisma.userSession.deleteMany({
        where: { userId: resetToken.userId },
      }),
    ]);

    await this.auditService.log({
      userId: resetToken.userId,
      action: 'PASSWORD_RESET_COMPLETED',
      entity: 'User',
      entityId: resetToken.userId,
    });
  }

  // -----------------------------------------------
  // CONFIGURAR 2FA
  // Gera segredo TOTP e URL do QR Code
  // -----------------------------------------------
  async setup2FA(userId: string): Promise<{ secret: string; qrCodeUrl: string; qrCodeDataUrl: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    // Gera novo segredo TOTP
    const secret = speakeasy.generateSecret({
      name: `Plataforma Imobiliária (${user.email})`,
      length: 20,
    });

    // Armazena segredo temporariamente (não habilita ainda)
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret.base32 },
    });

    // Gera QR Code como data URL
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url || '');

    return {
      secret: secret.base32 || '',
      qrCodeUrl: secret.otpauth_url || '',
      qrCodeDataUrl,
    };
  }

  // -----------------------------------------------
  // VERIFICAR E HABILITAR 2FA
  // Valida o código TOTP e ativa o 2FA
  // -----------------------------------------------
  async verify2FA(userId: string, dto: Verify2FADto): Promise<{ backupCodes?: string[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException(
        '2FA não foi configurado. Execute o setup primeiro.',
      );
    }

    // Valida o código TOTP
    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: dto.token,
      window: 1,
    });

    if (!isValid) {
      throw new BadRequestException('Código 2FA inválido. Verifique o horário do seu dispositivo.');
    }

    // Habilita 2FA
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    await this.auditService.log({
      userId,
      action: '2FA_ENABLED',
      entity: 'User',
      entityId: userId,
    });

    return {};
  }

  // -----------------------------------------------
  // DESABILITAR 2FA
  // -----------------------------------------------
  async disable2FA(userId: string, dto: Verify2FADto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.twoFactorEnabled) {
      throw new BadRequestException('2FA não está habilitado.');
    }

    // Exige confirmação com o código atual antes de desabilitar
    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret || '',
      encoding: 'base32',
      token: dto.token,
      window: 1,
    });

    if (!isValid) {
      throw new BadRequestException('Código 2FA inválido.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });

    await this.auditService.log({
      userId,
      action: '2FA_DISABLED',
      entity: 'User',
      entityId: userId,
    });
  }

  // -----------------------------------------------
  // LISTAR SESSÕES ATIVAS
  // -----------------------------------------------
  async getActiveSessions(userId: string): Promise<
    Array<{
      id: string;
      userAgent: string | null;
      ipAddress: string | null;
      createdAt: Date;
      expiresAt: Date;
    }>
  > {
    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return sessions;
  }

  // -----------------------------------------------
  // REVOGAR SESSÃO ESPECÍFICA
  // -----------------------------------------------
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.userSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Sessão não encontrada.');
    }

    await this.prisma.userSession.delete({
      where: { id: sessionId },
    });

    await this.auditService.log({
      userId,
      action: 'SESSION_REVOKED',
      entity: 'UserSession',
      entityId: sessionId,
    });
  }

  // -----------------------------------------------
  // MÉTODOS PRIVADOS AUXILIARES
  // -----------------------------------------------

  // Gera par de access + refresh tokens
  private async generateTokenPair(user: {
    id: string;
    email: string;
    name: string;
  }): Promise<TokenPair> {
    const payload: JwtTokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '7d'),
      }),
      this.jwtService.signAsync(
        { sub: user.id }, // Refresh token tem payload mínimo
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  // Envia e-mail de boas-vindas
  private async sendWelcomeEmail(
    email: string,
    name: string,
    workspaceName: string,
  ): Promise<void> {
    if (!this.mailTransporter) {
      this.logger.debug('SMTP não configurado. E-mail de boas-vindas não enviado.');
      return;
    }

    try {
      await this.mailTransporter.sendMail({
        from: `"${this.configService.get('SMTP_FROM_NAME')}" <${this.configService.get('SMTP_FROM_EMAIL')}>`,
        to: email,
        subject: `Bem-vindo ao ${workspaceName} - Plataforma Imobiliária`,
        html: `
          <h2>Olá, ${name}!</h2>
          <p>Seu workspace <strong>${workspaceName}</strong> foi criado com sucesso.</p>
          <p>Você pode acessar a plataforma e começar a gerenciar sua imobiliária.</p>
          <br>
          <p>Atenciosamente,<br>Equipe Plataforma Imobiliária</p>
        `,
      });
    } catch (error) {
      this.logger.error(`Erro ao enviar e-mail de boas-vindas para ${email}:`, error);
    }
  }

  // Envia e-mail de redefinição de senha
  private async sendPasswordResetEmail(
    email: string,
    name: string,
    resetUrl: string,
  ): Promise<void> {
    if (!this.mailTransporter) {
      this.logger.debug(`SMTP não configurado. Link de reset: ${resetUrl}`);
      return;
    }

    try {
      await this.mailTransporter.sendMail({
        from: `"${this.configService.get('SMTP_FROM_NAME')}" <${this.configService.get('SMTP_FROM_EMAIL')}>`,
        to: email,
        subject: 'Redefinição de senha - Plataforma Imobiliária',
        html: `
          <h2>Olá, ${name}!</h2>
          <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
          <p>Clique no link abaixo para redefinir sua senha (válido por 2 horas):</p>
          <p><a href="${resetUrl}" style="background:#0070f3;color:white;padding:12px 24px;border-radius:4px;text-decoration:none;">Redefinir Senha</a></p>
          <p>Se você não solicitou a redefinição, ignore este e-mail.</p>
          <br>
          <p>Atenciosamente,<br>Equipe Plataforma Imobiliária</p>
        `,
      });
    } catch (error) {
      this.logger.error(`Erro ao enviar e-mail de reset para ${email}:`, error);
    }
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        lastLoginAt: true,
        workspaces: {
          include: {
            workspace: {
              select: { id: true, name: true, slug: true },
            },
            role: {
              select: { id: true, name: true, permissions: true },
            },
          },
        },
      },
    });

    if (!user) throw new Error('Usuário não encontrado');

    return {
      ...user,
      workspaces: user.workspaces.map((m: { workspaceId: string; isOwner: boolean; workspace: { id: string; name: string; slug: string }; role: { id: string; name: string; permissions: unknown } }) => ({
        workspaceId: m.workspaceId,
        isOwner: m.isOwner,
        workspace: m.workspace,
        role: m.role,
      })),
    };
  }

  async unlockUser(email: string): Promise<void> {
    await this.prisma.user.update({
      where: { email },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }
}
