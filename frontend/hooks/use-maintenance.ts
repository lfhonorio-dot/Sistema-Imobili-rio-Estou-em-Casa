// Hooks React Query para o módulo de Manutenção
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export interface MaintenanceOrder {
  id: string;
  workspaceId: string;
  propertyId: string;
  contractId?: string | null;
  type: string;
  priority: string;
  requestedBy: string;
  title: string;
  description: string;
  status: string;
  assigneeId?: string | null;
  supplierName?: string | null;
  quotedAmount?: number | null;
  finalAmount?: number | null;
  approvedAt?: string | null;
  completedAt?: string | null;
  paidBy?: string | null;
  notes?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  property?: {
    id: string;
    code: string;
    street?: string | null;
    city?: string | null;
  };
}

export interface MaintenanceQuery {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  type?: string;
  propertyId?: string;
}

export function useMaintenanceOrders(query: MaintenanceQuery = {}) {
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);

  return useQuery({
    queryKey: ['maintenance', workspaceId, query],
    queryFn: async () => {
      const { data } = await api.get('/maintenance', { params: query });
      return data.data as { items: MaintenanceOrder[]; meta: { page: number; limit: number; total: number; pages: number } };
    },
    enabled: !!workspaceId,
  });
}

export function useMaintenanceOrder(id: string) {
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);

  return useQuery({
    queryKey: ['maintenance-order', workspaceId, id],
    queryFn: async () => {
      const { data } = await api.get(`/maintenance/${id}`);
      return data.data as MaintenanceOrder;
    },
    enabled: !!workspaceId && !!id,
  });
}

export function useCreateMaintenanceOrder() {
  const queryClient = useQueryClient();
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);

  return useMutation({
    mutationFn: async (dto: Partial<MaintenanceOrder>) => {
      const { data } = await api.post('/maintenance', dto);
      return data.data as MaintenanceOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance', workspaceId] });
    },
  });
}

export function useChangeMaintenanceStatus() {
  const queryClient = useQueryClient();
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await api.patch(`/maintenance/${id}/status`, { status });
      return data.data as MaintenanceOrder;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-order', workspaceId, vars.id] });
    },
  });
}
