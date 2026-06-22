// Hooks React Query para o módulo de Contratos
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export interface Contract {
  id: string;
  workspaceId: string;
  type: string;
  status: string;
  propertyId: string;
  ownerId?: string | null;
  tenantId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  signedAt?: string | null;
  rentalValue?: number | null;
  dueDay?: number | null;
  saleValue?: number | null;
  commissionRate?: number | null;
  notes?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  property?: {
    id: string;
    code: string;
    street?: string | null;
    number?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    type: string;
  };
  owner?: { id: string; name: string } | null;
  tenant?: { id: string; name: string } | null;
}

export interface ContractQuery {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  propertyId?: string;
  contactId?: string;
  search?: string;
}

export function useContracts(query: ContractQuery = {}) {
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);

  return useQuery({
    queryKey: ['contracts', workspaceId, query],
    queryFn: async () => {
      const { data } = await api.get('/contracts', { params: query });
      return data.data as { items: Contract[]; meta: { page: number; limit: number; total: number; pages: number } };
    },
    enabled: !!workspaceId,
  });
}

export function useContract(id: string) {
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);

  return useQuery({
    queryKey: ['contract', workspaceId, id],
    queryFn: async () => {
      const { data } = await api.get(`/contracts/${id}`);
      return data.data as Contract;
    },
    enabled: !!workspaceId && !!id,
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);

  return useMutation({
    mutationFn: async (dto: Partial<Contract>) => {
      const { data } = await api.post('/contracts', dto);
      return data.data as Contract;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts', workspaceId] });
    },
  });
}

export function useUpdateContract() {
  const queryClient = useQueryClient();
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);

  return useMutation({
    mutationFn: async ({ id, ...dto }: Partial<Contract> & { id: string }) => {
      const { data } = await api.patch(`/contracts/${id}`, dto);
      return data.data as Contract;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['contracts', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['contract', workspaceId, vars.id] });
    },
  });
}

export function useChangeContractStatus() {
  const queryClient = useQueryClient();
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);

  return useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      const { data } = await api.patch(`/contracts/${id}/status`, { status, reason });
      return data.data as Contract;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['contract', workspaceId, vars.id] });
      queryClient.invalidateQueries({ queryKey: ['contracts', workspaceId] });
    },
  });
}

export function useGenerateInstallments() {
  const queryClient = useQueryClient();
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);

  return useMutation({
    mutationFn: async ({ id, months }: { id: string; months: number }) => {
      const { data } = await api.post(`/contracts/${id}/generate-installments`, { months });
      return data.data as { created: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['financial-entries', workspaceId] });
    },
  });
}

export function useRequestSignature() {
  const queryClient = useQueryClient();
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);

  return useMutation({
    mutationFn: async ({ id, documentUrl, message, deadline }: { id: string; documentUrl?: string; message?: string; deadline?: string }) => {
      const { data } = await api.post(`/contracts/${id}/request-signature`, { documentUrl, message, deadline });
      return data.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['contract', workspaceId, vars.id] });
    },
  });
}

export function useContractStatement(id: string) {
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);

  return useQuery({
    queryKey: ['contract-statement', workspaceId, id],
    queryFn: async () => {
      const { data } = await api.get(`/contracts/${id}/statement`);
      return data.data;
    },
    enabled: !!workspaceId && !!id,
  });
}
