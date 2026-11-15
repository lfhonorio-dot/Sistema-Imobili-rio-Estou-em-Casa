// Providers globais da aplicação
// React Query, Toaster (Sonner)

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  // QueryClient criado por instância para evitar compartilhamento entre requests
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minuto
            retry: (failureCount, error) => {
              // Erros 4xx (não autorizado, sem acesso, não encontrado, dado inválido)
              // não mudam ao repetir: mostra a mensagem na hora. Antes, um 404 ficava
              // vários segundos em "Carregando..." enquanto tentava de novo 3 vezes.
              // Repete só falha de rede e erro do servidor (5xx).
              const status = (error as { response?: { status: number } })?.response?.status;
              if (status && status >= 400 && status < 500) return false;
              return failureCount < 3;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Notificações toast */}
      <Toaster
        position="top-right"
        richColors
        duration={4000}
        toastOptions={{
          classNames: {
            error: 'bg-destructive text-destructive-foreground',
            success: 'bg-green-500',
          },
        }}
      />
      {/* Devtools apenas em desenvolvimento */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
