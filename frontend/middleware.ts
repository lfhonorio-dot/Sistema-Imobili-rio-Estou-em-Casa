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

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // exp é em segundos, Date.now() em ms
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

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

  const accessToken = request.cookies.get('accessToken')?.value;

  // Considera token inválido se expirado (evita loop após reiniciar o browser)
  const hasValidToken = !!accessToken && !isTokenExpired(accessToken);

  if (!isPublicRoute && !hasValidToken) {
    // Limpa cookie expirado e redireciona para login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const response = NextResponse.redirect(loginUrl);
    if (accessToken) {
      response.cookies.set('accessToken', '', { maxAge: 0, path: '/' });
    }
    return response;
  }

  if (isPublicRoute && hasValidToken) {
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
