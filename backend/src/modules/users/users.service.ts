// Serviço de gerenciamento de usuários
// Perfil, convites, papéis e administração de membros do workspace

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EncryptionService } from '../../security/encryption.service';
import {
  UpdateProfileDto,
  InviteUserDto,
  UpdateUserRoleDto,
  ChangePasswordDto,
} from './users.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private encryptionService: EncryptionService,
  ) {}

  // Busca perfil do usuário atual
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        twoFactorEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        workspaces: {
          include: {
            workspace: { select: { id: true, name: true, slug: true } },
            role: { select: { id: true, name: true, permissions: true } },
          },
        },
      },
    });

    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return user;
  }

  // Atualiza perfil do usuário
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const before = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, phone: true },
    });

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { ...dto },
      select: { id: true, email: true, name: true, phone: true, avatar: true },
    });

    await this.auditService.log({
      userId,
      action: 'PROFILE_UPDATED',
      entity: 'User',
      entityId: userId,
      before,
      after: dto,
    });

    return updated;
  }

  // Altera senha do próprio usuário
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    const isCurrentValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new BadRequestException('Senha atual incorreta.');
    }

    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Revoga todas as sessões por segurança
    await this.prisma.userSession.deleteMany({ where: { userId } });

    await this.auditService.log({
      userId,
      action: 'PASSWORD_CHANGED',
      entity: 'User',
      entityId: userId,
    });
  }

  // Lista membros do workspace
  async listWorkspaceMembers(workspaceId: string) {
    return this.prisma.workspaceUser.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            avatar: true,
            lastLoginAt: true,
            deletedAt: true,
          },
        },
        role: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Convida usuário ao workspace por e-mail
  async inviteUser(workspaceId: string, invitedBy: string, dto: InviteUserDto) {
    // Verifica se papel existe no workspace
    const role = await this.prisma.role.findFirst({
      where: { id: dto.roleId, workspaceId },
    });
    if (!role) throw new NotFoundException('Papel não encontrado neste workspace.');

    // Verifica se já existe convite pendente
    const existingInvite = await this.prisma.inviteToken.findFirst({
      where: {
        workspaceId,
        email: dto.email,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      throw new ConflictException('Já existe um convite pendente para este e-mail.');
    }

    // Gera token de convite
    const token = this.encryptionService.generateSecureToken(32);

    const invite = await this.prisma.inviteToken.create({
      data: {
        workspaceId,
        email: dto.email,
        roleId: dto.roleId,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
      },
    });

    await this.auditService.log({
      workspaceId,
      userId: invitedBy,
      action: 'USER_INVITED',
      entity: 'InviteToken',
      entityId: invite.id,
      after: { email: dto.email, roleId: dto.roleId },
    });

    return { inviteToken: token, expiresAt: invite.expiresAt };
  }

  // Atualiza papel de membro no workspace
  async updateMemberRole(
    workspaceId: string,
    targetUserId: string,
    updatedBy: string,
    dto: UpdateUserRoleDto,
  ) {
    // Não permite alterar papel do proprietário
    const targetMember = await this.prisma.workspaceUser.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });

    if (!targetMember) throw new NotFoundException('Membro não encontrado.');
    if (targetMember.isOwner) {
      throw new ForbiddenException('Não é possível alterar o papel do proprietário.');
    }

    const role = await this.prisma.role.findFirst({
      where: { id: dto.roleId, workspaceId },
    });
    if (!role) throw new NotFoundException('Papel não encontrado.');

    const updated = await this.prisma.workspaceUser.update({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      data: { roleId: dto.roleId },
      include: { role: true },
    });

    await this.auditService.log({
      workspaceId,
      userId: updatedBy,
      action: 'MEMBER_ROLE_UPDATED',
      entity: 'WorkspaceUser',
      entityId: updated.id,
      before: { roleId: targetMember.roleId },
      after: { roleId: dto.roleId },
    });

    return updated;
  }

  // Remove membro do workspace (não exclui o usuário)
  async removeMember(workspaceId: string, targetUserId: string, removedBy: string): Promise<void> {
    const member = await this.prisma.workspaceUser.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });

    if (!member) throw new NotFoundException('Membro não encontrado.');
    if (member.isOwner) {
      throw new ForbiddenException('Não é possível remover o proprietário do workspace.');
    }

    await this.prisma.workspaceUser.delete({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });

    await this.auditService.log({
      workspaceId,
      userId: removedBy,
      action: 'MEMBER_REMOVED',
      entity: 'WorkspaceUser',
      entityId: member.id,
    });
  }
}
