import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { PlatformAdminGuard } from './platform-admin.guard';

// Bloqueante #1 do relatório de homologação: /admin/* não checava se o
// usuário era administrador de plataforma. Este teste trava esse
// comportamento: sem e-mail na allowlist, o acesso tem que ser negado.

function makeContext(email?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: email ? { email } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('PlatformAdminGuard', () => {
  const ORIGINAL_ENV = process.env.PLATFORM_ADMIN_EMAILS;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.PLATFORM_ADMIN_EMAILS;
    } else {
      process.env.PLATFORM_ADMIN_EMAILS = ORIGINAL_ENV;
    }
  });

  it('bloqueia quando PLATFORM_ADMIN_EMAILS não está configurada', () => {
    delete process.env.PLATFORM_ADMIN_EMAILS;
    const guard = new PlatformAdminGuard();
    expect(() => guard.canActivate(makeContext('dono@imobiliaria.com'))).toThrow(ForbiddenException);
  });

  it('bloqueia usuário cujo e-mail não está na allowlist', () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'admin@imobiliaria.com';
    const guard = new PlatformAdminGuard();
    expect(() => guard.canActivate(makeContext('corretor@imobiliaria.com'))).toThrow(ForbiddenException);
  });

  it('bloqueia quando não há usuário autenticado na requisição', () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'admin@imobiliaria.com';
    const guard = new PlatformAdminGuard();
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });

  it('libera acesso para e-mail cadastrado na allowlist', () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'admin@imobiliaria.com, outro@imobiliaria.com';
    const guard = new PlatformAdminGuard();
    expect(guard.canActivate(makeContext('admin@imobiliaria.com'))).toBe(true);
  });

  it('compara e-mail ignorando maiúsculas/minúsculas e espaços extras', () => {
    process.env.PLATFORM_ADMIN_EMAILS = '  Admin@Imobiliaria.com  ';
    const guard = new PlatformAdminGuard();
    expect(guard.canActivate(makeContext('admin@imobiliaria.com'))).toBe(true);
  });
});
