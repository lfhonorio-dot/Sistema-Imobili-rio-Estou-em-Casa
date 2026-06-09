// Guard de autorização baseado em papéis (RBAC)
// Verifica se o usuário possui as permissões necessárias

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Busca permissões necessárias definidas no decorator
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Se não há permissões exigidas, permite acesso
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{
      user: { permissions: Record<string, boolean>; isOwner?: boolean };
    }>();

    // Proprietário do workspace tem acesso total
    if (user?.isOwner) {
      return true;
    }

    // Verifica se o usuário tem todas as permissões necessárias
    const hasAllPermissions = requiredPermissions.every(
      (permission) => user?.permissions?.[permission] === true,
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        'Você não possui permissão para realizar esta ação.',
      );
    }

    return true;
  }
}
