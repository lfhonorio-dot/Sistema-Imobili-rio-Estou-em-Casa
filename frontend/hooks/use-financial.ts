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

export interface CreateFinancialEntryInput {
  type: 'RECEIVABLE' | 'PAYABLE';
  category: string;
  description: string;
  amount: number;
  /** Data no formato YYYY-MM-DD (input type="date") */
  dueDate: string;
  contractId?: string;
  propertyId?: string;
  contactId?: string;
  notes?: string;
  /** Repete o lançamento por N meses a partir do vencimento (1 = lançamento único) */
  months?: number;
}

// Extrai a mensagem que o backend mandou; sem ela, cai no texto genérico.
function apiErrorMessage(err: unknown, fallback: string) {
  const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(msg)) return msg[0] ?? fallback;
  return msg ?? fallback;
}

// Cria lançamento manual (POST /financial/entries). Com months > 1 gera uma
// parcela por mês, sequencialmente — se uma falhar, o erro diz quantas já
// entraram, para não dar a impressão de que nada foi gravado.
export function useCreateEntry() {
  const queryClient = useQueryClient();
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);

  return useMutation({
    mutationFn: async ({ months, ...input }: CreateFinancialEntryInput) => {
      const total = Math.min(Math.max(Math.trunc(months ?? 1), 1), 60);
      // Meio-dia local: converter para ISO não pode empurrar a data para o dia
      // anterior por causa do fuso (Brasil é UTC-3).
      const base = new Date(`${input.dueDate}T12:00:00`);
      if (Number.isNaN(base.getTime())) throw new Error('Data de vencimento inválida.');

      const created: FinancialEntry[] = [];
      for (let i = 0; i < total; i++) {
        const dueDate = new Date(base);
        dueDate.setMonth(dueDate.getMonth() + i);
        // Dia 31 em mês de 30 dias transborda para o mês seguinte: volta para
        // o último dia do mês pretendido.
        if (dueDate.getDate() !== base.getDate()) dueDate.setDate(0);

        try {
          const { data } = await api.post('/financial/entries', {
            ...input,
            dueDate: dueDate.toISOString(),
            ...(total > 1 ? { installment: i + 1, totalInstallments: total } : {}),
          });
          created.push(data.data as FinancialEntry);
        } catch (err) {
          const detail = apiErrorMessage(err, 'Erro ao criar lançamento.');
          throw new Error(
            created.length > 0
              ? `${created.length} de ${total} parcelas foram criadas. A parcela ${i + 1} falhou: ${detail}`
              : detail,
          );
        }
      }
      return created;
    },
    // onSettled: mesmo em falha parcial o que entrou precisa aparecer na tela.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-entries', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['financial-forecast', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['financial-overdue', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['cash-flow', workspaceId] });
    },
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

export interface CashFlowMonth {
  month: string;
  realizedIn: number;
  realizedOut: number;
  realizedNet: number;
  projectedIn: number;
  projectedOut: number;
  projectedNet: number;
  cumulativeBalance: number;
}

// Fluxo de caixa real: realizado (por data de pagamento) separado de
// previsto (por data de vencimento), com saldo acumulado mês a mês.
export function useCashFlow() {
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);

  return useQuery({
    queryKey: ['cash-flow', workspaceId],
    queryFn: async () => {
      const { data } = await api.get('/reports/cash-flow');
      return data.data as CashFlowMonth[];
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

// Busca o HTML do recibo de comissão. O endpoint exige autenticação, então não
// dá para apontar um <a href> direto para a rota do backend: baixamos pelo
// axios e abrimos como blob — mesmo padrão do documento do contrato.
export async function fetchCommissionReceiptHtml(id: string): Promise<string> {
  const { data } = await api.get(`/financial/commissions/${id}/receipt`, {
    responseType: 'text',
    headers: { Accept: 'text/html' },
  });
  return data as string;
}
