'use client';

// Estado de erro padrão das listagens e telas (regra 10).
// Diferencia "sem conexão" de "erro do servidor" e sempre mostra a
// mensagem específica, com botão de tentar de novo.

import { AlertTriangle, WifiOff, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage, isNetworkError } from '@/lib/api-error';

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  compact?: boolean;
}

export function ErrorState({ error, onRetry, title, compact }: ErrorStateProps) {
  const offline = isNetworkError(error);
  const Icon = offline ? WifiOff : AlertTriangle;
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center text-center ${compact ? 'py-6' : 'py-12'} px-4`}
    >
      <Icon className="h-8 w-8 text-red-500 mb-3" />
      <p className="font-medium text-foreground">
        {title ?? (offline ? 'Erro de conexão' : 'Não foi possível carregar')}
      </p>
      <p className="text-sm text-muted-foreground mt-1 max-w-md">{getApiErrorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCw className="h-4 w-4 mr-2" />
          Tentar de novo
        </Button>
      )}
    </div>
  );
}

/** Mensagem de "não disponível" para funções ainda não implementadas (regra 5). */
export function UnavailableNotice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-amber-800">{children}</div>}
    </div>
  );
}
