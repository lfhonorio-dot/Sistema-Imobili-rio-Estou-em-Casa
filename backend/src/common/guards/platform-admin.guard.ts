// Guard de administrador de PLATAFORMA (cross-tenant)
// Diferente do RolesGuard (papéis dentro de um workspace), este guard controla
// acesso a endpoints globais (/admin/*) que afetam TODOS os workspaces.
// Só usuários cujo e-mail está na allowlist PLATFORM_ADMIN_EMAILS têm acesso.

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { JwtPayload } from '../decorators/current-user.decorator';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user?: JwtPayload }>();

    const allowlist = (process.env.PLATFORM_ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const email = user?.email?.toLowerCase();

    if (!email || allowlist.length === 0 || !allowlist.includes(email)) {
      throw new ForbiddenException(
        'Este recurso é restrito a administradores da plataforma.',
      );
    }

    return true;
  }
}
