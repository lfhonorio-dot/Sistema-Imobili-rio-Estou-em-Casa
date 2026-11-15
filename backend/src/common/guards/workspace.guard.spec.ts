import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceGuard } from './workspace.guard';
import { REQUIRES_FULL_PROFILE_KEY } from '../decorators/operation-profile.decorator';

// Fase 1 — perfil de operação. Módulos marcados com @RequiresFullProfile
// (locação, vistorias, manutenção, split, Open Finance, automações) só
// respondem no perfil VENDA_E_LOCACAO; no perfil VENDA devolvem 403 com
// mensagem clara. O resto do sistema continua liberado.

function makeContext(headers: Record<string, string>, user: Record<string, unknown>) {
  const request: Record<string, unknown> = { headers, user };
  const handler = () => undefined;
  class Ctrl {}
  return {
    request,
    ctx: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => handler,
      getClass: () => Ctrl,
    } as any,
  };
}

function makePrisma(operationProfile: string) {
  return {
    workspaceUser: {
      findFirst: jest.fn(),
      findUnique: jest.fn().mockResolvedValue({
        isOwner: false,
        role: { permissions: { 'x:read': true } },
        workspace: { id: 'ws-1', name: 'Imob', deletedAt: null, operationProfile },
      }),
    },
  };
}

function makeReflector(meta: Record<string, unknown>) {
  return {
    getAllAndOverride: jest.fn((key: string) => meta[key]),
  } as unknown as Reflector;
}

describe('WorkspaceGuard — perfil de operação', () => {
  it('bloqueia módulo de locação no perfil VENDA com mensagem clara', async () => {
    const guard = new WorkspaceGuard(
      makePrisma('VENDA') as any,
      makeReflector({ [REQUIRES_FULL_PROFILE_KEY]: 'Vistorias' }),
    );
    const { ctx } = makeContext({ 'x-workspace-id': 'ws-1' }, { sub: 'u-1' });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(/Vistorias.*não está disponível no perfil de operação "Venda"/);
  });

  it('libera o mesmo módulo no perfil VENDA_E_LOCACAO', async () => {
    const guard = new WorkspaceGuard(
      makePrisma('VENDA_E_LOCACAO') as any,
      makeReflector({ [REQUIRES_FULL_PROFILE_KEY]: 'Vistorias' }),
    );
    const { ctx, request } = makeContext({ 'x-workspace-id': 'ws-1' }, { sub: 'u-1' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.workspaceId).toBe('ws-1');
  });

  it('não interfere em módulos do fluxo de venda (sem a marcação)', async () => {
    const guard = new WorkspaceGuard(makePrisma('VENDA') as any, makeReflector({}));
    const { ctx } = makeContext({ 'x-workspace-id': 'ws-1' }, { sub: 'u-1' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('continua barrando quem não pertence ao workspace, antes de olhar o perfil', async () => {
    const prisma = makePrisma('VENDA_E_LOCACAO');
    prisma.workspaceUser.findUnique.mockResolvedValue(null);
    const guard = new WorkspaceGuard(prisma as any, makeReflector({}));
    const { ctx } = makeContext({ 'x-workspace-id': 'ws-outro' }, { sub: 'u-1' });

    await expect(guard.canActivate(ctx)).rejects.toThrow('Você não tem acesso a este workspace.');
  });
});

// Vazamento entre imobiliárias. Sem o cabeçalho X-Workspace-Id o guard
// resolvia a imobiliária do usuário, mas os controllers (que leem o cabeçalho)
// recebiam "undefined" e as consultas saíam SEM filtro de imobiliária.
describe('WorkspaceGuard — requisição sem X-Workspace-Id', () => {
  it('grava no cabeçalho a imobiliária do próprio usuário, para o controller filtrar por ela', async () => {
    const prisma = makePrisma('VENDA');
    prisma.workspaceUser.findFirst.mockResolvedValue({ workspaceId: 'ws-do-usuario' });
    const guard = new WorkspaceGuard(prisma as any, makeReflector({}));
    const { ctx, request } = makeContext({}, { sub: 'u-1' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect((request.headers as Record<string, string>)['x-workspace-id']).toBe('ws-do-usuario');
    expect(request.workspaceId).toBe('ws-do-usuario');
  });

  it('usuário sem imobiliária nenhuma é recusado', async () => {
    const prisma = makePrisma('VENDA');
    prisma.workspaceUser.findFirst.mockResolvedValue(null);
    const guard = new WorkspaceGuard(prisma as any, makeReflector({}));
    const { ctx } = makeContext({}, { sub: 'u-1' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(/X-Workspace-Id é obrigatório/);
  });
});
