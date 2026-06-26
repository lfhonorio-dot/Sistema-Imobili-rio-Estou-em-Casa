// Middleware Next.js — proteção de rotas com refresh automático de token
//
// Fluxo:
//   1. Rota pública → passa direto
//   2. Token válido → passa direto
//   3. Token expirado + refreshToken no cookie → tenta renovar via API
//      3a. Sucesso → atualiza cookies e passa
//      3b. Falha   → limpa cookies e redireciona para /login
//   4. Sem token → redireciona para /login

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
];

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Adiciona 30s de margem para evitar race condition
    return payload.exp * 1000 < Date.now() + 30_000;
  } catch {
    return true;
  }
}

async function tryRefresh(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data ?? json;
    if (!data?.accessToken || !data?.refreshToken) return null;
    return { accessToken: data.accessToken, refreshToken: data.refreshToken };
  } catch {
    return null;
  }
}

function setCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
) {
  const maxAge = 60 * 60 * 24 * 7; // 7 dias
  response.cookies.set('accessToken', accessToken, {
    path: '/',
    maxAge,
    sameSite: 'lax',
    httpOnly: false, // precisa ser lido pelo JS do cliente também
  });
  response.cookies.set('refreshToken', refreshToken, {
    path: '/',
    maxAge,
    sameSite: 'lax',
    httpOnly: false,
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignora assets estáticos e rotas de API internas
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const isPublicRoute = PUBLIC_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + '/'),
  );

  const accessToken  = request.cookies.get('accessToken')?.value;
  const refreshToken = request.cookies.get('refreshToken')?.value;

  // ── Caso 1: rota pública ─────────────────────────────────────────────────
  if (isPublicRoute) {
    // Se já tem token válido, manda para o dashboard
    if (accessToken && !isTokenExpired(accessToken)) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // ── Caso 2: token de acesso válido ───────────────────────────────────────
  if (accessToken && !isTokenExpired(accessToken)) {
    return NextResponse.next();
  }

  // ── Caso 3: token expirado, tenta refresh ────────────────────────────────
  if (refreshToken) {
    const tokens = await tryRefresh(refreshToken);

    if (tokens) {
      // Refresh OK — continua com os novos cookies
      const response = NextResponse.next();
      setCookies(response, tokens.accessToken, tokens.refreshToken);
      return response;
    }
  }

  // ── Caso 4: sem token ou refresh falhou — vai para login ─────────────────
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.set('accessToken',  '', { path: '/', maxAge: 0 });
  response.cookies.set('refreshToken', '', { path: '/', maxAge: 0 });
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
