// Barra lateral de navegação do dashboard.
// Fase 1: itens agrupados (Comercial / Contratos / Financeiro / Gestão /
// Configurações) e filtrados pelo perfil de operação do workspace.
// A definição dos itens fica em lib/navigation.ts.

'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Building2, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useRoleKey } from '@/hooks/use-role';
import { useOperationProfile } from '@/hooks/use-operation-profile';
import { NotificationBell } from './notification-bell';
import { isNavItemActive, PROFILE_LABELS, visibleNavGroups, ROLE_LABELS } from '@/lib/navigation';

function SidebarContent({ tab }: { tab: string | null }) {
  const pathname = usePathname();
  const { user, currentWorkspace } = useAuthStore();
  const { logout } = useAuth();
  const profile = useOperationProfile();
  const role = useRoleKey();

  const initials =
    user?.name
      ?.split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';

  const groups = visibleNavGroups({
    profile,
    permissions: currentWorkspace?.role.permissions || {},
    isOwner: !!currentWorkspace?.isOwner,
    isPlatformAdmin: !!user?.isPlatformAdmin,
    role,
  });

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-white">
      <div className="px-6 py-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg text-foreground truncate flex-1">
            {currentWorkspace?.workspace.name || 'Estou em Casa'}
          </span>
          {/* Sino na barra lateral: aparece em TODAS as telas (o cabeçalho só existe em algumas). */}
          {currentWorkspace && <NotificationBell align="start" />}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Perfil: {PROFILE_LABELS[profile]} · {ROLE_LABELS[role]}</p>
      </div>

      <Separator />

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Menu principal">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = isNavItemActive(item.href, pathname, tab);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <Separator />

      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={user?.avatar} alt={user?.name} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{user?.name}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => logout(false)}
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}

function SidebarWithParams() {
  const searchParams = useSearchParams();
  return <SidebarContent tab={searchParams.get('tab')} />;
}

// useSearchParams exige um Suspense em volta no Next 14 (senão o build falha).
export function Sidebar() {
  return (
    <Suspense fallback={<SidebarContent tab={null} />}>
      <SidebarWithParams />
    </Suspense>
  );
}
