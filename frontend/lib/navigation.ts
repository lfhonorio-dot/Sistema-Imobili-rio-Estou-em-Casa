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
  ShieldCheck, Truck, Bell,
} from 'lucide-react';

export type OperationProfile = 'VENDA' | 'VENDA_E_LOCACAO';

export const PROFILE_LABELS: Record<OperationProfile, string> = {
  VENDA: 'Venda',
  VENDA_E_LOCACAO: 'Venda e Locação',
};

// Fase 7: papéis (o backend é quem garante; o menu só esconde o que não pode)
export type RoleKey = 'ADMIN' | 'FINANCE' | 'MANAGER' | 'BROKER';
export const ROLE_LABELS: Record<RoleKey, string> = { ADMIN: 'Dono/Admin', FINANCE: 'Financeiro', MANAGER: 'Gerente', BROKER: 'Corretor' };
const STAFF: RoleKey[] = ['ADMIN', 'FINANCE', 'MANAGER'];
const FIN: RoleKey[] = ['ADMIN', 'FINANCE', 'MANAGER'];
const MGMT: RoleKey[] = ['ADMIN', 'MANAGER'];
const ADMIN: RoleKey[] = ['ADMIN'];

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Papéis que veem o item (sem: todos). */
  roles?: RoleKey[];
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
      { label: 'A Receber', href: '/financial?tab=receivable', icon: ArrowDownCircle, roles: FIN },
      { label: 'A Pagar', href: '/financial?tab=payable', icon: ArrowUpCircle, roles: FIN },
      { label: 'Boletos e PIX', href: '/financial/billing', icon: Banknote, roles: FIN },
      { label: 'Fluxo de Caixa', href: '/financial?tab=cashflow', icon: LineChart, roles: FIN },
      { label: 'DRE', href: '/financial?tab=dre', icon: LineChart, roles: FIN },
      { label: 'Bancário', href: '/financial/banking', icon: Landmark, roles: FIN },
      { label: 'Config. Financeiras', href: '/financial?tab=settings', icon: Banknote, roles: FIN },
      { label: 'Comissões', href: '/commissions', icon: Percent, roles: FIN },
      { label: 'Minhas comissões', href: '/my-commissions', icon: Percent },
      { label: 'Corretores Parceiros', href: '/partners', icon: Handshake, roles: FIN },
      { label: 'Fornecedores', href: '/suppliers', icon: Truck, roles: FIN },
      { label: 'Notas Fiscais', href: '/fiscal?tab=nfse', icon: Receipt, roles: FIN },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { label: 'Relatórios', href: '/reports', icon: BarChart2, roles: STAFF },
      { label: 'Fiscal — DIMOB', href: '/fiscal?tab=dimob', icon: FileSpreadsheet, roles: FIN },
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
      { label: 'Workspace', href: '/settings/workspace', icon: Building2, roles: ADMIN },
      { label: 'Usuários e papéis', href: '/settings/users', icon: Users, roles: ADMIN },
      { label: 'Funis de venda', href: '/settings/pipelines', icon: KanbanSquare, roles: MGMT },
      { label: 'Modelos de e-mail', href: '/email-templates', icon: Mail, roles: MGMT },
      { label: 'Notificações', href: '/settings/notifications', icon: Bell },
      { label: 'LGPD', href: '/settings/lgpd', icon: Shield, roles: ADMIN },
      { label: 'Auditoria', href: '/settings/audit', icon: ClipboardList, roles: ADMIN },
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

/** Fase 7: rotas por papel (espelha o backend). */
export const ROLE_ROUTES: { prefix: string; roles: RoleKey[]; module: string }[] = [
  { prefix: '/financial', roles: FIN, module: 'Financeiro' },
  { prefix: '/commissions', roles: FIN, module: 'Comissões da imobiliária' },
  { prefix: '/partners', roles: FIN, module: 'Corretores parceiros' },
  { prefix: '/suppliers', roles: FIN, module: 'Fornecedores' },
  { prefix: '/fiscal', roles: FIN, module: 'Fiscal' },
  { prefix: '/reports', roles: STAFF, module: 'Relatórios' },
  { prefix: '/settings/workspace', roles: ADMIN, module: 'Configurações da imobiliária' },
  { prefix: '/settings/users', roles: ADMIN, module: 'Usuários e papéis' },
  { prefix: '/settings/lgpd', roles: ADMIN, module: 'LGPD' },
  { prefix: '/settings/audit', roles: ADMIN, module: 'Auditoria' },
  { prefix: '/settings/pipelines', roles: MGMT, module: 'Funis de venda' },
  { prefix: '/email-templates', roles: MGMT, module: 'Modelos de e-mail' },
];

export function blockedForRole(pathname: string, role: RoleKey): string | null {
  const hit = ROLE_ROUTES.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  return hit && !hit.roles.includes(role) ? hit.module : null;
}

export function normalizeRole(value: unknown, isOwner: boolean): RoleKey {
  if (isOwner) return 'ADMIN';
  return value === 'ADMIN' || value === 'FINANCE' || value === 'MANAGER' || value === 'BROKER' ? value : 'BROKER';
}

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
  role?: RoleKey;
}): NavGroup[] {
  return NAV_GROUPS.filter((g) => !g.fullProfileOnly || opts.profile === 'VENDA_E_LOCACAO')
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        if (item.platformAdminOnly) return opts.isPlatformAdmin;
        if (item.roles && !item.roles.includes(opts.role ?? (opts.isOwner ? 'ADMIN' : 'BROKER'))) return false;
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
