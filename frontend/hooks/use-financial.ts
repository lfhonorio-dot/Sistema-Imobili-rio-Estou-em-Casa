// Hooks React Query para o módulo Financeiro
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export interface FinancialEntry {
  id: string;
  workspaceId: string;
  type: string;
  category: string;
  description: string;
  amount: number;
  dueDate: string;
  paidAt?: string | null;
  paidAmount?: number | null;
  status: string;
  paymentMethod?: string | null;
  contractId?: string | null;
  contactId?: string | null;
  installment?: number | null;
  totalInstallments?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  contract?: {
    id: string;
    type: string;
    property?: { id: string; code: string; street?: string | null };
  } | null;
}

export interface FinancialQuery {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  contractId?: string;
  contactId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface FinancialSummary {
  totalReceivable: number;
  totalPayable: number;
  totalReceived: number;
  totalPaid: number;
  balance: number;
  totalOverdue: number;
  overdueCount: number;
}

export function useFinancialEntries(query: FinancialQuery = {}) {
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);

  return useQuery({
    queryKey: ['financial-entries', workspaceId, query],
    queryFn: async () => {
      const { data } = await api.get('/financial/entries', { params: query });
      return data.data as { items: FinancialEntry[]; meta: { page: number; limit: number; total: number; pages: number } };
    },
    enabled: !!workspaceId,
  });
}

export function useFinancialSummary() {
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);

  return useQuery({
    queryKey: ['financial-summary', workspaceId],
    queryFn: async () => {
      const { data } = await api.get('/financial/summary');
      return data.data as FinancialSummary;
    },
    enabled: !!workspaceId,
  });
}

export function useFinancialForecast() {
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);

  return useQuery({
    queryKey: ['financial-forecast', workspaceId],
    queryFn: async () => {
      const { data } = await api.get('/financial/forecast');
      return data.data as {
        next30Days: { amount: number; count: number };
        next60Days: { amount: number; count: number };
        next90Days: { amount: number; count: number };
      };
    },
    enabled: !!workspaceId,
  });
}

export function useOverdueEntries() {
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);

  return useQuery({
    queryKey: ['financial-overdue', workspaceId],
    queryFn: async () => {
      const { data } = await api.get('/financial/overdue');
      return data.data as Array<FinancialEntry & { daysOverdue: number }>;
    },
    enabled: !!workspaceId,
  });
}

export function usePayEntry() {
  const queryClient = useQueryClient();
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);

  return useMutation({
    mutationFn: async ({
      id,
      paidAt,
      paidAmount,
      paymentMethod,
    }: {
      id: string;
      paidAt?: string;
      paidAmount?: number;
      paymentMethod?: string;
    }) => {
      const { data } = await api.patch(`/financial/entries/${id}/pay`, {
        paidAt,
        paidAmount,
        paymentMethod,
      });
      return data.data as FinancialEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-entries', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['financial-overdue', workspaceId] });
    },
  });
}

export interface CommissionItem {
  id: string;
  rate: number;
  amount: number;
  status: string;
  receivedValue?: number | null;
  paymentMethod?: string | null;
  paidAt?: string | null;
  contract?: { type: string; property?: { code?: string; street?: string | null } } | null;
}

export function useCommissions(query: { userId?: string; status?: string } = {}) {
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);

  return useQuery({
    queryKey: ['commissions', workspaceId, query],
    queryFn: async () => {
      const { data } = await api.get('/financial/commissions', { params: query });
      return data.data as { items: CommissionItem[]; meta?: { total: number } };
    },
    enabled: !!workspaceId,
  });
}

export function useReceiveCommission() {
  const queryClient = useQueryClient();
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);

  return useMutation({
    mutationFn: async ({ id, ...dto }: { id: string; receivedValue?: number; paymentMethod?: string; receivedAt?: string; notes?: string }) => {
      const { data } = await api.patch(`/financial/commissions/${id}/receive`, dto);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissions', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['financial-entries', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['split-transactions', workspaceId] });
    },
  });
}

export function useProcessCommissionSplit() {
  const queryClient = useQueryClient();
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/financial/commissions/${id}/process-split`, {});
      return data.data as { processed: number; totalRules: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['split-transactions', workspaceId] });
    },
  });
}
