'use client';

// Perfil de operação do workspace atual (VENDA | VENDA_E_LOCACAO).
// Vem do /auth/me (workspace.operationProfile). Sem informação, assume
// VENDA — o padrão deste cliente e o perfil mais restrito.

import { useAuthStore } from '@/stores/auth.store';
import { normalizeProfile, type OperationProfile } from '@/lib/navigation';

export function useOperationProfile(): OperationProfile {
  const profile = useAuthStore((s) => s.currentWorkspace?.workspace.operationProfile);
  return normalizeProfile(profile);
}
