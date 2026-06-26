// Middleware intencionalmente vazio.
// A proteção de rotas é feita no cliente (dashboard layout + useAuth hook).
// Remover a verificação server-side elimina o loop de redirecionamento
// causado por dessincronia entre o cookie e o estado do cliente.

export function middleware() {}

export const config = {
  matcher: [],
};
