'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';

// Protege todas as rotas do dashboard no lado do cliente.
// Substitui a verificação do middleware, eliminando o loop de redirect
// causado por dessincronia entre cookie e estado React/Zustand.
export function AuthGuard() {
  const router = useRouter();
  const { isAuthenticated, _hasHydrated } = useAuthStore();

  useEffect(() => {
    // Aguarda o Zustand reidratar do localStorage antes de decidir
    if (!_hasHydrated) return;
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, _hasHydrated, router]);

  return null;
}
