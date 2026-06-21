// Hooks React Query para o módulo de Atividades
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export interface Activity {
  id: string;
  workspaceId: string;
  type: string;
  title?: string | null;
  content?: string | null;
  contactId?: string | null;
  dealId?: string | null;
  userId?: string | null;
  dueAt?: string | null;
  doneAt?: string | null;
  priority?: string | null;
  reminderAt?: string | null;
  recurrence?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  contact?: { id: string; name: string } | null;
  deal?: { id: string; title: string } | null;
}

export interface ActivityQuery {
  page?: number;
  limit?: number;
  type?: string;
  contactId?: string;
  dealId?: string;
  done?: 'true' | 'false';
  startDate?: string;
  endDate?: string;
}

function useWorkspaceId() {
  return useAuthStore((s) => s.currentWorkspaceId) ?? '';
}

export function useActivities(query: ActivityQuery = {}) {
  const workspaceId = useWorkspaceId();

  return useQuery({
    queryKey: ['activities', workspaceId, query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.page) params.set('page', String(query.page));
      if (query.limit) params.set('limit', String(query.limit));
      if (query.type) params.set('type', query.type);
      if (query.contactId) params.set('contactId', query.contactId);
      if (query.dealId) params.set('dealId', query.dealId);
      if (query.done) params.set('done', query.done);
      if (query.startDate) params.set('startDate', query.startDate);
      if (query.endDate) params.set('endDate', query.endDate);

      const res = await api.get<{ success: boolean; data: Activity[]; meta: unknown }>(`/activities?${params}`, {
        headers: { 'x-workspace-id': workspaceId },
      });
      return res.data;
    },
    enabled: !!workspaceId,
  });
}

export function useTodayActivities() {
  const workspaceId = useWorkspaceId();

  return useQuery({
    queryKey: ['activities-today', workspaceId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Activity[] }>('/activities/today', {
        headers: { 'x-workspace-id': workspaceId },
      });
      return res.data.data;
    },
    enabled: !!workspaceId,
  });
}

export function useCalendarActivities(year: number, month: number) {
  const workspaceId = useWorkspaceId();

  return useQuery({
    queryKey: ['activities-calendar', workspaceId, year, month],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { activities: Activity[]; byDay: Record<string, Activity[]> } }>(
        `/activities/calendar?year=${year}&month=${month}`,
        { headers: { 'x-workspace-id': workspaceId } },
      );
      return res.data.data;
    },
    enabled: !!workspaceId,
  });
}

export function useCreateActivity() {
  const workspaceId = useWorkspaceId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      type: string;
      title?: string;
      content?: string;
      contactId?: string;
      dealId?: string;
      dueAt?: string;
      priority?: string;
    }) => {
      const res = await api.post<{ success: boolean; data: Activity }>('/activities', data, {
        headers: { 'x-workspace-id': workspaceId },
      });
      return res.data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['activities', workspaceId] });
      void qc.invalidateQueries({ queryKey: ['activities-today', workspaceId] });
    },
  });
}

export function useMarkActivityDone() {
  const workspaceId = useWorkspaceId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch<{ success: boolean; data: Activity }>(`/activities/${id}/done`, {}, {
        headers: { 'x-workspace-id': workspaceId },
      });
      return res.data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['activities', workspaceId] });
      void qc.invalidateQueries({ queryKey: ['activities-today', workspaceId] });
    },
  });
}
