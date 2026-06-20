// Guard de workspace
// Verifica se o usuário pertence ao workspace informado no header

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string>;
      user: { sub: string; id?: string; permissions?: Record<string, boolean>; isOwner?: boolean };
      workspaceId?: string;
    }>();

    let workspaceId = request.headers['x-workspace-id'];

    const userId = request.user?.sub || request.user?.id;
    if (!userId) {
      throw new ForbiddenException('Usuário não autenticado.');
    }

    // Se header não enviado, usa o primeiro workspace do usuário
    if (!workspaceId) {
      const membership = await this.prisma.workspaceUser.findFirst({
        where: { userId },
        select: { workspaceId: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!membership) {
        throw new BadRequestException('Header X-Workspace-Id é obrigatório para esta operação.');
      }
      workspaceId = membership.workspaceId;
    }

    // Verifica se o usuário pertence ao workspace
    const workspaceUser = await this.prisma.workspaceUser.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      include: {
        role: true,
        workspace: {
          select: { id: true, name: true, deletedAt: true },
        },
      },
    });

    if (!workspaceUser) {
      throw new ForbiddenException(
        'Você não tem acesso a este workspace.',
      );
    }

    if (workspaceUser.workspace.deletedAt) {
      throw new ForbiddenException('Este workspace foi desativado.');
    }

    // Injeta informações do workspace na requisição
    request.workspaceId = workspaceId;
    request.user = {
      ...request.user,
      permissions: workspaceUser.role.permissions as Record<string, boolean>,
      isOwner: workspaceUser.isOwner,
    };

    return true;
  }
}
