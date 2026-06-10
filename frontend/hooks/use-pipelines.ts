// Hooks React Query para o módulo de Pipelines
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export interface PipelineStage {
  id: string;
  pipelineId: string;
  name: string;
  color: string;
  order: number;
  expectedDays?: number | null;
  isWon: boolean;
  isLost: boolean;
  rottenAfterDays?: number | null;
  _count?: { deals: number };
  deals?: Deal[];
}

export interface Pipeline {
  id: string;
  workspaceId: string;
  name: string;
  type: string;
  isDefault: boolean;
  order: number;
  stages: PipelineStage[];
  _count?: { deals: number };
}

export interface Deal {
  id: string;
  workspaceId: string;
  title: string;
  value?: number | null;
  contactId: string;
  pipelineId: string;
  stageId: string;
  assigneeId?: string | null;
  expectedCloseAt?: string | null;
  closedAt?: string | null;
  lostReason?: string | null;
  origin?: string | null;
  lastActivityAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  isHot?: boolean;
  isCold?: boolean;
  contact?: { id: string; name: string; email?: string | null; phone?: string | null };
  stage?: PipelineStage;
  pipeline?: { id: string; name: string; stages?: PipelineStage[] };
  tags?: Array<{ tag: { id: string; name: string; color: string } }>;
  stageHistory?: Array<{
    id: string;
    movedAt: string;
    stage: { name: string; color: string };
    daysInStage?: number;
  }>;
}

function useWorkspaceId() {
  const { currentWorkspace } = useAuthStore();
  return currentWorkspace?.workspace.id ?? '';
}

export function usePipelines() {
  const workspaceId = useWorkspaceId();

  return useQuery({
    queryKey: ['pipelines', workspaceId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Pipeline[] }>('/pipelines', {
        headers: { 'x-workspace-id': workspaceId },
      });
      return res.data.data;
    },
    enabled: !!workspaceId,
  });
}

export function usePipeline(id: string) {
  const workspaceId = useWorkspaceId();

  return useQuery({
    queryKey: ['pipeline', workspaceId, id],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Pipeline }>(`/pipelines/${id}`, {
        headers: { 'x-workspace-id': workspaceId },
      });
      return res.data.data;
    },
    enabled: !!workspaceId && !!id,
  });
}

export function useCreatePipeline() {
  const workspaceId = useWorkspaceId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; type: string; isDefault?: boolean }) => {
      const res = await api.post<{ success: boolean; data: Pipeline }>('/pipelines', data, {
        headers: { 'x-workspace-id': workspaceId },
      });
      return res.data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pipelines', workspaceId] });
    },
  });
}
