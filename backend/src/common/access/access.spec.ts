import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceGuard } from '../guards/workspace.guard';
import {
  ACCESS_KEY, assertBrokerOwns, contactScope, currentMember, dealScope, requestContext, roleKeyOf, type RoleKey,
} from './access';

// Fase 7 — papéis aplicados no backend.

function guardFor(member: { isOwner: boolean; systemKey: string | null }, allowed?: RoleKey[]) {
  const prisma = {
    workspaceUser: {
      findFirst: jest.fn(),
      findUnique: jest.fn().mockResolvedValue({
        id: 'wu-1', isOwner: member.isOwner, role: { permissions: {}, systemKey: member.systemKey },
        workspace: { id: 'ws-1', name: 'Imob', deletedAt: null, operationProfile: 'VENDA' },
      }),
    },
  };
  const reflector = { getAllAndOverride: jest.fn((k: string) => (k === ACCESS_KEY ? allowed : undefined)) } as unknown as Reflector;
  const request: Record<string, unknown> = { headers: { 'x-workspace-id': 'ws-1' }, user: { sub: 'u-1' } };
  const ctx = { switchToHttp: () => ({ getRequest: () => request }), getHandler: () => () => undefined, getClass: () => class {} } as never;
  return { guard: new WorkspaceGuard(prisma as never, reflector), ctx, request };
}

describe('papéis (Fase 7)', () => {
  it('dono é sempre ADMIN; papel desconhecido vale como Corretor', () => {
    expect(roleKeyOf({ systemKey: 'BROKER' }, true)).toBe('ADMIN');
    expect(roleKeyOf({ systemKey: 'FINANCE' }, false)).toBe('FINANCE');
    expect(roleKeyOf({ systemKey: null }, false)).toBe('BROKER');
    expect(roleKeyOf({ systemKey: 'QUALQUER' }, false)).toBe('BROKER');
  });

  it('Corretor é barrado no financeiro com mensagem clara', async () => {
    const { guard, ctx } = guardFor({ isOwner: false, systemKey: 'BROKER' }, ['ADMIN', 'FINANCE', 'MANAGER']);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(/Corretor.*não tem acesso/);
  });

  it('Financeiro entra no financeiro; Gerente não entra nas configurações', async () => {
    await expect(guardFor({ isOwner: false, systemKey: 'FINANCE' }, ['ADMIN', 'FINANCE', 'MANAGER']).guard.canActivate(guardFor({ isOwner: false, systemKey: 'FINANCE' }).ctx)).resolves.toBe(true);
    const g = guardFor({ isOwner: false, systemKey: 'MANAGER' }, ['ADMIN']);
    await expect(g.guard.canActivate(g.ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('o guard grava papel e membro na requisição e no contexto', async () => {
    const { guard, ctx, request } = guardFor({ isOwner: false, systemKey: 'BROKER' }, ['ADMIN', 'FINANCE', 'MANAGER', 'BROKER']);
    await requestContext.run({}, async () => {
      await guard.canActivate(ctx);
      expect(currentMember()).toEqual({ workspaceId: 'ws-1', memberId: 'wu-1', userId: 'u-1', roleKey: 'BROKER' });
      expect(dealScope()).toEqual({ assigneeId: 'wu-1' });
      expect(contactScope()).toHaveProperty('OR');
      expect(() => assertBrokerOwns(['outro'], 'Negócio')).toThrow(NotFoundException);
      expect(() => assertBrokerOwns(['wu-1'], 'Negócio')).not.toThrow();
    });
    expect((request.user as { roleKey: string }).roleKey).toBe('BROKER');
  });

  it('fora do Corretor os filtros ficam vazios', async () => {
    await requestContext.run({ member: { workspaceId: 'w', memberId: 'm', userId: 'u', roleKey: 'MANAGER' } }, async () => {
      expect(dealScope()).toEqual({});
      expect(contactScope()).toEqual({});
    });
  });

  it('todo controller protegido por WorkspaceGuard declara quem pode entrar (@Access)', () => {
    const files: string[] = [];
    const walk = (d: string) => readdirSync(d).forEach((n) => {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p); else if (n.endsWith('.controller.ts')) files.push(p);
    });
    walk(join(__dirname, '../../modules'));
    const missing = files.filter((f) => {
      const s = readFileSync(f, 'utf8');
      return s.includes('WorkspaceGuard') && !s.includes('@Access(');
    });
    expect(missing).toEqual([]);
  });
});
