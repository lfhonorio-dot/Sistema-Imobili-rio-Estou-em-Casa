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

  // Verifica presença do token (cookie ou localStorage não acessível aqui)
  // Usamos um cookie httpOnly para verificação no middleware
  const accessToken = request.cookies.get('accessToken')?.value;

  if (!isPublicRoute && !accessToken) {
    // Redireciona para login preservando a URL de destino
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isPublicRoute && accessToken) {
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
