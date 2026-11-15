// Header do dashboard.
// O sino de notificações foi retirado até existir notificação de verdade
// (Fase 7) — antes era um botão sem nenhuma ação.

'use client';

import { useAuthStore } from '@/stores/auth.store';

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const { currentWorkspace } = useAuthStore();

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
            {currentWorkspace.role.name}
          </span>
        )}
      </div>
    </header>
  );
}
