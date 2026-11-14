'use client';
// Boletos e PIX (Fase 1: limpeza). Diferencia erro de lista vazia, avisa
// quando não há gateway real e identifica os boletos "simulados" antigos,
// criados antes desta versão, que não têm validade bancária.
// Emissão de PIX avulso, cancelamento no gateway e envio ao pagador: Fase 5.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { ErrorState, UnavailableNotice } from '@/components/common/error-state';
import { getApiErrorMessage } from '@/lib/api-error';

type Boleto = {
  id: string;
  amount: number | string;
  dueDate: string;
  status: string;
  nossoNumero: string;
  gatewayBoletoId?: string | null;
  linhaDigitavel?: string;
  bankSlipUrl?: string | null;
  paidAt?: string;
  paidAmount?: number | string;
};

type Gateway = { id: string; provider: string; isActive: boolean; isDefault: boolean };

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente', REGISTERED: 'Registrado', PAID: 'Pago',
  OVERDUE: 'Vencido', CANCELLED: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  REGISTERED: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

export default function BillingPage() {
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);
  const queryClient = useQueryClient();

  const boletosQuery = useQuery({
    queryKey: ['boletos', workspaceId],
    queryFn: async () => {
      const r = await api.get('/billing/boletos', { params: { page: 1, limit: 50 } });
      return r.data.data as { items: Boleto[]; meta: { total: number } };
    },
    enabled: !!workspaceId,
  });

  const gatewaysQuery = useQuery({
    queryKey: ['billing-gateways', workspaceId],
    queryFn: async () => (await api.get('/billing/gateways')).data.data as Gateway[],
    enabled: !!workspaceId,
  });

  const confirmMutation = useMutation({
    mutationFn: async (id: string) => (await api.post(`/billing/boletos/${id}/confirm-payment`, {})).data.data,
    onSuccess: () => {
      toast.success('Pagamento confirmado');
      queryClient.invalidateQueries({ queryKey: ['boletos'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível confirmar o pagamento.')),
  });

  const handleConfirm = (id: string) => {
    if (!confirm('Confirmar manualmente o pagamento deste boleto?')) return;
    confirmMutation.mutate(id);
  };

  const hasAsaas = (gatewaysQuery.data ?? []).some((g) => g.provider === 'ASAAS' && g.isActive);
  const boletos = boletosQuery.data?.items ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Boletos e PIX</h1>
        {boletosQuery.data && (
          <p className="text-sm text-gray-500 mt-1">{boletosQuery.data.meta.total} boleto(s) no total</p>
        )}
      </div>

      {gatewaysQuery.isError ? (
        <ErrorState error={gatewaysQuery.error} onRetry={() => gatewaysQuery.refetch()} title="Não foi possível verificar o gateway" compact />
      ) : gatewaysQuery.data && !hasAsaas ? (
        <UnavailableNotice title="Emissão de boleto e PIX não disponível">
          Nenhum gateway Asaas ativo está configurado, então o sistema não emite boletos. Enquanto
          isso, registre os recebimentos manualmente em Financeiro → A Receber.
        </UnavailableNotice>
      ) : null}

      {boletosQuery.isLoading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : boletosQuery.isError ? (
        <div className="bg-white rounded-lg border">
          <ErrorState error={boletosQuery.error} onRetry={() => boletosQuery.refetch()} />
        </div>
      ) : boletos.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Nenhum boleto emitido ainda.</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Nosso Número</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Valor</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Vencimento</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {boletos.map((b) => {
                const simulated = !b.gatewayBoletoId;
                return (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {b.nossoNumero}
                      {simulated && (
                        <span
                          className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 font-sans text-[11px] text-gray-500"
                          title="Criado antes desta versão, sem gateway: os dados bancários não são reais."
                        >
                          simulado — sem validade bancária
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {Number(b.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(b.dueDate).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[b.status] ?? 'bg-gray-100'}`}>
                        {STATUS_LABELS[b.status] ?? b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-3">
                      {b.bankSlipUrl && (
                        <a href={b.bankSlipUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                          Ver boleto
                        </a>
                      )}
                      {['PENDING', 'REGISTERED', 'OVERDUE'].includes(b.status) && (
                        <button
                          onClick={() => handleConfirm(b.id)}
                          disabled={confirmMutation.isPending}
                          className="text-xs text-green-600 hover:underline disabled:opacity-50"
                        >
                          Confirmar pagamento
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
