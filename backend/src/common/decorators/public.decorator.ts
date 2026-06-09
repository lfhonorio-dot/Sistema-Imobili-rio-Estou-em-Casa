// Decorator para marcar rotas como públicas (sem autenticação)
// Uso: @Public() em controller ou método

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Marca um endpoint como público (sem necessidade de autenticação JWT)
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
