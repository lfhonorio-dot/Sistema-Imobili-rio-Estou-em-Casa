'use client';

// Fase 4 — comissões das vendas ativadas: parcelas a receber da imobiliária
// e repasses a pagar aos corretores, vindos do financeiro (categoria COMMISSION).

import Link from 'next/link';
import { toast } from 'sonner';
import { useFinancialEntries, usePayEntry } from '@/hooks/use-financial';
import { getApiErrorMessage } from '@/lib/api-error';
import { brl } from '@/lib/funnel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/error-state';

const STATUS: Record<string, string> = {
  PENDING: 'Em aberto', OVERDUE: 'Atrasado', PAID: 'Pago', CANCELLED: 'Cancelado', EXEMPT: 'Isento',
};
const date = (v: string) => new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

function Table({ type, title }: { type: 'RECEIVABLE' | 'PAYABLE'; title: string }) {
  const q = useFinancialEntries({ type, category: 'COMMISSION', limit: 200 });
  const pay = usePayEntry();
  const items = (q.data?.items ?? []).filter((e) => e.status !== 'CANCELLED');
  const open = items.filter((e) => e.status === 'PENDING' || e.status === 'OVERDUE');
  const openTotal = open.reduce((s, e) => s + Number(e.amount), 0);

  const markPaid = async (id: string) => {
    if (!confirm(type === 'RECEIVABLE' ? 'Confirmar o recebimento desta parcela?' : 'Confirmar o pagamento deste repasse?')) return;
    try {
      await pay.mutateAsync({ id });
      toast.success(type === 'RECEIVABLE' ? 'Recebimento registrado' : 'Pagamento registrado');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title} — em aberto: {brl(openTotal)}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {q.isLoading ? <div className="p-4"><Skeleton className="h-16 w-full" /></div> : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} compact />
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhum lançamento.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-muted-foreground">
              <tr><th className="px-4 py-2 font-medium">Descrição</th><th className="px-4 py-2 font-medium">Vencimento</th>
                <th className="px-4 py-2 font-medium text-right">Valor</th><th className="px-4 py-2 font-medium">Situação</th><th /></tr>
            </thead>
            <tbody className="divide-y">
              {items.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2">
                    {e.contractId ? <Link href={`/contracts/${e.contractId}`} className="hover:underline">{e.description}</Link> : e.description}
                  </td>
                  <td className="px-4 py-2">{date(e.dueDate)}</td>
                  <td className="px-4 py-2 text-right">{brl(e.amount)}</td>
                  <td className="px-4 py-2">{STATUS[e.status] ?? e.status}</td>
                  <td className="px-4 py-2 text-right">
                    {(e.status === 'PENDING' || e.status === 'OVERDUE') && (
                      <Button size="sm" variant="outline" disabled={pay.isPending} onClick={() => markPaid(e.id)}>
                        {type === 'RECEIVABLE' ? 'Recebida' : 'Paga'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

export function SaleCommissionsSection() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Comissões das vendas</h2>
        <p className="text-sm text-muted-foreground">
          Geradas ao ativar cada venda: as parcelas que a imobiliária recebe e os repasses aos corretores
          (pagos depois do recebimento da parcela correspondente).
        </p>
      </div>
      <Table type="RECEIVABLE" title="A receber (imobiliária)" />
      <Table type="PAYABLE" title="A pagar (corretores e parceiros)" />
    </div>
  );
}
