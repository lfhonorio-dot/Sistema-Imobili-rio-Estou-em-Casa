// Fase 6 — hooks da NFS-e (SIL Tecnologia / Franca).
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

const useWs = () => useAuthStore((s) => s.currentWorkspaceId);

export interface Nfse {
  id: string; financialEntryId?: string | null; number?: string | null; verificationCode?: string | null;
  takerName: string; takerDocument: string; takerType?: string | null; takerEmail?: string | null; description: string;
  amount: number | string; baseAmount?: string | null; issRate: number; issDue?: string | null; issRetained: boolean;
  irRetained: string; pisRetained: string; cofinsRetained: string; csllRetained: string; issRetainedAmount: string; totalRetained: string; netAmount?: string | null;
  status: string; statusLabel: string; environment?: string | null; rpsSerie?: string | null; rpsNumber?: number | null;
  issuedAt?: string | null; cancelledAt?: string | null; cancelReason?: string | null; rejectionReason?: string | null;
  retryCount: number; nextAttemptAt?: string | null; xmlDownloadUrl?: string | null; pdfDownloadUrl?: string | null;
  autoIssued: boolean; retentionWarning?: string | null; emailedAt?: string | null; createdAt: string;
}

export interface NfseConfig {
  regime: string; razaoSocial?: string | null; cnpj?: string | null; inscricaoMunicipal?: string | null; municipio?: string | null;
  codigoMunicipioIbge: string; itemListaServico?: string | null; codigoTributacaoMunicipio?: string | null; cnae?: string | null;
  exigibilidadeIss: number; regimeEspecialTributacao?: number | null; optanteSimples: boolean; incentivoFiscal: boolean;
  aliquotaISS: number; aliquotaPIS: number; aliquotaCOFINS: number; aliquotaIRPJ: number; aliquotaCSLL: number; presumidoIRPJ: number; presumidoCSLL: number;
  retentionsEnabled: boolean; retIrPct: string; retPisPct: string; retCofinsPct: string; retCsllPct: string; retMinAmount: string; retainIssWhenPj: boolean;
  autoIssueOnReceipt: boolean; rpsSerie: string; rpsNextNumber: number; nfseEnvironment: 'HOMOLOG' | 'PRODUCTION';
  nfseWsUrlHomolog?: string | null; nfseWsUrlProd?: string | null; nfseSoapNamespace: string; effectiveWsUrl?: string | null;
  hasCertificate: boolean; certificateExpired: boolean; certSubject?: string | null; certValidUntil?: string | null;
  productionAuthorizedAt?: string | null; readiness: { ready: boolean; missing: string[] };
}

export interface NfsePreview {
  entry: { id: string; description: string; amount: number; status: string; openAmount: number };
  taker: { id: string; name: string; document: string | null; type: 'PF' | 'PJ' | null; email?: string | null } | null;
  description: string; environment: string;
  taxes: { base: number; issRatePct: number; issDue: number; issRetained: boolean; issRetainedAmount: number; irRetained: number;
    pisRetained: number; cofinsRetained: number; csllRetained: number; totalRetained: number; netAmount: number };
  readiness: { ready: boolean; missing: string[] }; problems: string[]; canIssue: boolean;
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    for (const k of ['nfse', 'nfse-config', 'nfse-report', 'financial-entries', 'entry-payments', 'financial-summary', 'cash-flow5']) {
      qc.invalidateQueries({ queryKey: [k] });
    }
  };
}

export function useNfseList(params: { status?: string; search?: string; entryId?: string; page?: number; limit?: number }, enabled = true) {
  const ws = useWs();
  return useQuery({
    queryKey: ['nfse', ws, params],
    queryFn: async () => (await api.get('/nfse', { params })).data.data as { items: Nfse[]; meta: { total: number; pages: number } },
    enabled: !!ws && enabled,
    // enquanto houver nota na fila/processando, atualiza sozinho
    refetchInterval: (q) => ((q.state.data?.items ?? []).some((n) => n.status === 'QUEUED' || n.status === 'PROCESSING') ? 5000 : false),
  });
}

export function useNfseConfig() {
  const ws = useWs();
  return useQuery({
    queryKey: ['nfse-config', ws],
    queryFn: async () => (await api.get('/nfse/config')).data.data as NfseConfig,
    enabled: !!ws,
  });
}

export function useNfseConfigActions() {
  const inv = useInvalidate();
  return {
    save: useMutation({ mutationFn: async (dto: Record<string, unknown>) => (await api.patch('/nfse/config', dto)).data.data as NfseConfig, onSuccess: inv }),
    uploadCert: useMutation({
      mutationFn: async ({ file, password }: { file: File; password: string }) => {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('password', password);
        return (await api.post('/nfse/config/certificate', fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data.data as NfseConfig;
      },
      onSuccess: inv,
    }),
    removeCert: useMutation({ mutationFn: async () => (await api.delete('/nfse/config/certificate')).data.data, onSuccess: inv }),
    authorizeProduction: useMutation({ mutationFn: async (confirm: string) => (await api.post('/nfse/config/authorize-production', { confirm })).data.data, onSuccess: inv }),
    backToHomolog: useMutation({ mutationFn: async () => (await api.post('/nfse/config/back-to-homolog')).data.data, onSuccess: inv }),
  };
}

export function useNfsePreview(entryId?: string) {
  const ws = useWs();
  return useQuery({
    queryKey: ['nfse-preview', ws, entryId],
    queryFn: async () => (await api.post(`/nfse/entries/${entryId}/preview`, {})).data.data as NfsePreview,
    enabled: !!ws && !!entryId,
  });
}

export function useNfseActions() {
  const inv = useInvalidate();
  return {
    request: useMutation({
      mutationFn: async ({ entryId, ...dto }: { entryId: string; description?: string; competence?: string }) =>
        (await api.post(`/nfse/entries/${entryId}`, dto)).data.data as Nfse,
      onSettled: inv,
    }),
    retry: useMutation({ mutationFn: async (id: string) => (await api.post(`/nfse/${id}/retry`)).data.data as Nfse, onSettled: inv }),
    cancel: useMutation({
      mutationFn: async ({ id, reason, code }: { id: string; reason: string; code: string }) => (await api.post(`/nfse/${id}/cancel`, { reason, code })).data.data as Nfse,
      onSettled: inv,
    }),
    email: useMutation({
      mutationFn: async ({ id, to }: { id: string; to?: string }) => (await api.post(`/nfse/${id}/email`, { to })).data.data as { to: string },
      onSettled: inv,
    }),
  };
}

export function useNfseReport(month: string) {
  const ws = useWs();
  return useQuery({
    queryKey: ['nfse-report', ws, month],
    queryFn: async () => (await api.get('/nfse/report', { params: { month } })).data.data as {
      month: string; environment: string; notes: Nfse[];
      totals: { count: number; cancelled: number; base: number; issDue: number; issRetained: number; irRetained: number; pisRetained: number;
        cofinsRetained: number; csllRetained: number; totalRetained: number; net: number };
      estimate: { pis: number; cofins: number; irpj: number; csll: number };
    },
    enabled: !!ws && /^\d{4}-\d{2}$/.test(month),
  });
}

export const NFSE_STATUS_STYLE: Record<string, string> = {
  QUEUED: 'bg-yellow-100 text-yellow-800', PROCESSING: 'bg-yellow-100 text-yellow-800', PENDING: 'bg-yellow-100 text-yellow-800',
  AUTHORIZED: 'bg-green-100 text-green-700', ISSUED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700', ERROR: 'bg-red-100 text-red-700', CANCELLED: 'bg-gray-100 text-gray-500',
};
