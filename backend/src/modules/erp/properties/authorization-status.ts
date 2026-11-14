// Situação de uma autorização de venda (Fase 2). Função pura.
// "Vencendo" = ativa e vence em até 30 dias (inclusive hoje).

export type AuthorizationStatus = 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'CANCELLED';

export const EXPIRING_WINDOW_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

export function authorizationStatus(
  a: { status: string; validUntil: Date | string },
  now: Date = new Date(),
  windowDays = EXPIRING_WINDOW_DAYS,
): { status: AuthorizationStatus; daysLeft: number | null } {
  if (a.status === 'CANCELLED') return { status: 'CANCELLED', daysLeft: null };
  const end = new Date(a.validUntil);
  // vale até o fim do dia de validade
  const endOfDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
  const daysLeft = Math.ceil((endOfDay.getTime() - now.getTime()) / DAY) - 1;
  if (endOfDay.getTime() < now.getTime()) return { status: 'EXPIRED', daysLeft };
  if (daysLeft <= windowDays) return { status: 'EXPIRING', daysLeft };
  return { status: 'ACTIVE', daysLeft };
}
