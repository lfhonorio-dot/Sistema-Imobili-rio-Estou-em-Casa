// Serviço de gerenciamento de workspace
// Configurações, papéis e administração do workspace

import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateWorkspaceDto, CreateRoleDto, UpdateRoleDto } from './workspace.dto';

@Injectable()
export class WorkspaceService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // Busca dados do workspace
  async getWorkspace(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId, deletedAt: null },
      include: {
        roles: {
          select: { id: true, name: true, isSystem: true, permissions: true },
        },
        _count: {
          select: { users: true },
        },
      },
    });

    if (!workspace) throw new NotFoundException('Workspace não encontrado.');
    return workspace;
  }

  // Atualiza configurações do workspace
  async updateWorkspace(workspaceId: string, userId: string, dto: UpdateWorkspaceDto) {
    const before = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, cnpj: true, address: true, phone: true, twoFactorRequired: true },
    });

    const updated = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: dto,
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'WORKSPACE_UPDATED',
      entity: 'Workspace',
      entityId: workspaceId,
      before,
      after: dto,
    });

    return updated;
  }

  // Lista papéis do workspace
  async listRoles(workspaceId: string) {
    return this.prisma.role.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        isSystem: true,
        permissions: true,
        createdAt: true,
        _count: { select: { workspaceUsers: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Cria papel personalizado
  async createRole(workspaceId: string, userId: string, dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({
      where: { workspaceId_name: { workspaceId, name: dto.name } },
    });
    if (existing) throw new ConflictException('Já existe um papel com este nome.');

    const role = await this.prisma.role.create({
      data: {
        workspaceId,
        name: dto.name,
        permissions: dto.permissions || {},
      },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'ROLE_CREATED',
      entity: 'Role',
      entityId: role.id,
      after: dto,
    });

    return role;
  }

  // Atualiza papel (não permite alterar papéis de sistema)
  async updateRole(workspaceId: string, roleId: string, userId: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, workspaceId },
    });
    if (!role) throw new NotFoundException('Papel não encontrado.');
    if (role.isSystem) throw new ForbiddenException('Papéis de sistema não podem ser alterados.');

    const updated = await this.prisma.role.update({
      where: { id: roleId },
      data: dto,
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'ROLE_UPDATED',
      entity: 'Role',
      entityId: roleId,
      before: { name: role.name, permissions: role.permissions },
      after: dto,
    });

    return updated;
  }

  // Remove papel (não permite remover papéis de sistema ou em uso)
  async deleteRole(workspaceId: string, roleId: string, userId: string): Promise<void> {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, workspaceId },
      include: { _count: { select: { workspaceUsers: true } } },
    });
    if (!role) throw new NotFoundException('Papel não encontrado.');
    if (role.isSystem) throw new ForbiddenException('Papéis de sistema não podem ser excluídos.');
    if (role._count.workspaceUsers > 0) {
      throw new ConflictException(
        'Este papel está em uso por membros do workspace e não pode ser excluído.',
      );
    }

    await this.prisma.role.delete({ where: { id: roleId } });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'ROLE_DELETED',
      entity: 'Role',
      entityId: roleId,
    });
  }
}
