'use client';
// Fase 7: papel do usuário na imobiliária atual (vem do /auth/me).
import { useAuthStore } from '@/stores/auth.store';
import { normalizeRole, type RoleKey } from '@/lib/navigation';

export function useRoleKey(): RoleKey {
  const m = useAuthStore((s) => s.currentWorkspace);
  return normalizeRole(m?.roleKey, !!m?.isOwner);
}
