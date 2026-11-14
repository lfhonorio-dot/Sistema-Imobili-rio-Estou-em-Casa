'use client';

// Fase 7 — "Minhas comissões": o que a imobiliária deve ao próprio usuário
// (é a única parte do financeiro que o Corretor vê).

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/error-state';
import { useMyCommissions } from '@/hooks/use-team';

const brl = (v: unknown) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dt = (v?: string | null) => (v ? new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—');
const ST: Record<string, string> = { PENDING: 'A receber', OVERDUE: 'Atrasada', PAID: 'Paga', CANCELLED: 'Cancelada', RECEIVED: 'Recebida' };

export default function MyCommissionsPage() {
  const q = useMyCommissions();
  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Minhas comissões</h1>
        <p className="text-sm text-muted-foreground">Repasses que a imobiliária paga a você, depois de receber cada parcela da comissão da venda.</p>
      </div>
      {q.isLoading ? <Skeleton className="h-40 w-full" /> : q.isError ? <Card><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Card><CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground">A receber</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-blue-600">{brl(q.data!.totals.toReceive)}</p><p className="text-xs text-muted-foreground">{q.data!.totals.openCount} parcela(s)</p></CardContent></Card>
            <Card><CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground">Já recebido</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-green-600">{brl(q.data!.totals.received)}</p></CardContent></Card>
          </div>
          <Card>
            <CardContent className="p-0">
              {q.data!.entries.length === 0 && q.data!.legacy.length === 0 ? <p className="p-6 text-sm text-muted-foreground">Nenhuma comissão em seu nome ainda.</p> : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-muted-foreground"><tr>
                    <th className="px-4 py-2">Venda</th><th className="px-4 py-2">Vencimento</th><th className="px-4 py-2 text-right">Valor</th><th className="px-4 py-2">Situação</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {q.data!.entries.map((e) => (
                      <tr key={e.id}>
                        <td className="px-4 py-2">{e.description}<p className="text-xs text-muted-foreground">{e.contract?.code ?? ''} {e.contract?.property?.code ? `· imóvel ${e.contract.property.code}` : ''}</p></td>
                        <td className="px-4 py-2">{dt(e.dueDate)}</td>
                        <td className="px-4 py-2 text-right">{brl(e.amount)}</td>
                        <td className="px-4 py-2">{ST[e.status] ?? e.status}{e.status === 'PAID' && e.paidAt ? ` em ${dt(e.paidAt)}` : ''}</td>
                      </tr>
                    ))}
                    {q.data!.legacy.map((c) => (
                      <tr key={c.id} className="text-muted-foreground">
                        <td className="px-4 py-2">Comissão (sistema antigo) {c.contract?.code ?? ''}</td><td className="px-4 py-2">—</td>
                        <td className="px-4 py-2 text-right">{brl(c.amount)}</td><td className="px-4 py-2">{ST[c.status] ?? c.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">Dúvidas sobre valores? Fale com o financeiro. Veja também seus <Link className="underline" href="/pipeline">negócios</Link>.</p>
        </>
      )}
    </div>
  );
}
