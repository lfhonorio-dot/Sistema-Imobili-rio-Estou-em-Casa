// Decorator para obter o usuário autenticado atual da requisição
// Uso: @CurrentUser() user: JwtPayload

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Interface do payload JWT
export interface JwtPayload {
  sub: string;       // ID do usuário
  email: string;
  name: string;
  iat?: number;      // Issued at
  exp?: number;      // Expiration
  permissions?: Record<string, boolean>;
  isOwner?: boolean;
}

// Decorator que extrai o usuário do objeto de requisição
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    const user = request.user;

    // Se um campo específico foi solicitado, retorna apenas ele
    return data ? user?.[data] : user;
  },
);
