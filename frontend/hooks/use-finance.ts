// Fase 5 — hooks do financeiro: baixas, cobranças (boleto/PIX), categorias,
// centros de custo, multa/juros, recorrência, fluxo de caixa, DRE e bancário.
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

const useWs = () => useAuthStore((s) => s.currentWorkspaceId);

/** Invalida tudo que depende de lançamentos/baixas. */
export function useInvalidateFinance() {
  const qc = useQueryClient();
  return () => {
    for (const k of ['financial-entries', 'financial-summary', 'financial-forecast', 'financial-overdue', 'entry-payments',
      'charges', 'cash-flow5', 'dre', 'bank-accounts', 'bank-transactions', 'ledger', 'recurring', 'sales-dashboard']) {
      qc.invalidateQueries({ queryKey: [k] });
    }
  };
}

// ── Tipos ───────────────────────────────────────────────

export interface Payment {
  id: string; entryId: string; principal: string; interest: string; fine: string; discount: string; total: string;
  paidAt: string; method?: string | null; bankAccountId?: string | null; bankAccountName?: string | null;
  source: string; receiptUrl?: string | null; notes?: string | null;
  reversedAt?: string | null; reversalReason?: string | null;
}

export interface Charge {
  id: string; kind: 'BOLETO' | 'PIX'; status: string; amount: string; dueDate: string;
  bankSlipUrl?: string | null; linhaDigitavel?: string | null; pixCopiaECola?: string | null; pixQrCode?: string | null;
  gatewayBoletoId?: string | null; entryRef?: string | null; financialEntryId?: string | null;
  cancelReason?: string | null; cancelledAt?: string | null; paidAt?: string | null; paidAmount?: string | null;
  lastSentAt?: string | null; lastSentChannels?: string | null; description?: string | null; contactName?: string | null;
  createdAt: string; nossoNumero?: string | null;
}

export interface Category { id: string; type: 'RECEIVABLE' | 'PAYABLE'; code: string; name: string; isSystem: boolean; isActive: boolean }
export interface CostCenter { id: string; name: string; isActive: boolean }
export interface Recurring {
  id: string; type: string; category: string; description: string; amount: string; dayOfMonth: number;
  startDate: string; endDate?: string | null; isActive: boolean; generated: number; costCenterId?: string | null;
}
export interface BankAccount {
  id: string; name: string; bankName?: string | null; agency?: string | null; accountNumber?: string | null;
  isDefault: boolean; openingBalance: string; openingDate?: string | null; currentBalance: number; pendingReconciliation: number;
}
export interface BankTx {
  id: string; date: string; description?: string | null; amount: string; reconciled: boolean; importSource?: string | null;
  financialEntryId?: string | null; paymentId?: string | null; entry?: { id: string; description: string } | null;
  bankAccount?: { id: string; name: string };
}
export interface Gateway {
  id: string; provider: string; name: string; environment: string; isActive: boolean; isDefault: boolean;
  hasWebhookToken: boolean; webhookPath: string; settlementBankAccountId?: string | null;
}
export interface CashFlowRow { period: string; realizedIn: number; realizedOut: number; projectedIn: number; projectedOut: number; realizedBalance: number; projectedBalance: number }
export interface CashFlow {
  from: string; to: string; granularity: 'day' | 'month'; bankAccount: { id: string; name: string } | null; projectionIncluded: boolean;
  openingBalance: number; projectedOpening: number; rows: CashFlowRow[];
  totals: { realizedIn: number; realizedOut: number; projectedIn: number; projectedOut: number; closingRealized: number; closingProjected: number };
}
export interface DreLine { type: string; category: string; name: string; months: number[]; total: number }
export interface Dre {
  year: number; revenue: DreLine[]; expenses: DreLine[]; totalRevenue: number[]; totalExpenses: number[]; result: number[];
  totals: { revenue: number; expenses: number; result: number };
}

// ── Baixas ──────────────────────────────────────────────

/** Lançamento atualizado (a chave começa com 'financial-entries' para ser invalidada junto). */
export function useEntry(id?: string) {
  const ws = useWs();
  return useQuery({
    queryKey: ['financial-entries', ws, 'one', id],
    queryFn: async () => (await api.get(`/financial/entries/${id}`)).data.data as import('./use-financial').FinancialEntry & { openAmount: number },
    enabled: !!ws && !!id,
  });
}

export function useEntryPayments(entryId?: string) {
  const ws = useWs();
  return useQuery({
    queryKey: ['entry-payments', ws, entryId],
    queryFn: async () => (await api.get(`/financial/entries/${entryId}/payments`)).data.data as Payment[],
    enabled: !!ws && !!entryId,
  });
}

export function usePaymentSuggestion(entryId?: string, paidAt?: string) {
  const ws = useWs();
  return useQuery({
    queryKey: ['payment-suggestion', ws, entryId, paidAt],
    queryFn: async () => (await api.get(`/financial/entries/${entryId}/payment-suggestion`, { params: { paidAt } })).data.data as {
      openAmount: number; daysLate: number; fine: number; interest: number; total: number;
    },
    enabled: !!ws && !!entryId,
  });
}

export interface PaymentInput {
  principal: number; interest?: number; fine?: number; discount?: number; paidAt?: string;
  method?: string; bankAccountId?: string; receiptFileId?: string; notes?: string;
}

export function useRegisterPayment() {
  const inv = useInvalidateFinance();
  return useMutation({
    mutationFn: async ({ entryId, ...dto }: PaymentInput & { entryId: string }) =>
      (await api.post(`/financial/entries/${entryId}/payments`, dto)).data.data,
    onSuccess: inv,
  });
}

export function useReversePayment() {
  const inv = useInvalidateFinance();
  return useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) =>
      (await api.post(`/financial/payments/${paymentId}/reverse`, { reason })).data.data,
    onSuccess: inv,
  });
}

export async function uploadReceipt(file: File): Promise<{ id: string; fileName: string }> {
  const fd = new FormData();
  fd.append('file', file);
  return (await api.post('/financial/receipts', fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data.data;
}

export function useAttachReceipt() {
  const inv = useInvalidateFinance();
  return useMutation({
    mutationFn: async ({ paymentId, file }: { paymentId: string; file: File }) => {
      const fd = new FormData();
      fd.append('file', file);
      return (await api.post(`/financial/payments/${paymentId}/receipt`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data.data;
    },
    onSuccess: inv,
  });
}

export function useCancelEntry() {
  const inv = useInvalidateFinance();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await api.post(`/financial/entries/${id}/cancel`, { reason })).data.data,
    onSuccess: inv,
  });
}

export function useUpdateEntry() {
  const inv = useInvalidateFinance();
  return useMutation({
    mutationFn: async ({ id, ...dto }: Record<string, unknown> & { id: string }) =>
      (await api.patch(`/financial/entries/${id}`, dto)).data.data,
    onSuccess: inv,
  });
}

// ── Cobranças ───────────────────────────────────────────

export function useCharges(params: { entryId?: string; status?: string; kind?: string; page?: number; limit?: number } = {}, enabled = true) {
  const ws = useWs();
  return useQuery({
    queryKey: ['charges', ws, params],
    queryFn: async () => (await api.get('/billing/boletos', { params })).data.data as { items: Charge[]; meta: { total: number; pages: number } },
    enabled: !!ws && enabled,
  });
}

export function useIssueCharge() {
  const inv = useInvalidateFinance();
  return useMutation({
    mutationFn: async (dto: { financialEntryId: string; kind: 'BOLETO' | 'PIX'; dueDate?: string }) =>
      (await api.post('/billing/boletos', dto)).data.data as Charge,
    onSuccess: inv,
  });
}

export function useCancelCharge() {
  const inv = useInvalidateFinance();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await api.post(`/billing/boletos/${id}/cancel`, { reason })).data.data as Charge,
    onSuccess: inv,
  });
}

export function useReissueCharge() {
  const inv = useInvalidateFinance();
  return useMutation({
    mutationFn: async ({ id, newDueDate, kind }: { id: string; newDueDate: string; kind?: 'BOLETO' | 'PIX' }) =>
      (await api.post(`/billing/boletos/${id}/reissue`, { newDueDate, kind })).data.data as Charge,
    onSuccess: inv,
  });
}

export function useSendCharge() {
  const inv = useInvalidateFinance();
  return useMutation({
    mutationFn: async ({ id, channels }: { id: string; channels: Array<'EMAIL' | 'WHATSAPP'> }) =>
      (await api.post(`/billing/boletos/${id}/send`, { channels })).data.data as { sent: string[] },
    onSettled: inv,
  });
}

export function useGateways() {
  const ws = useWs();
  return useQuery({
    queryKey: ['billing-gateways', ws],
    queryFn: async () => (await api.get('/billing/gateways')).data.data as Gateway[],
    enabled: !!ws,
  });
}

export function useSaveGateway() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...dto }: Record<string, unknown> & { id?: string }) =>
      id ? (await api.patch(`/billing/gateways/${id}`, dto)).data.data : (await api.post('/billing/gateways', dto)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing-gateways'] }),
  });
}

export function useGatewayActions() {
  const qc = useQueryClient();
  const rotate = useMutation({
    mutationFn: async (id: string) => (await api.post(`/billing/gateways/${id}/webhook-token`)).data.data as { webhookToken: string; webhookPath: string },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing-gateways'] }),
  });
  const test = useMutation({
    mutationFn: async (id: string) => (await api.post(`/billing/gateways/${id}/test`)).data.data as { ok: boolean; environment: string },
  });
  return { rotate, test };
}

// ── Configurações ───────────────────────────────────────

export function useCategories(type?: string, all = false) {
  const ws = useWs();
  return useQuery({
    queryKey: ['fin-categories', ws, type, all],
    queryFn: async () => (await api.get('/financial/categories', { params: { type, all: all ? 'true' : undefined } })).data.data as Category[],
    enabled: !!ws,
  });
}

export function useCategoryMutations() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ['fin-categories'] });
  return {
    create: useMutation({ mutationFn: async (dto: { type: string; name: string }) => (await api.post('/financial/categories', dto)).data.data, onSuccess: done }),
    update: useMutation({ mutationFn: async ({ id, ...dto }: { id: string; name?: string; isActive?: boolean }) => (await api.patch(`/financial/categories/${id}`, dto)).data.data, onSuccess: done }),
    remove: useMutation({ mutationFn: async (id: string) => (await api.delete(`/financial/categories/${id}`)).data.data, onSuccess: done }),
  };
}

export function useCostCenters(all = false) {
  const ws = useWs();
  return useQuery({
    queryKey: ['cost-centers', ws, all],
    queryFn: async () => (await api.get('/financial/cost-centers', { params: { all: all ? 'true' : undefined } })).data.data as CostCenter[],
    enabled: !!ws,
  });
}

export function useCostCenterMutations() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ['cost-centers'] });
  return {
    create: useMutation({ mutationFn: async (dto: { name: string }) => (await api.post('/financial/cost-centers', dto)).data.data, onSuccess: done }),
    update: useMutation({ mutationFn: async ({ id, ...dto }: { id: string; name?: string; isActive?: boolean }) => (await api.patch(`/financial/cost-centers/${id}`, dto)).data.data, onSuccess: done }),
    remove: useMutation({ mutationFn: async (id: string) => (await api.delete(`/financial/cost-centers/${id}`)).data.data, onSuccess: done }),
  };
}

export function useFinancialSettings() {
  const ws = useWs();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['fin-settings', ws],
    queryFn: async () => (await api.get('/financial/settings')).data.data as { finePct: string; interestMonthlyPct: string },
    enabled: !!ws,
  });
  const save = useMutation({
    mutationFn: async (dto: { finePct?: number; interestMonthlyPct?: number }) => (await api.patch('/financial/settings', dto)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fin-settings'] }),
  });
  return { query, save };
}

export function useRecurring() {
  const ws = useWs();
  return useQuery({
    queryKey: ['recurring', ws],
    queryFn: async () => (await api.get('/financial/recurring')).data.data as Recurring[],
    enabled: !!ws,
  });
}

export function useRecurringMutations() {
  const inv = useInvalidateFinance();
  return {
    create: useMutation({ mutationFn: async (dto: Record<string, unknown>) => (await api.post('/financial/recurring', dto)).data.data as Recurring & { generatedNow: number }, onSuccess: inv }),
    update: useMutation({ mutationFn: async ({ id, ...dto }: Record<string, unknown> & { id: string }) => (await api.patch(`/financial/recurring/${id}`, dto)).data.data, onSuccess: inv }),
    remove: useMutation({ mutationFn: async (id: string) => (await api.delete(`/financial/recurring/${id}`)).data.data, onSuccess: inv }),
  };
}

// ── Relatórios ──────────────────────────────────────────

export function useCashFlow5(params: { granularity: 'day' | 'month'; from?: string; to?: string; bankAccountId?: string }) {
  const ws = useWs();
  return useQuery({
    queryKey: ['cash-flow5', ws, params],
    queryFn: async () => (await api.get('/financial/cash-flow', { params })).data.data as CashFlow,
    enabled: !!ws,
  });
}

export function useDre(year: number) {
  const ws = useWs();
  return useQuery({
    queryKey: ['dre', ws, year],
    queryFn: async () => (await api.get('/financial/dre', { params: { year } })).data.data as Dre,
    enabled: !!ws,
  });
}

/** Baixa um .xlsx autenticado (não dá para linkar direto: o endpoint exige token). */
export async function downloadXlsx(path: string, params: Record<string, unknown>, fileName: string) {
  const res = await api.get(path, { params, responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// ── Bancário ────────────────────────────────────────────

export function useBankAccounts() {
  const ws = useWs();
  return useQuery({
    queryKey: ['bank-accounts', ws],
    queryFn: async () => (await api.get('/banking/accounts')).data.data as BankAccount[],
    enabled: !!ws,
  });
}

export function useSaveBankAccount() {
  const inv = useInvalidateFinance();
  return useMutation({
    mutationFn: async ({ id, ...dto }: Record<string, unknown> & { id?: string }) =>
      id ? (await api.patch(`/banking/accounts/${id}`, dto)).data.data : (await api.post('/banking/accounts', dto)).data.data,
    onSuccess: inv,
  });
}

export function useBankTransactions(params: { bankAccountId?: string; reconciled?: string; page?: number; limit?: number }) {
  const ws = useWs();
  return useQuery({
    queryKey: ['bank-transactions', ws, params],
    queryFn: async () => (await api.get('/banking/transactions', { params })).data.data as { items: BankTx[]; meta: { total: number; pages: number } },
    enabled: !!ws && !!params.bankAccountId,
  });
}

export function useLedger(accountId?: string, from?: string, to?: string) {
  const ws = useWs();
  return useQuery({
    queryKey: ['ledger', ws, accountId, from, to],
    queryFn: async () => (await api.get(`/banking/accounts/${accountId}/ledger`, { params: { from, to } })).data.data as {
      openingBalance: number; closingBalance: number; credits: number; debits: number; from: string; to: string;
      rows: Array<{ id: string; date: string; description?: string | null; amount: number; balance: number; reconciled: boolean }>;
    },
    enabled: !!ws && !!accountId,
  });
}

export function useReconcileSuggestions(txId?: string) {
  const ws = useWs();
  return useQuery({
    queryKey: ['reconcile-suggestions', ws, txId],
    queryFn: async () => (await api.get(`/banking/transactions/${txId}/suggestions`)).data.data as {
      type: string;
      payments: Array<{ id: string; entryId: string; total: string; paidAt: string; entryDescription: string }>;
      entries: Array<{ id: string; description: string; openAmount: number; dueDate: string }>;
    },
    enabled: !!ws && !!txId,
  });
}

export function useBankingActions() {
  const inv = useInvalidateFinance();
  return {
    importStatement: useMutation({
      mutationFn: async (dto: { bankAccountId: string; fileName: string; content: string }) =>
        (await api.post('/banking/statement/import', dto)).data.data as { format: string; imported: number; duplicates: number; total: number },
      onSuccess: inv,
    }),
    reconcile: useMutation({
      mutationFn: async (dto: { bankTransactionId: string; financialEntryId?: string; paymentId?: string; notes?: string }) =>
        (await api.post('/banking/reconcile', dto)).data.data,
      onSuccess: inv,
    }),
    unreconcile: useMutation({
      mutationFn: async (id: string) => (await api.post(`/banking/transactions/${id}/unreconcile`)).data.data,
      onSuccess: inv,
    }),
    auto: useMutation({
      mutationFn: async (accountId: string) => (await api.post(`/banking/accounts/${accountId}/auto-reconcile`)).data.data as { matched: number; total: number },
      onSuccess: inv,
    }),
  };
}

// ── Vendas antigas ──────────────────────────────────────

export interface LegacySale {
  id: string; code?: string | null; type: string; propertyCode?: string | null; createdAt: string; saleValue?: number | null;
  suggestedCommission?: number | null; commissionEntries: number; needsRegularization: boolean;
  legacyCommissions: Array<{ status: string; amount: number }>; cancelledPropertyValueEntries: number;
}

export function useLegacySales() {
  const ws = useWs();
  return useQuery({
    queryKey: ['legacy-sales', ws],
    queryFn: async () => (await api.get('/contracts/sale/legacy')).data.data as LegacySale[],
    enabled: !!ws,
  });
}

export function useRegularizeSale() {
  const qc = useQueryClient();
  const inv = useInvalidateFinance();
  return useMutation({
    mutationFn: async ({ id, ...dto }: Record<string, unknown> & { id: string }) =>
      (await api.post(`/contracts/${id}/sale/regularize`, dto)).data.data,
    onSuccess: () => { inv(); qc.invalidateQueries({ queryKey: ['legacy-sales'] }); },
  });
}

// ── Formatação ──────────────────────────────────────────

export const brl = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const dmy = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—');
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** "1.234,56" ou "1234.56" → número */
export function parseMoney(v: string): number {
  const s = v.trim();
  if (!s) return 0;
  const n = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const x = Number(n);
  return Number.isFinite(x) ? x : NaN;
}
export const METHOD_LABELS: Record<string, string> = {
  PIX: 'PIX', TRANSFER: 'Transferência', CASH: 'Dinheiro', BOLETO: 'Boleto', CARD: 'Cartão', CHECK: 'Cheque', OTHER: 'Outro', RETENTION: 'Retenção',
};
export const SOURCE_LABELS: Record<string, string> = {
  MANUAL: 'Manual', GATEWAY: 'Asaas (automático)', RECONCILIATION: 'Conciliação bancária', LEGACY: 'Histórico', RETENTION: 'Retenção na fonte (NFS-e)',
};
export const CHARGE_STATUS: Record<string, string> = {
  PENDING: 'Pendente', REGISTERED: 'Emitida', SENT: 'Enviada', OVERDUE: 'Vencida', PAID: 'Paga', CANCELLED: 'Cancelada', REFUNDED: 'Estornada',
};
