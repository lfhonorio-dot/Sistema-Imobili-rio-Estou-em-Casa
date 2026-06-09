// Header do dashboard

'use client';

import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
        {/* Papel atual do usuário */}
        {currentWorkspace && (
          <span className="text-sm text-muted-foreground">
            {currentWorkspace.role.name}
          </span>
        )}

        {/* Notificações (placeholder) */}
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
