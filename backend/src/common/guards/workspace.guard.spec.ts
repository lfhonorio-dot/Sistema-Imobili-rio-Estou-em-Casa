import { Reflector } from '@nestjs/core';
import { WorkspaceGuard } from './workspace.guard';

// Vazamento entre imobiliárias: sem o cabeçalho X-Workspace-Id o guard resolvia a
// imobiliária do usuário, mas os controllers (que leem o cabeçalho) recebiam
// "undefined" e as consultas saíam SEM filtro de imobiliária.

function makeContext(headers: Record<string, string>, user: Record<string, unknown>) {
  const request: Record<string, unknown> = { headers, user };
  return {
    request,
    ctx: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => () => undefined,
      getClass: () => class Ctrl {},
    } as any,
  };
}

function makePrisma() {
  return {
    workspaceUser: {
      findFirst: jest.fn(),
      findUnique: jest.fn().mockResolvedValue({
        isOwner: false,
        role: { permissions: {} },
        workspace: { id: 'ws-1', name: 'Imob', deletedAt: null },
      }),
    },
  };
}

const reflector = { getAllAndOverride: jest.fn(() => undefined) } as unknown as Reflector;

describe('WorkspaceGuard — requisição sem X-Workspace-Id', () => {
  it('grava no cabeçalho a imobiliária do próprio usuário, para o controller filtrar por ela', async () => {
    const prisma = makePrisma();
    prisma.workspaceUser.findFirst.mockResolvedValue({ workspaceId: 'ws-do-usuario' });
    const guard = new WorkspaceGuard(prisma as any, reflector);
    const { ctx, request } = makeContext({}, { sub: 'u-1' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect((request.headers as Record<string, string>)['x-workspace-id']).toBe('ws-do-usuario');
    expect(request.workspaceId).toBe('ws-do-usuario');
  });

  it('usuário sem imobiliária nenhuma é recusado', async () => {
    const prisma = makePrisma();
    prisma.workspaceUser.findFirst.mockResolvedValue(null);
    const guard = new WorkspaceGuard(prisma as any, reflector);
    const { ctx } = makeContext({}, { sub: 'u-1' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(/X-Workspace-Id é obrigatório/);
  });

  it('quem não pertence à imobiliária informada continua barrado', async () => {
    const prisma = makePrisma();
    prisma.workspaceUser.findUnique.mockResolvedValue(null);
    const guard = new WorkspaceGuard(prisma as any, reflector);
    const { ctx } = makeContext({ 'x-workspace-id': 'ws-outro' }, { sub: 'u-1' });

    await expect(guard.canActivate(ctx)).rejects.toThrow('Você não tem acesso a este workspace.');
  });
});
