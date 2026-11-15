'use client';

// Fase 5 — configurações do financeiro: plano de categorias, centros de
// custo, multa/juros padrão, recorrências mensais e vendas antigas.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ErrorState } from '@/components/common/error-state';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  brl, dmy, parseMoney, todayISO, useCategories, useCategoryMutations, useCostCenterMutations, useCostCenters,
  useFinancialSettings, useLegacySales, useRecurring, useRecurringMutations, useRegularizeSale,
} from '@/hooks/use-finance';

const run = async (p: Promise<unknown>, ok: string) => {
  try { await p; toast.success(ok); return true; } catch (err) { toast.error(getApiErrorMessage(err)); return false; }
};

function CategoriesCard() {
  const q = useCategories(undefined, true);
  const m = useCategoryMutations();
  const [type, setType] = useState('PAYABLE');
  const [name, setName] = useState('');
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Plano de categorias</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="RECEIVABLE">Receita</SelectItem><SelectItem value="PAYABLE">Despesa</SelectItem></SelectContent>
          </Select>
          <Input className="flex-1 min-w-48" placeholder="Nome da nova categoria" value={name} onChange={(e) => setName(e.target.value)} />
          <Button disabled={!name.trim() || m.create.isPending} onClick={async () => { if (await run(m.create.mutateAsync({ type, name }), 'Categoria criada.')) setName(''); }}>Adicionar</Button>
        </div>
        {q.isLoading ? <Skeleton className="h-24 w-full" /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} compact /> : (
          <div className="grid md:grid-cols-2 gap-4">
            {(['RECEIVABLE', 'PAYABLE'] as const).map((t) => (
              <div key={t}>
                <p className="font-medium mb-1">{t === 'RECEIVABLE' ? 'Receitas' : 'Despesas'}</p>
                <ul className="divide-y rounded-md border">
                  {q.data!.filter((c) => c.type === t).map((c) => (
                    <li key={c.id} className="flex items-center justify-between px-2 py-1.5">
                      <span className={c.isActive ? '' : 'text-muted-foreground line-through'}>{c.name}</span>
                      <span className="space-x-2 text-xs">
                        <button type="button" className="text-blue-600 hover:underline" onClick={() => {
                          const n = window.prompt('Novo nome:', c.name);
                          if (n?.trim()) void run(m.update.mutateAsync({ id: c.id, name: n }), 'Categoria renomeada.');
                        }}>Renomear</button>
                        <button type="button" className="text-blue-600 hover:underline" onClick={() => void run(m.update.mutateAsync({ id: c.id, isActive: !c.isActive }), c.isActive ? 'Categoria desativada.' : 'Categoria reativada.')}>
                          {c.isActive ? 'Desativar' : 'Reativar'}
                        </button>
                        {!c.isSystem && <button type="button" className="text-red-600 hover:underline" onClick={() => { if (confirm(`Remover "${c.name}"? Lançamentos antigos continuam com ela.`)) void run(m.remove.mutateAsync(c.id), 'Categoria removida.'); }}>Remover</button>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CostCentersCard() {
  const q = useCostCenters(true);
  const m = useCostCenterMutations();
  const [name, setName] = useState('');
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Centros de custo</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex gap-2">
          <Input placeholder="Ex.: Vendas, Administrativo, Marketing" value={name} onChange={(e) => setName(e.target.value)} />
          <Button disabled={!name.trim() || m.create.isPending} onClick={async () => { if (await run(m.create.mutateAsync({ name }), 'Centro de custo criado.')) setName(''); }}>Adicionar</Button>
        </div>
        {q.isLoading ? <Skeleton className="h-12 w-full" /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} compact /> : q.data!.length === 0 ? (
          <p className="text-muted-foreground">Nenhum centro de custo cadastrado.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {q.data!.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-2 py-1.5">
                <span className={c.isActive ? '' : 'text-muted-foreground line-through'}>{c.name}</span>
                <span className="space-x-2 text-xs">
                  <button type="button" className="text-blue-600 hover:underline" onClick={() => void run(m.update.mutateAsync({ id: c.id, isActive: !c.isActive }), 'Atualizado.')}>{c.isActive ? 'Desativar' : 'Reativar'}</button>
                  <button type="button" className="text-red-600 hover:underline" onClick={() => { if (confirm(`Remover "${c.name}"?`)) void run(m.remove.mutateAsync(c.id), 'Removido.'); }}>Remover</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function LateChargesCard() {
  const { query, save } = useFinancialSettings();
  const [fine, setFine] = useState('');
  const [interest, setInterest] = useState('');
  useEffect(() => {
    if (query.data) { setFine(String(Number(query.data.finePct)).replace('.', ',')); setInterest(String(Number(query.data.interestMonthlyPct)).replace('.', ',')); }
  }, [query.data]);
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Multa e juros por atraso (padrão)</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} compact /> : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1"><Label>Multa (%)</Label><Input className="w-28" value={fine} onChange={(e) => setFine(e.target.value)} /></div>
              <div className="space-y-1"><Label>Juros ao mês (%)</Label><Input className="w-28" value={interest} onChange={(e) => setInterest(e.target.value)} /></div>
              <Button disabled={save.isPending || query.isLoading} onClick={() => void run(save.mutateAsync({ finePct: parseMoney(fine), interestMonthlyPct: parseMoney(interest) }), 'Padrões salvos.')}>Salvar</Button>
            </div>
            <p className="text-xs text-muted-foreground">Usados como sugestão ao dar baixa em conta atrasada e enviados ao Asaas nos boletos/PIX novos. Juros são pro rata dia.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RecurringCard() {
  const q = useRecurring();
  const m = useRecurringMutations();
  const [type, setType] = useState('PAYABLE');
  const cats = useCategories(type);
  const centers = useCostCenters();
  const [f, setF] = useState({ description: '', category: '', amount: '', dayOfMonth: '10', startDate: todayISO(), endDate: '', costCenterId: 'NONE' });
  const create = async () => {
    if (!f.description.trim() || !f.category) return toast.error('Informe descrição e categoria.');
    const ok = await run(m.create.mutateAsync({
      type, category: f.category, description: f.description, amount: parseMoney(f.amount), dayOfMonth: Number(f.dayOfMonth),
      startDate: f.startDate, ...(f.endDate && { endDate: f.endDate }), ...(f.costCenterId !== 'NONE' && { costCenterId: f.costCenterId }),
    }), 'Recorrência criada: os lançamentos dos meses já foram gerados.');
    if (ok) setF({ ...f, description: '', amount: '' });
  };
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Recorrências mensais</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid md:grid-cols-4 gap-2">
          <Select value={type} onValueChange={(v) => { setType(v); setF({ ...f, category: '' }); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="PAYABLE">Despesa</SelectItem><SelectItem value="RECEIVABLE">Receita</SelectItem></SelectContent>
          </Select>
          <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
            <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>{(cats.data ?? []).map((c) => <SelectItem key={c.id} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="md:col-span-2" placeholder="Descrição (ex.: Aluguel do escritório)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <Input placeholder="Valor (R$)" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground whitespace-nowrap">Dia</span>
            <Input type="number" min={1} max={28} value={f.dayOfMonth} onChange={(e) => setF({ ...f, dayOfMonth: e.target.value })} /></div>
          <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground">Início</span><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></div>
          <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground">Fim</span><Input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></div>
          <Select value={f.costCenterId} onValueChange={(v) => setF({ ...f, costCenterId: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="NONE">Sem centro de custo</SelectItem>{(centers.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button className="md:col-start-4" disabled={m.create.isPending} onClick={() => void create()}>Criar recorrência</Button>
        </div>
        <p className="text-xs text-muted-foreground">O sistema gera um lançamento por mês (todo dia às 6h, até o mês seguinte), sem duplicar. Mudanças valem para os próximos meses.</p>
        {q.isLoading ? <Skeleton className="h-12 w-full" /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} compact /> : q.data!.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma recorrência.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {q.data!.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5">
                <span className={r.isActive ? '' : 'text-muted-foreground'}>
                  <b>{r.description}</b> · {r.type === 'PAYABLE' ? 'despesa' : 'receita'} · {brl(r.amount)} todo dia {r.dayOfMonth}
                  {r.endDate ? ` até ${dmy(r.endDate)}` : ''} · {r.generated} lançamento(s) gerado(s){r.isActive ? '' : ' · pausada'}
                </span>
                <span className="space-x-2 text-xs">
                  <button type="button" className="text-blue-600 hover:underline" onClick={() => {
                    const v = window.prompt('Novo valor mensal (vale para os próximos meses):', String(Number(r.amount)).replace('.', ','));
                    if (v) void run(m.update.mutateAsync({ id: r.id, amount: parseMoney(v) }), 'Valor atualizado.');
                  }}>Alterar valor</button>
                  <button type="button" className="text-blue-600 hover:underline" onClick={() => void run(m.update.mutateAsync({ id: r.id, isActive: !r.isActive }), r.isActive ? 'Recorrência pausada.' : 'Recorrência retomada.')}>{r.isActive ? 'Pausar' : 'Retomar'}</button>
                  <button type="button" className="text-red-600 hover:underline" onClick={() => { if (confirm('Encerrar esta recorrência? Os lançamentos já gerados continuam.')) void run(m.remove.mutateAsync(r.id), 'Recorrência encerrada.'); }}>Encerrar</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function LegacySalesCard() {
  const q = useLegacySales();
  const reg = useRegularizeSale();
  const pending = (q.data ?? []).filter((s) => s.needsRegularization);
  const regularize = async (id: string, suggested?: number | null) => {
    const v = window.prompt('Comissão total da imobiliária nesta venda (R$):', suggested ? String(suggested).replace('.', ',') : '');
    if (!v) return;
    const due = window.prompt('Vencimento do recebimento (AAAA-MM-DD):', todayISO());
    if (!due) return;
    await run(reg.mutateAsync({ id, commissionAmount: parseMoney(v), installmentsCount: 1, firstDueDate: due }),
      'Comissão lançada em contas a receber. Abra o contrato para ajustar repasses aos corretores, se houver.');
  };
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Vendas antigas (antes do novo fluxo)</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-xs text-muted-foreground">
          Vendas ativadas pelo sistema antigo lançavam o valor do imóvel como &quot;a receber&quot;. Esses lançamentos em aberto foram cancelados
          automaticamente (com motivo). Aqui você lança a comissão correta das vendas que ainda não a têm no financeiro.
        </p>
        {q.isLoading ? <Skeleton className="h-12 w-full" /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} compact /> : pending.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma venda antiga pendente.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {pending.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5">
                <span>
                  <Link href={`/contracts/${s.id}`} className="font-medium hover:underline">{s.code ?? s.id.slice(0, 8)}</Link>
                  {s.propertyCode ? ` · imóvel ${s.propertyCode}` : ''} · venda {brl(s.saleValue)}
                  {s.suggestedCommission ? ` · comissão sugerida ${brl(s.suggestedCommission)}` : ''}
                  {s.cancelledPropertyValueEntries ? ` · ${s.cancelledPropertyValueEntries} lançamento(s) do valor do imóvel cancelado(s)` : ''}
                </span>
                <Button size="sm" variant="outline" disabled={reg.isPending} onClick={() => void regularize(s.id, s.suggestedCommission)}>Lançar comissão</Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function FinanceSettingsPanel() {
  return (
    <div className="space-y-4">
      <LegacySalesCard />
      <RecurringCard />
      <LateChargesCard />
      <CostCentersCard />
      <CategoriesCard />
    </div>
  );
}
