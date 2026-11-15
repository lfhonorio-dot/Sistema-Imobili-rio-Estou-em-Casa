// Header do dashboard.
// Fase 7: sino com notificações reais e o papel do usuário.

'use client';

import { useAuthStore } from '@/stores/auth.store';
import { ROLE_LABELS } from '@/lib/navigation';
import { useRoleKey } from '@/hooks/use-role';

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const { currentWorkspace } = useAuthStore();
  const role = useRoleKey();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div>
        {title && (
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        {currentWorkspace && (
          <span className="text-sm text-muted-foreground">
            {ROLE_LABELS[role]}
          </span>
        )}
      </div>
    </header>
  );
}
