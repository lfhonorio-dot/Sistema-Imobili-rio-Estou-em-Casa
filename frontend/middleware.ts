// Middleware Next.js para proteção de rotas
// Redireciona usuários não autenticados para /login

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rotas que não requerem autenticação
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
];

// Rotas de API (não gerenciadas pelo middleware de páginas)
const API_ROUTES = ['/api'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignora rotas de API e arquivos estáticos
  if (
    API_ROUTES.some((route) => pathname.startsWith(route)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Verifica se a rota é pública
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/'),
  );

  // Verifica apenas a presença do cookie — a validade/expiração é tratada pelo
  // interceptor axios no cliente, que faz refresh automático via refreshToken.
  // Não verificar expiração aqui evita redirecionar para login quando o access
  // token expirou mas o refresh token ainda é válido.
  const hasToken = !!request.cookies.get('accessToken')?.value;

  if (!isPublicRoute && !hasToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isPublicRoute && hasToken) {
    // Usuário já autenticado tentando acessar página de login/registro
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Aplica em todas as rotas exceto estáticos e _next
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
