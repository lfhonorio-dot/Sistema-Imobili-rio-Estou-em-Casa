// Barra lateral de navegação do dashboard

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Settings,
  Shield,
  ClipboardList,
  Building2,
  LogOut,
  ChevronDown,
  KanbanSquare,
  ContactIcon,
  CheckSquare,
  Home,
  FileText,
  DollarSign,
  Wrench,
  MessageSquare,
  Mail,
  PenSquare,
  Landmark,
  Receipt,
  Banknote,
  Megaphone,
  Zap,
  BarChart2,
  Plug,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

// Itens de navegação principal
const navItems = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    label: 'Pipeline',
    href: '/pipeline',
    icon: KanbanSquare,
  },
  {
    label: 'Contatos',
    href: '/contacts',
    icon: ContactIcon,
  },
  {
    label: 'Tarefas',
    href: '/tasks',
    icon: CheckSquare,
  },
  // ERP Imobiliário (Estágio 3)
  {
    label: 'Imóveis',
    href: '/properties',
    icon: Home,
  },
  {
    label: 'Contratos',
    href: '/contracts',
    icon: FileText,
  },
  {
    label: 'Assinaturas',
    href: '/contracts/signatures',
    icon: PenSquare,
  },
  {
    label: 'Financeiro',
    href: '/financial',
    icon: DollarSign,
  },
  {
    label: 'Boletos',
    href: '/financial/billing',
    icon: Banknote,
  },
  {
    label: 'Bancário',
    href: '/financial/banking',
    icon: Landmark,
  },
  {
    label: 'Fiscal',
    href: '/fiscal',
    icon: Receipt,
  },
  {
    label: 'Marketing',
    href: '/marketing',
    icon: Megaphone,
  },
  {
    label: 'Automações',
    href: '/automation',
    icon: Zap,
  },
  {
    label: 'Relatórios',
    href: '/reports',
    icon: BarChart2,
  },
  {
    label: 'Integrações',
    href: '/integrations',
    icon: Plug,
  },
  {
    label: 'Manutenção',
    href: '/maintenance',
    icon: Wrench,
  },
  // Hub de Comunicação (Estágio 4)
  {
    label: 'Caixa de Entrada',
    href: '/inbox',
    icon: MessageSquare,
  },
  {
    label: 'Templates Email',
    href: '/email-templates',
    icon: Mail,
  },
];

// Itens de configurações
const settingsItems = [
  {
    label: 'Workspace',
    href: '/settings/workspace',
    icon: Building2,
    permission: 'workspace:read',
  },
  {
    label: 'Usuários',
    href: '/settings/users',
    icon: Users,
    permission: 'users:read',
  },
  {
    label: 'LGPD',
    href: '/settings/lgpd',
    icon: Shield,
    permission: 'lgpd:read',
  },
  {
    label: 'Auditoria',
    href: '/settings/audit',
    icon: ClipboardList,
    permission: 'audit:read',
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, currentWorkspace } = useAuthStore();
  const { logout } = useAuth();

  // Iniciais do nome do usuário para o avatar
  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  const permissions = currentWorkspace?.role.permissions || {};

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-white">
      {/* Cabeçalho com logo */}
      <div className="flex items-center gap-2 px-6 py-4">
        <Building2 className="h-6 w-6 text-primary" />
        <span className="font-bold text-lg text-foreground">
          {currentWorkspace?.workspace.name || 'Plataforma'}
        </span>
      </div>

      <Separator />

      {/* Navegação principal */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
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

        {/* Seção de configurações */}
        <div className="mt-6">
          <p className="mb-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Configurações
          </p>
          <div className="space-y-1">
            {settingsItems
              .filter(
                (item) =>
                  !item.permission ||
                  permissions[item.permission] ||
                  currentWorkspace?.isOwner,
              )
              .map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
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
      </nav>

      <Separator />

      {/* Rodapé com perfil do usuário */}
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
