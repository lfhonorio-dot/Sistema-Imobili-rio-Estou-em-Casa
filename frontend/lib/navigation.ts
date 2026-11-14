// Menu e rotas por perfil de operação (Fase 1).
//
// VENDA: só o fluxo de venda. Locação e módulos avançados (vistorias,
// manutenção, Open Finance, automações,
// agentes de IA, marketing, integrações) ficam OCULTOS — nada é apagado.
// VENDA_E_LOCACAO: mostra tudo.
//
// Este arquivo é a única fonte de verdade: o menu lateral e o bloqueio de
// rota (ProfileGate) leem daqui.

import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, KanbanSquare, ContactIcon, Home, CalendarDays, CheckSquare,
  MessageSquare, FileText, PenSquare, ArrowDownCircle, ArrowUpCircle, Banknote,
  LineChart, Landmark, Percent, Receipt, BarChart2, FileSpreadsheet, Building2,
  Users, Shield, ClipboardList, Mail, Wrench, Zap, Megaphone, Handshake, Plug,
  ShieldCheck,
} from 'lucide-react';

export type OperationProfile = 'VENDA' | 'VENDA_E_LOCACAO';

export const PROFILE_LABELS: Record<OperationProfile, string> = {
  VENDA: 'Venda',
  VENDA_E_LOCACAO: 'Venda e Locação',
};

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Permissão necessária (o dono do workspace sempre vê). */
  permission?: string;
  /** Só administradores de plataforma (allowlist do backend). */
  platformAdminOnly?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  /** Grupo exibido só no perfil VENDA_E_LOCACAO. */
  fullProfileOnly?: boolean;
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Comercial',
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard },
      { label: 'Funil', href: '/pipeline', icon: KanbanSquare },
      { label: 'Clientes', href: '/contacts', icon: ContactIcon },
      { label: 'Imóveis', href: '/properties', icon: Home },
      { label: 'Visitas', href: '/visits', icon: CalendarDays },
      { label: 'Tarefas', href: '/tasks', icon: CheckSquare },
      { label: 'Caixa de Entrada', href: '/inbox', icon: MessageSquare },
    ],
  },
  {
    label: 'Contratos',
    items: [
      { label: 'Contratos', href: '/contracts', icon: FileText },
      { label: 'Assinaturas', href: '/contracts/signatures', icon: PenSquare },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { label: 'A Receber', href: '/financial?tab=receivable', icon: ArrowDownCircle },
      { label: 'A Pagar', href: '/financial?tab=payable', icon: ArrowUpCircle },
      { label: 'Boletos e PIX', href: '/financial/billing', icon: Banknote },
      { label: 'Fluxo de Caixa', href: '/financial?tab=cashflow', icon: LineChart },
      { label: 'Bancário', href: '/financial/banking', icon: Landmark },
      { label: 'Comissões', href: '/commissions', icon: Percent },
      { label: 'Corretores Parceiros', href: '/partners', icon: Handshake },
      { label: 'Notas Fiscais', href: '/fiscal?tab=nfse', icon: Receipt },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { label: 'Relatórios', href: '/reports', icon: BarChart2 },
      { label: 'Fiscal — DIMOB', href: '/fiscal?tab=dimob', icon: FileSpreadsheet },
    ],
  },
  {
    label: 'Locação e avançados',
    fullProfileOnly: true,
    items: [
      { label: 'Manutenção', href: '/maintenance', icon: Wrench },
      { label: 'Automações', href: '/automation', icon: Zap },
      { label: 'Marketing', href: '/marketing', icon: Megaphone },
      { label: 'Integrações', href: '/integrations', icon: Plug },
    ],
  },
  {
    label: 'Configurações',
    items: [
      { label: 'Workspace', href: '/settings/workspace', icon: Building2, permission: 'workspace:read' },
      { label: 'Usuários', href: '/settings/users', icon: Users, permission: 'users:read' },
      { label: 'Funis de venda', href: '/settings/pipelines', icon: KanbanSquare, permission: 'workspace:read' },
      { label: 'Modelos de e-mail', href: '/email-templates', icon: Mail },
      { label: 'LGPD', href: '/settings/lgpd', icon: Shield, permission: 'lgpd:read' },
      { label: 'Auditoria', href: '/settings/audit', icon: ClipboardList, permission: 'audit:read' },
      { label: 'Admin da plataforma', href: '/admin', icon: ShieldCheck, platformAdminOnly: true },
    ],
  },
];

/** Rotas que só existem no perfil VENDA_E_LOCACAO (prefixos). */
export const FULL_PROFILE_ROUTES: { prefix: string; module: string }[] = [
  { prefix: '/maintenance', module: 'Manutenção' },
  { prefix: '/automation', module: 'Automações' },
  { prefix: '/marketing', module: 'Marketing' },
  { prefix: '/integrations', module: 'Integrações' },
];

export function normalizeProfile(value: unknown): OperationProfile {
  return value === 'VENDA_E_LOCACAO' ? 'VENDA_E_LOCACAO' : 'VENDA';
}

/** Devolve o nome do módulo bloqueado, ou null se a rota é permitida. */
export function blockedModuleForPath(pathname: string, profile: OperationProfile): string | null {
  if (profile === 'VENDA_E_LOCACAO') return null;
  const hit = FULL_PROFILE_ROUTES.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  );
  return hit ? hit.module : null;
}

/** Grupos visíveis para o perfil, já filtrados por permissão. */
export function visibleNavGroups(opts: {
  profile: OperationProfile;
  permissions: Record<string, boolean>;
  isOwner: boolean;
  isPlatformAdmin: boolean;
}): NavGroup[] {
  return NAV_GROUPS.filter((g) => !g.fullProfileOnly || opts.profile === 'VENDA_E_LOCACAO')
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        if (item.platformAdminOnly) return opts.isPlatformAdmin;
        if (!item.permission) return true;
        return opts.isOwner || !!opts.permissions[item.permission];
      }),
    }))
    .filter((g) => g.items.length > 0);
}

/** Um item está ativo se o caminho e (quando houver) o ?tab= coincidem. */
export function isNavItemActive(href: string, pathname: string, tab: string | null): boolean {
  const [path, query] = href.split('?');
  if (query) {
    const wanted = new URLSearchParams(query).get('tab');
    return pathname === path && (tab ?? defaultTabFor(path)) === wanted;
  }
  if (path === '/') return pathname === '/';
  if (path === '/contracts') return pathname === '/contracts' || (pathname.startsWith('/contracts/') && !pathname.startsWith('/contracts/signatures'));
  return pathname === path || pathname.startsWith(`${path}/`);
}

function defaultTabFor(path: string): string | null {
  if (path === '/financial') return 'receivable';
  if (path === '/fiscal') return 'nfse';
  return null;
}
