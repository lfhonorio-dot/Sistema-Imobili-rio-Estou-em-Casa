// Fase 7 — hooks: notificações, usuários/papéis/convites, relatórios de venda,
// minhas comissões, validação da DIMOB e LGPD do cliente.
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import type { RoleKey } from '@/lib/navigation';

const useWs = () => useAuthStore((s) => s.currentWorkspaceId);

// ── Notificações ─────────────────────────────────────────

export interface AppNotification {
  id: string; type: string; title: string; body: string; link?: string | null; readAt?: string | null; createdAt: string;
  emailStatus?: string | null; emailError?: string | null;
}

export function useNotificationList(limit = 15) {
  const ws = useWs();
  return useQuery({
    queryKey: ['notifications', ws, limit],
    queryFn: async () => (await api.get('/notifications', { params: { limit } })).data.data as { items: AppNotification[] },
    enabled: !!ws,
    refetchInterval: 60_000,
  });
}

export function useUnreadCount() {
  const ws = useWs();
  return useQuery({
    queryKey: ['notifications-unread', ws],
    queryFn: async () => (await api.get('/notifications/unread-count')).data.data as { count: number },
    enabled: !!ws,
    refetchInterval: 60_000,
  });
}

export function useNotificationActions() {
  const qc = useQueryClient();
  const done = () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['notifications-unread'] }); };
  return {
    markRead: useMutation({ mutationFn: async (id: string) => api.patch(`/notifications/${id}/read`, {}), onSuccess: done }),
    markAll: useMutation({ mutationFn: async () => api.post('/notifications/read-all', {}), onSuccess: done }),
    runRules: useMutation({ mutationFn: async () => (await api.post('/notifications/run-rules')).data.data as { created: number }, onSuccess: done }),
  };
}

export const NOTIFICATION_LABELS: Record<string, string> = {
  LEAD_NEW: 'Lead novo', VISIT_TODAY: 'Visita no dia', TASK_DUE: 'Tarefa vencendo', PROPOSAL_STALE: 'Proposta sem resposta',
  INSTALLMENT_OVERDUE: 'Parcela vencida', AUTH_EXPIRING: 'Autorização de venda expirando', NFSE_REJECTED: 'Nota fiscal rejeitada',
};

export function useNotificationPrefs() {
  const ws = useWs();
  const qc = useQueryClient();
  const prefs = useQuery({
    queryKey: ['notification-prefs', ws],
    queryFn: async () => (await api.get('/notifications/preferences')).data.data as Array<{ type: string; inApp: boolean; email: boolean }>,
    enabled: !!ws,
  });
  const emailSwitch = useQuery({
    queryKey: ['notification-email-switch', ws],
    queryFn: async () => (await api.get('/notifications/email-switch')).data.data as { emailNotifications: boolean },
    enabled: !!ws,
  });
  const update = useMutation({
    mutationFn: async (dto: { type: string; inApp?: boolean; email?: boolean }) => api.patch('/notifications/preferences', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-prefs'] }),
  });
  const setEmail = useMutation({
    mutationFn: async (enabled: boolean) => api.patch('/notifications/email-switch', { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-email-switch'] }),
  });
  return { prefs, emailSwitch, update, setEmail };
}

// ── Usuários, papéis e convites ──────────────────────────

export interface Member {
  id: string; userId: string; isOwner: boolean; roleKey: RoleKey; role: { id: string; name: string; systemKey?: string | null };
  user: { id: string; name: string; email: string; lastLoginAt?: string | null };
}
export interface RoleItem { id: string; name: string; systemKey?: string | null }
export interface Invite { id: string; email: string; roleName: string; expiresAt: string; inviteLink: string }

export function useTeam() {
  const ws = useWs();
  const qc = useQueryClient();
  const done = () => { qc.invalidateQueries({ queryKey: ['members'] }); qc.invalidateQueries({ queryKey: ['invites'] }); };
  return {
    members: useQuery({ queryKey: ['members', ws], queryFn: async () => (await api.get('/users/workspace/members')).data.data as Member[], enabled: !!ws }),
    roles: useQuery({ queryKey: ['roles', ws], queryFn: async () => (await api.get('/workspace/roles')).data.data as RoleItem[], enabled: !!ws }),
    invites: useQuery({ queryKey: ['invites', ws], queryFn: async () => (await api.get('/users/workspace/invites')).data.data as Invite[], enabled: !!ws }),
    invite: useMutation({
      mutationFn: async (dto: { email: string; roleId: string }) => (await api.post('/users/workspace/invite', dto)).data.data as { inviteLink: string; roleName: string },
      onSuccess: done,
    }),
    cancelInvite: useMutation({ mutationFn: async (id: string) => api.delete(`/users/workspace/invites/${id}`), onSuccess: done }),
    setRole: useMutation({ mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => api.put(`/users/workspace/members/${userId}/role`, { roleId }), onSuccess: done }),
    remove: useMutation({ mutationFn: async (userId: string) => api.delete(`/users/workspace/members/${userId}`), onSuccess: done }),
  };
}

// ── Relatórios de venda ──────────────────────────────────

export type ColType = 'text' | 'money' | 'int' | 'pct' | 'date' | 'days';
export interface ReportTable {
  key: string; title: string; subtitle?: string;
  columns: Array<{ key: string; label: string; type: ColType }>;
  rows: Array<Record<string, string | number | null>>;
  totals?: Record<string, string | number | null>;
  summary?: Array<{ label: string; value: string | number | null; type?: ColType }>;
  notes?: string[];
}

export function useSalesReport(key: string, params: { from?: string; to?: string; days?: number }) {
  const ws = useWs();
  return useQuery({
    queryKey: ['sales-report', ws, key, params],
    queryFn: async () => (await api.get(`/reports/sales/${key}`, { params })).data.data as ReportTable,
    enabled: !!ws,
  });
}

export async function downloadReport(key: string, format: 'xlsx' | 'pdf', params: Record<string, unknown>) {
  const res = await api.get(`/reports/sales/${key}/export`, { params: { ...params, format }, responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${key}.${format}`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function formatCell(v: unknown, t: ColType): string {
  if (v === null || v === undefined || v === '') return '—';
  switch (t) {
    case 'money': return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    case 'pct': return `${Number(v).toFixed(1).replace('.', ',')}%`;
    case 'int': return String(Math.round(Number(v)));
    case 'days': return `${Number(v).toFixed(0)} dia(s)`;
    case 'date': return new Date(String(v)).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    default: return String(v);
  }
}

// ── Minhas comissões ─────────────────────────────────────

export function useMyCommissions() {
  const ws = useWs();
  return useQuery({
    queryKey: ['my-commissions', ws],
    queryFn: async () => (await api.get('/financial/my-commissions')).data.data as {
      entries: Array<{ id: string; description: string; amount: string; paidAmount?: string | null; dueDate: string; paidAt?: string | null; status: string;
        contract?: { code?: string | null; property?: { code?: string | null; street?: string | null } | null } | null }>;
      legacy: Array<{ id: string; amount: string; rate: string; status: string; paidAt?: string | null; contract?: { code?: string | null } | null }>;
      totals: { toReceive: number; received: number; openCount: number };
    },
    enabled: !!ws,
  });
}

// ── DIMOB e LGPD ─────────────────────────────────────────

export async function validateDimob(year: number, declarantDoc: string) {
  return (await api.get('/fiscal/dimob/validate', { params: { year, declarantDoc } })).data.data as {
    ok: boolean; errors: number; warnings: number; sales: number; rentals: number;
    issues: Array<{ level: 'ERROR' | 'WARNING'; where: string; message: string }>;
  };
}

export async function lgpdExport(contactId: string) {
  const data = (await api.get(`/lgpd/contacts/${contactId}/export`)).data.data;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `dados-titular-${contactId.slice(0, 8)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function lgpdPreview(contactId: string) {
  return (await api.get(`/lgpd/contacts/${contactId}/anonymize-preview`)).data.data as { legalHold: boolean; reason: string };
}

export async function lgpdAnonymize(contactId: string, reason: string) {
  return (await api.post(`/lgpd/contacts/${contactId}/anonymize`, { reason })).data.data as { legalHold: boolean };
}
