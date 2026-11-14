'use client';

// Protege todas as rotas do dashboard no lado do cliente (o middleware Next
// continua desativado de propósito — ver CLAUDE.md).
//
// Fase 1: nenhuma tela é renderizada antes de a sessão ser confirmada.
//  1. espera o Zustand reidratar do localStorage;
//  2. sem login → manda para /login (sem mostrar a tela);
//  3. confirma a sessão no /auth/me (que também traz workspaces e o perfil);
//  4. se o /auth/me falhar por rede/servidor → aviso + "Tentar de novo"
//     (antes esse erro era engolido em silêncio);
//  5. se responder 401 → limpa a sessão e volta ao login.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertTriangle, RotateCw, LogOut } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { getApiErrorMessage, getApiErrorStatus } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import type { User } from '@/types';

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50 px-4">
      {children}
    </div>
  );
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  const meQuery = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await api.get<{ data: User }>('/auth/me');
      return response.data.data;
    },
    enabled: hasHydrated && isAuthenticated,
    staleTime: 30 * 60 * 1000,
    retry: (failureCount, error) => getApiErrorStatus(error) !== 401 && failureCount < 1,
    retryDelay: 2000,
  });

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) router.replace('/login');
  }, [hasHydrated, isAuthenticated, router]);

  useEffect(() => {
    if (meQuery.data) setUser(meQuery.data);
  }, [meQuery.data, setUser]);

  const status = getApiErrorStatus(meQuery.error);
  useEffect(() => {
    if (status === 401) {
      logout();
      queryClient.clear();
      router.replace('/login');
    }
  }, [status, logout, queryClient, router]);

  if (!hasHydrated || !isAuthenticated || (meQuery.isLoading && !meQuery.data) || status === 401) {
    return (
      <FullScreenMessage>
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Verificando sua sessão…</span>
        </div>
      </FullScreenMessage>
    );
  }

  if (meQuery.isError && !meQuery.data) {
    return (
      <FullScreenMessage>
        <div role="alert" className="max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
          <h2 className="text-lg font-semibold">Não foi possível confirmar sua sessão</h2>
          <p className="mt-2 text-sm text-muted-foreground">{getApiErrorMessage(meQuery.error)}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={() => meQuery.refetch()} disabled={meQuery.isFetching}>
              {meQuery.isFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCw className="mr-2 h-4 w-4" />
              )}
              Tentar de novo
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                logout();
                queryClient.clear();
                router.replace('/login');
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </FullScreenMessage>
    );
  }

  return <>{children}</>;
}
