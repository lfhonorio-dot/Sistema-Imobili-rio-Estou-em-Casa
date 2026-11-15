'use client';

// Fase 5 — contas a receber / a pagar: filtros, situação (inclusive
// "parcial"), cobrança ativa e ações (baixar, cobrar, detalhes).

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ErrorState } from '@/components/common/error-state';
import { useFinancialEntries, type FinancialEntry } from '@/hooks/use-financial';
import { brl, dmy, useCategories, useCostCenters } from '@/hooks/use-finance';

type Entry = FinancialEntry & { openAmount?: number; isPartial?: boolean };
const ALL = 'ALL';

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Em aberto', cls: 'bg-gray-100 text-gray-700' },
  OVERDUE: { label: 'Atrasada', cls: 'bg-red-100 text-red-700' },
  PAID: { label: 'Quitada', cls: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-400' },
  EXEMPT: { label: 'Isenta', cls: 'bg-gray-100 text-gray-500' },
};

export function EntriesTable({ type, onNew, onPay, onCharge, onOpen }: {
  type: 'RECEIVABLE' | 'PAYABLE';
  onNew: () => void;
  onPay: (e: Entry) => void;
  onCharge: (e: Entry) => void;
  onOpen: (e: Entry) => void;
}) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('OPEN');
  const [category, setCategory] = useState(ALL);
  const [costCenterId, setCostCenterId] = useState(ALL);
  const [search, setSearch] = useState('');
  const cats = useCategories(type, true);
  const centers = useCostCenters(true);
  const q = useFinancialEntries({
    type, page, limit: 20,
    ...(status !== ALL && { status }),
    ...(category !== ALL && { category }),
    ...(costCenterId !== ALL && { costCenterId }),
    ...(search.trim() && { search: search.trim() }),
  });
  const catName = new Map((cats.data ?? []).map((c) => [c.code, c.name]));
  const isPay = type === 'PAYABLE';
  const reset = (fn: (v: string) => void) => (v: string) => { setPage(1); fn(v); };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={status} onValueChange={reset(setStatus)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="OPEN">Em aberto</SelectItem>
            <SelectItem value="OVERDUE">Atrasadas</SelectItem>
            <SelectItem value="PARTIAL">Parcialmente baixadas</SelectItem>
            <SelectItem value="PAID">Quitadas</SelectItem>
            <SelectItem value="CANCELLED">Canceladas</SelectItem>
            <SelectItem value={ALL}>Todas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={reset(setCategory)}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as categorias</SelectItem>
            {(cats.data ?? []).map((c) => <SelectItem key={c.id} value={c.code}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={costCenterId} onValueChange={reset(setCostCenterId)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Centro de custo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os centros</SelectItem>
            {(centers.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input className="w-56" placeholder="Buscar pela descrição" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        <Button variant="outline" size="sm" className="ml-auto" onClick={onNew}><Plus className="w-4 h-4 mr-1" />{isPay ? 'Nova conta a pagar' : 'Nova conta a receber'}</Button>
      </div>
      {(cats.isError || centers.isError) && <p className="text-xs text-red-600">Não foi possível carregar os filtros de categoria/centro de custo.</p>}

      {q.isLoading ? <Skeleton className="h-40 w-full" /> : q.isError ? (
        <div className="border rounded-lg"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>
      ) : (q.data?.items ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">Nenhuma conta {isPay ? 'a pagar' : 'a receber'} com esses filtros.</p>
      ) : (
        <>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-muted-foreground">
                <tr>
                  <th className="py-2 px-3 font-medium">Descrição</th>
                  <th className="py-2 px-3 font-medium">Vencimento</th>
                  <th className="py-2 px-3 font-medium text-right">Valor</th>
                  <th className="py-2 px-3 font-medium text-right">Em aberto</th>
                  <th className="py-2 px-3 font-medium">Situação</th>
                  <th className="py-2 px-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {(q.data!.items as Entry[]).map((e) => {
                  const st = STATUS[e.status] ?? { label: e.status, cls: 'bg-gray-100' };
                  const open = ['PENDING', 'OVERDUE'].includes(e.status);
                  return (
                    <tr key={e.id} className="hover:bg-gray-50/50">
                      <td className="py-2 px-3">
                        <button type="button" className="font-medium text-left hover:underline" onClick={() => onOpen(e)}>{e.description}</button>
                        <p className="text-xs text-muted-foreground">
                          {catName.get(e.category) ?? e.category}
                          {e.costCenter ? ` · ${e.costCenter.name}` : ''}
                          {e.supplier ? ` · ${e.supplier.name}` : e.contact ? ` · ${e.contact.name}` : ''}
                        </p>
                        {e.cancelReason && <p className="text-xs text-muted-foreground">Motivo: {e.cancelReason}</p>}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">{dmy(e.dueDate)}</td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">{brl(e.amount)}</td>
                      <td className="py-2 px-3 text-right whitespace-nowrap font-semibold">{open ? brl(e.openAmount) : '—'}</td>
                      <td className="py-2 px-3">
                        <span className={`text-xs rounded-full px-2 py-0.5 ${st.cls}`}>{st.label}</span>
                        {e.isPartial && <Badge variant="outline" className="ml-1 text-amber-700 border-amber-300">Parcial</Badge>}
                        {e.boleto && <Badge variant="outline" className="ml-1">{e.boleto.kind === 'PIX' ? 'PIX emitido' : 'Boleto emitido'}</Badge>}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap space-x-1">
                        {open && !isPay && !e.boleto && <Button size="sm" variant="outline" onClick={() => onCharge(e)}>Cobrar</Button>}
                        {open && !e.boleto && <Button size="sm" variant="outline" onClick={() => onPay(e)}>{isPay ? 'Pagar' : 'Receber'}</Button>}
                        <Button size="sm" variant="ghost" onClick={() => onOpen(e)}>Detalhes</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {q.data!.meta.pages > 1 && (
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Página {page} de {q.data!.meta.pages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={page >= q.data!.meta.pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
