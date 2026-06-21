// Hooks React Query para o módulo de Negócios (Deals)
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import type { Deal } from './use-pipelines';

export type { Deal };

export interface DealQuery {
  page?: number;
  limit?: number;
  pipelineId?: string;
  stageId?: string;
  assigneeId?: string;
  search?: string;
  view?: 'kanban' | 'list';
}

function useWorkspaceId() {
  const { currentWorkspace } = useAuthStore();
  return currentWorkspace?.workspace.id ?? '';
}

export function useDeals(query: DealQuery = {}) {
  const workspaceId = useWorkspaceId();

  return useQuery({
    queryKey: ['deals', workspaceId, query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.page) params.set('page', String(query.page));
      if (query.limit) params.set('limit', String(query.limit));
      if (query.pipelineId) params.set('pipelineId', query.pipelineId);
      if (query.stageId) params.set('stageId', query.stageId);
      if (query.assigneeId) params.set('assigneeId', query.assigneeId);
      if (query.search) params.set('search', query.search);

      const res = await api.get(`/deals?${params}`, {
        headers: { 'x-workspace-id': workspaceId },
      });
      return res.data.data as { items: Deal[]; meta: { page: number; limit: number; total: number; pages: number } };
    },
    enabled: !!workspaceId,
  });
}

export function useDeal(id: string) {
  const workspaceId = useWorkspaceId();

  return useQuery({
    queryKey: ['deal', workspaceId, id],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Deal }>(`/deals/${id}`, {
        headers: { 'x-workspace-id': workspaceId },
      });
      return res.data.data;
    },
    enabled: !!workspaceId && !!id,
  });
}

export function useCreateDeal() {
  const workspaceId = useWorkspaceId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      contactId: string;
      pipelineId: string;
      value?: number;
      stageId?: string;
      assigneeId?: string;
    }) => {
      const res = await api.post<{ success: boolean; data: Deal }>('/deals', data, {
        headers: { 'x-workspace-id': workspaceId },
      });
      return res.data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['deals', workspaceId] });
    },
  });
}

export function useUpdateDeal() {
  const workspaceId = useWorkspaceId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Deal> & { id: string }) => {
      const res = await api.patch<{ success: boolean; data: Deal }>(`/deals/${id}`, data, {
        headers: { 'x-workspace-id': workspaceId },
      });
      return res.data.data;
    },
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: ['deals', workspaceId] });
      void qc.invalidateQueries({ queryKey: ['deal', workspaceId, id] });
    },
  });
}

export function useMoveStage() {
  const workspaceId = useWorkspaceId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dealId,
      stageId,
      lostReason,
      lostNote,
    }: {
      dealId: string;
      stageId: string;
      lostReason?: string;
      lostNote?: string;
    }) => {
      const res = await api.patch<{ success: boolean; data: Deal }>(
        `/deals/${dealId}/stage`,
        { stageId, lostReason, lostNote },
        { headers: { 'x-workspace-id': workspaceId } },
      );
      return res.data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['deals', workspaceId] });
    },
  });
}

export function useDeleteDeal() {
  const workspaceId = useWorkspaceId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/deals/${id}`, { headers: { 'x-workspace-id': workspaceId } });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['deals', workspaceId] });
    },
  });
}
