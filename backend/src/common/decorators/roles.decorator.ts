// Decorator de papéis/permissões para controle de acesso
// Uso: @RequirePermissions('users:read', 'users:write')

import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'permissions';

// Decorator para definir permissões necessárias em um endpoint
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(ROLES_KEY, permissions);
