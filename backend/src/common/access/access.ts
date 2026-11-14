// Fase 7 — papéis e áreas de acesso (aplicados no backend, não só na tela).
//
//   ADMIN   (Dono/Admin) — tudo, inclusive configurações, usuários e papéis
//   FINANCE (Financeiro) — financeiro, cobranças, bancário, notas fiscais e
//                          configurações financeiras; CRM e contratos
//   MANAGER (Gerente)    — CRM, contratos, financeiro e relatórios; sem
//                          configurações da imobiliária
//   BROKER  (Corretor)   — só os SEUS leads, negócios, visitas, tarefas,
//                          propostas, contratos dos seus negócios e comissões;
//                          sem financeiro geral nem configurações
//
// Controllers declaram quem entra com @Access(...). O WorkspaceGuard confere.

import { NotFoundException, SetMetadata } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export type RoleKey = 'ADMIN' | 'FINANCE' | 'MANAGER' | 'BROKER';
export const ROLE_KEYS: RoleKey[] = ['ADMIN', 'FINANCE', 'MANAGER', 'BROKER'];
export const ROLE_LABELS: Record<RoleKey, string> = {
  ADMIN: 'Dono/Admin', FINANCE: 'Financeiro', MANAGER: 'Gerente', BROKER: 'Corretor',
};

export const ACCESS_KEY = 'access:roles';
export const Access = (...roles: RoleKey[]) => SetMetadata(ACCESS_KEY, roles);

// Conjuntos usados nos controllers
export const ALL: RoleKey[] = ['ADMIN', 'FINANCE', 'MANAGER', 'BROKER'];
export const STAFF: RoleKey[] = ['ADMIN', 'FINANCE', 'MANAGER'];
export const FINANCE_AREA: RoleKey[] = ['ADMIN', 'FINANCE', 'MANAGER'];
export const FINANCE_CONFIG: RoleKey[] = ['ADMIN', 'FINANCE'];
export const MANAGEMENT: RoleKey[] = ['ADMIN', 'MANAGER'];
export const ADMIN_ONLY: RoleKey[] = ['ADMIN'];

/** Papel efetivo: o dono é sempre ADMIN; papel sem chave conhecida vale como Corretor (menor acesso). */
export function roleKeyOf(role: { systemKey?: string | null } | null | undefined, isOwner: boolean): RoleKey {
  if (isOwner) return 'ADMIN';
  const k = role?.systemKey as RoleKey | undefined;
  return k && ROLE_KEYS.includes(k) ? k : 'BROKER';
}

export const accessDeniedMessage = (roleKey: RoleKey) =>
  `Seu papel (${ROLE_LABELS[roleKey]}) não tem acesso a esta área. Peça ao dono da imobiliária, se precisar.`;

// ── Contexto da requisição (quem está pedindo) ──────────────────────

export interface MemberContext {
  workspaceId: string;
  memberId: string; // WorkspaceUser id
  userId: string;   // User id
  roleKey: RoleKey;
}

export const requestContext = new AsyncLocalStorage<{ member?: MemberContext }>();

export function currentMember(): MemberContext | undefined {
  return requestContext.getStore()?.member;
}

/** WorkspaceUser id quando quem pede é Corretor (para filtrar "só os seus"); senão null. */
export function brokerMemberId(): string | null {
  const m = currentMember();
  return m?.roleKey === 'BROKER' ? m.memberId : null;
}

/** User id quando quem pede é Corretor (tarefas usam o id do usuário). */
export function brokerUserId(): string | null {
  const m = currentMember();
  return m?.roleKey === 'BROKER' ? m.userId : null;
}

/** Para Corretor: o registro precisa ser dele. Responde 404 (não revela que existe). */
export function assertBrokerOwns(ownerIds: Array<string | null | undefined>, label = 'Registro') {
  const me = currentMember();
  if (me?.roleKey !== 'BROKER') return;
  if (!ownerIds.some((id) => id && (id === me.memberId || id === me.userId))) {
    throw new NotFoundException(`${label} não encontrado.`);
  }
}

// ── Filtros prontos para o Prisma (vazios para quem não é Corretor) ──

/** Negócios: Corretor só os atribuídos a ele. */
export const dealScope = (): { assigneeId?: string } => {
  const b = brokerMemberId();
  return b ? { assigneeId: b } : {};
};

/** Contatos (leads): Corretor só os dele ou com negócio dele. */
export const contactScope = (): Record<string, unknown> => {
  const b = brokerMemberId();
  return b ? { OR: [{ assigneeId: b }, { deals: { some: { assigneeId: b, deletedAt: null } } }] } : {};
};

/** Visitas: Corretor só as que ele acompanha ou de negócio dele. */
export const visitScope = (): Record<string, unknown> => {
  const b = brokerMemberId();
  return b ? { OR: [{ brokerId: b }, { deal: { assigneeId: b } }] } : {};
};

/** Propostas: só de negócio do Corretor. */
export const proposalScope = (): Record<string, unknown> => {
  const b = brokerMemberId();
  return b ? { deal: { assigneeId: b } } : {};
};

/** Tarefas/atividades: Corretor só as dele (Activity.userId = id do usuário). */
export const activityScope = (): { userId?: string } => {
  const u = brokerUserId();
  return u ? { userId: u } : {};
};

/** Conversas: Corretor só as atribuídas a ele ou de contato dele. */
export const conversationScope = (): Record<string, unknown> => {
  const b = brokerMemberId();
  return b ? { OR: [{ assigneeId: b }, { contact: { assigneeId: b } }, { contact: { deals: { some: { assigneeId: b, deletedAt: null } } } }] } : {};
};
