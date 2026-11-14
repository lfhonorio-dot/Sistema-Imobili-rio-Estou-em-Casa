'use client';

// Fase 4 — ciclo de vida da venda: prévia, ativação, rescisão, análise de
// espécie e checklist de pós-venda.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export interface ActivateSaleInput {
  commissionAmount?: number;
  commissionPayerId?: string;
  installmentsCount?: number;
  firstDueDate?: string;
  sellerBrokerId?: string;
  sellerBrokerPct?: number;
  captorBrokerId?: string;
  captorBrokerPct?: number;
  paymentMethod?: string;
  cashInvolved?: boolean;
  cashAmount?: number;
}

export interface SalePreview {
  contractCode: string | null;
  status: string;
  payer: { id: string; name: string };
  suggestedCaptorId: string | null;
  commissionTotal: number;
  receivables: Array<{ installment: number; totalInstallments: number; dueDate: string; amount: number }>;
  payables: Array<{ kind: string; label: string; installment: number; dueDate: string; amount: number }>;
  perBeneficiary: Array<{ kind: string; label: string; pct: number; amount: number }>;
  agencyNet: number;
  warnings: string[];
}

export interface ChecklistItem {
  id: string;
  key: string;
  title: string;
  responsibleId: string | null;
  responsibleName: string | null;
  dueDate: string | null;
  status: 'PENDING' | 'DONE' | 'NOT_APPLICABLE' | 'CANCELLED';
  doneAt: string | null;
  doneByName: string | null;
  notes: string | null;
  overdue: boolean;
}

const useWs = () => useAuthStore((s) => s.currentWorkspaceId);

function useInvalidateContract() {
  const qc = useQueryClient();
  return () => {
    for (const k of ['contract', 'contracts', 'contract-checklist', 'financial', 'financial-entries', 'sales-dashboard', 'properties', 'property']) {
      void qc.invalidateQueries({ queryKey: [k] });
    }
  };
}

export function useSalePreview(contractId: string) {
  return useMutation({
    mutationFn: async (body: ActivateSaleInput) =>
      (await api.post(`/contracts/${contractId}/sale/preview`, body)).data.data as SalePreview,
  });
}

export function useActivateSale(contractId: string) {
  const invalidate = useInvalidateContract();
  return useMutation({
    mutationFn: async (body: ActivateSaleInput) =>
      (await api.post(`/contracts/${contractId}/sale/activate`, body)).data.data as {
        receivables: number; payables: number; commissionTotal: number; agencyNet: number; warnings: string[];
      },
    onSuccess: invalidate,
  });
}

export function useRescindSale(contractId: string) {
  const invalidate = useInvalidateContract();
  return useMutation({
    mutationFn: async (reason: string) =>
      (await api.post(`/contracts/${contractId}/sale/rescind`, { reason })).data.data as {
        cancelled: number; reversals: number; warnings: string[];
      },
    onSuccess: invalidate,
  });
}

export function useCashReview(contractId: string) {
  const invalidate = useInvalidateContract();
  return useMutation({
    mutationFn: async (note: string) => (await api.patch(`/contracts/${contractId}/sale/cash-review`, { note })).data.data,
    onSuccess: invalidate,
  });
}

export function useChecklist(contractId: string, enabled: boolean) {
  const ws = useWs();
  return useQuery({
    queryKey: ['contract-checklist', ws, contractId],
    queryFn: async () => (await api.get(`/contracts/${contractId}/checklist`)).data.data as ChecklistItem[],
    enabled: !!ws && enabled,
  });
}

export function useChecklistMutation(contractId: string) {
  const invalidate = useInvalidateContract();
  return {
    update: useMutation({
      mutationFn: async ({ itemId, ...body }: { itemId: string; status?: string; responsibleId?: string | null; dueDate?: string | null; notes?: string | null }) =>
        (await api.patch(`/contracts/${contractId}/checklist/${itemId}`, body)).data.data,
      onSuccess: invalidate,
    }),
    add: useMutation({
      mutationFn: async (body: { title: string; dueDate?: string; responsibleId?: string }) =>
        (await api.post(`/contracts/${contractId}/checklist`, body)).data.data,
      onSuccess: invalidate,
    }),
  };
}
