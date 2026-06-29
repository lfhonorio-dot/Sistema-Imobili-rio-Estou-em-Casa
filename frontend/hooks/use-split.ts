// Hooks React Query para o módulo de Split (corretores parceiros / recebedores)
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export interface SplitRecipient {
  id: string;
  name: string;
  document: string;
  documentType: string; // CPF, CNPJ
  email?: string | null;
  phone?: string | null;
  pixKey?: string | null;
  pixKeyType?: string | null;
  bankCode?: string | null;
  agency?: string | null;
  accountNumber?: string | null;
  accountType?: string | null; // CHECKING, SAVINGS
  kycStatus: string; // PENDING, SUBMITTED, APPROVED, REJECTED
  isActive: boolean;
  createdAt: string;
}

export interface RecipientInput {
  name: string;
  document: string;
  documentType: string;
  email?: string;
  phone?: string;
  pixKey?: string;
  pixKeyType?: string;
  bankCode?: string;
  agency?: string;
  accountNumber?: string;
  accountType?: string;
}

export function useRecipients() {
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);
  return useQuery({
    queryKey: ['split-recipients', workspaceId],
    queryFn: async () => {
      const { data } = await api.get('/split/recipients');
      return data.data as SplitRecipient[];
    },
    enabled: !!workspaceId,
  });
}

export function useCreateRecipient() {
  const qc = useQueryClient();
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);
  return useMutation({
    mutationFn: async (dto: RecipientInput) => {
      const { data } = await api.post('/split/recipients', dto);
      return data.data as SplitRecipient;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['split-recipients', workspaceId] }),
  });
}

export function useUpdateRecipient() {
  const qc = useQueryClient();
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);
  return useMutation({
    mutationFn: async ({ id, ...dto }: Partial<RecipientInput> & { id: string }) => {
      const { data } = await api.patch(`/split/recipients/${id}`, dto);
      return data.data as SplitRecipient;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['split-recipients', workspaceId] }),
  });
}

export function useDeleteRecipient() {
  const qc = useQueryClient();
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/split/recipients/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['split-recipients', workspaceId] }),
  });
}

export function useSubmitKyc() {
  const qc = useQueryClient();
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/split/recipients/${id}/kyc`, {});
      return data.data as SplitRecipient;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['split-recipients', workspaceId] }),
  });
}
