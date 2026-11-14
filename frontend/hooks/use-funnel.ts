'use client';

// Fase 3 — visitas, propostas e ligação negócio → contrato.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export interface Visit {
  id: string;
  dealId: string | null;
  contactId: string;
  propertyId: string;
  brokerId: string | null;
  broker: { id: string; name: string } | null;
  scheduledAt: string;
  durationMin: number;
  status: 'SCHEDULED' | 'DONE' | 'CANCELLED' | 'NO_SHOW';
  feedback: string | null;
  interestLevel: string | null;
  cancelReason: string | null;
  contact: { id: string; name: string; phone?: string | null };
  property: { id: string; code: string; street?: string | null; number?: string | null; neighborhood?: string | null; city?: string | null };
  deal: { id: string; title: string } | null;
  dealMovedTo?: string | null;
}

export interface Proposal {
  id: string;
  dealId: string;
  propertyId: string;
  parentId: string | null;
  kind: 'OFFER' | 'COUNTER';
  amount: string | number;
  paymentMethod: string;
  downPayment: string | number | null;
  financedAmount: string | number | null;
  fgtsAmount: string | number | null;
  exchangeDescription: string | null;
  conditions: string | null;
  validUntil: string;
  status: string;
  situation: 'OPEN' | 'EXPIRED' | 'ACCEPTED' | 'REJECTED' | 'COUNTERED' | 'WITHDRAWN';
  decisionNote: string | null;
  createdAt: string;
  property?: { id: string; code: string; street?: string | null; number?: string | null };
  dealMovedTo?: string | null;
}

export interface ContractDraft {
  dealId: string;
  existingContractId: string | null;
  type: string;
  propertyId: string | null;
  propertyCode: string | null;
  ownerId: string | null;
  tenantId: string;
  buyerName: string;
  saleValue: number | null;
  commissionRate: number | null;
  paymentMethod: string | null;
  proposalDate: string | null;
  acceptanceDate: string | null;
  warnings: string[];
}

export interface VisitQuery {
  from?: string;
  to?: string;
  status?: string;
  mine?: boolean;
  dealId?: string;
  propertyId?: string;
}

const useWs = () => useAuthStore((s) => s.currentWorkspaceId);

export function useVisits(q: VisitQuery = {}) {
  const ws = useWs();
  return useQuery({
    queryKey: ['visits', ws, q],
    queryFn: async () =>
      (await api.get('/visits', { params: { ...q, mine: q.mine ? 'true' : undefined } })).data.data as Visit[],
    enabled: !!ws,
  });
}

export function useProposals(dealId: string) {
  const ws = useWs();
  return useQuery({
    queryKey: ['proposals', ws, dealId],
    queryFn: async () => (await api.get('/proposals', { params: { dealId } })).data.data as Proposal[],
    enabled: !!ws && !!dealId,
  });
}

export function useContractDraft(dealId: string | null) {
  const ws = useWs();
  return useQuery({
    queryKey: ['contract-draft', ws, dealId],
    queryFn: async () => (await api.get(`/deals/${dealId}/contract-draft`)).data.data as ContractDraft,
    enabled: !!ws && !!dealId,
    retry: false,
  });
}

/** Mutação que invalida o que o funil afeta (visitas, propostas, negócios, tarefas). */
export function useFunnelMutation<TVars, TResult = unknown>(fn: (v: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of ['visits', 'proposals', 'deals', 'deal', 'activities', 'contract-draft', 'sales-dashboard']) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export const funnelApi = {
  createVisit: async (body: Record<string, unknown>) => (await api.post('/visits', body)).data.data as Visit,
  completeVisit: async ({ id, ...body }: { id: string; interestLevel: string; feedback?: string }) =>
    (await api.patch(`/visits/${id}/complete`, body)).data.data as Visit,
  cancelVisit: async ({ id, ...body }: { id: string; reason: string; status?: 'CANCELLED' | 'NO_SHOW' }) =>
    (await api.patch(`/visits/${id}/cancel`, body)).data.data as Visit,
  rescheduleVisit: async ({ id, ...body }: { id: string; scheduledAt: string }) =>
    (await api.patch(`/visits/${id}/reschedule`, body)).data.data as Visit,
  createProposal: async (body: Record<string, unknown>) => (await api.post('/proposals', body)).data.data as Proposal,
  counterProposal: async ({ id, ...body }: { id: string } & Record<string, unknown>) =>
    (await api.post(`/proposals/${id}/counter`, body)).data.data as Proposal,
  decideProposal: async ({ id, action, note }: { id: string; action: 'accept' | 'reject' | 'withdraw'; note?: string }) =>
    (await api.patch(`/proposals/${id}/${action}`, { note })).data.data as Proposal,
  setDealProperties: async ({ dealId, propertyIds }: { dealId: string; propertyIds: string[] }) =>
    (await api.put(`/deals/${dealId}/properties`, { propertyIds })).data.data,
  proposalDocument: async (id: string) => (await api.get(`/proposals/${id}/document`, { responseType: 'text' })).data as string,
};
