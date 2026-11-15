'use client';

// Fase 5 — fluxo de caixa (realizado x projetado, diário/mensal, por conta,
// com saldo inicial) e DRE gerencial por regime de caixa; exportação Excel.

import { useState } from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ErrorState } from '@/components/common/error-state';
import { getApiErrorMessage } from '@/lib/api-error';
import { brl, downloadXlsx, useBankAccounts, useCashFlow5, useDre } from '@/hooks/use-finance';

const ALL = 'ALL';
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const neg = (v: number) => (v < 0 ? 'text-red-700' : 'text-emerald-700');
const periodLabel = (p: string) => (p.length === 7
  ? new Date(`${p}-01T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' })
  : new Date(`${p}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' }));

export function CashFlowPanel() {
  const year = new Date().getFullYear();
  const [g, setG] = useState<'day' | 'month'>('month');
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(`${year}-12-31`);
  const [acc, setAcc] = useState(ALL);
  const accounts = useBankAccounts();
  const params = { granularity: g, from, to, ...(acc !== ALL && { bankAccountId: acc }) };
  const q = useCashFlow5(params);
  const [exporting, setExporting] = useState(false);

  const changeG = (v: 'day' | 'month') => {
    setG(v);
    const now = new Date();
    if (v === 'day') {
      setFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
      setTo(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10));
    } else { setFrom(`${year}-01-01`); setTo(`${year}-12-31`); }
  };
  const doExport = async () => {
    setExporting(true);
    try { await downloadXlsx('/financial/cash-flow/export', params, `fluxo-de-caixa-${from}-a-${to}.xlsx`); }
    catch (err) { toast.error(getApiErrorMessage(err, 'Não foi possível gerar a planilha.')); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1"><Label className="text-xs">Visão</Label>
          <Select value={g} onValueChange={(v) => changeG(v as 'day' | 'month')}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="month">Mensal</SelectItem><SelectItem value="day">Diária</SelectItem></SelectContent>
          </Select></div>
        <div className="space-y-1"><Label className="text-xs">De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Conta bancária</Label>
          <Select value={acc} onValueChange={setAcc}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as contas</SelectItem>
              {(accounts.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select></div>
        <Button variant="outline" className="ml-auto" disabled={exporting || !q.data} onClick={() => void doExport()}>
          <Download className="h-4 w-4 mr-1" />{exporting ? 'Gerando...' : 'Exportar Excel'}
        </Button>
      </div>

      {q.isLoading ? <Skeleton className="h-48 w-full" /> : q.isError ? (
        <div className="border rounded-lg"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>
      ) : q.data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="rounded-md border p-3"><p className="text-muted-foreground">Saldo inicial</p><b>{brl(q.data.openingBalance)}</b></div>
            <div className="rounded-md border p-3"><p className="text-muted-foreground">Entradas realizadas</p><b className="text-emerald-700">{brl(q.data.totals.realizedIn)}</b></div>
            <div className="rounded-md border p-3"><p className="text-muted-foreground">Saídas realizadas</p><b className="text-red-700">{brl(q.data.totals.realizedOut)}</b></div>
            <div className="rounded-md border p-3"><p className="text-muted-foreground">Saldo final realizado / projetado</p>
              <b className={neg(q.data.totals.closingRealized)}>{brl(q.data.totals.closingRealized)}</b> / <b className={neg(q.data.totals.closingProjected)}>{brl(q.data.totals.closingProjected)}</b></div>
          </div>
          {!q.data.projectionIncluded && (
            <p className="text-xs text-muted-foreground">Filtrando por conta, o fluxo mostra só o realizado nela: contas em aberto ainda não têm conta bancária definida.</p>
          )}
          {(accounts.data ?? []).length === 0 && !accounts.isLoading && (
            <p className="text-xs text-muted-foreground">Dica: cadastre suas contas com o saldo inicial em Financeiro → Bancário para o saldo ficar correto.</p>
          )}
          <div className="border rounded-lg overflow-x-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-muted-foreground sticky top-0">
                <tr>
                  <th className="text-left py-2 px-3 font-medium">{g === 'day' ? 'Dia' : 'Mês'}</th>
                  <th className="text-right py-2 px-3 font-medium">Entradas realizadas</th>
                  <th className="text-right py-2 px-3 font-medium">Saídas realizadas</th>
                  <th className="text-right py-2 px-3 font-medium">Saldo realizado</th>
                  <th className="text-right py-2 px-3 font-medium">Entradas projetadas</th>
                  <th className="text-right py-2 px-3 font-medium">Saídas projetadas</th>
                  <th className="text-right py-2 px-3 font-medium">Saldo projetado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {q.data.rows.map((r) => (
                  <tr key={r.period}>
                    <td className="py-1.5 px-3">{periodLabel(r.period)}</td>
                    <td className="py-1.5 px-3 text-right text-emerald-700">{brl(r.realizedIn)}</td>
                    <td className="py-1.5 px-3 text-right text-red-700">{brl(r.realizedOut)}</td>
                    <td className={`py-1.5 px-3 text-right font-semibold ${neg(r.realizedBalance)}`}>{brl(r.realizedBalance)}</td>
                    <td className="py-1.5 px-3 text-right text-muted-foreground">{brl(r.projectedIn)}</td>
                    <td className="py-1.5 px-3 text-right text-muted-foreground">{brl(r.projectedOut)}</td>
                    <td className={`py-1.5 px-3 text-right font-semibold ${neg(r.projectedBalance)}`}>{brl(r.projectedBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Realizado = baixas efetivas (dinheiro que entrou/saiu). Projetado = realizado + contas em aberto no vencimento (as vencidas aparecem em hoje).</p>
        </>
      )}
    </div>
  );
}

export function DrePanel() {
  const [year, setYear] = useState(new Date().getFullYear());
  const q = useDre(year);
  const [exporting, setExporting] = useState(false);
  const doExport = async () => {
    setExporting(true);
    try { await downloadXlsx('/financial/dre/export', { year }, `dre-${year}.xlsx`); }
    catch (err) { toast.error(getApiErrorMessage(err, 'Não foi possível gerar a planilha.')); }
    finally { setExporting(false); }
  };
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  const Row = ({ name, values, total, bold, cls }: { name: string; values: number[]; total: number; bold?: boolean; cls?: string }) => (
    <tr className={bold ? 'font-semibold bg-gray-50' : ''}>
      <td className="py-1.5 px-3 whitespace-nowrap">{name}</td>
      {values.map((v, i) => <td key={i} className={`py-1.5 px-2 text-right whitespace-nowrap ${cls ?? ''}`}>{v ? brl(v) : '—'}</td>)}
      <td className={`py-1.5 px-3 text-right whitespace-nowrap font-semibold ${cls ?? ''}`}>{brl(total)}</td>
    </tr>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="space-y-1"><Label className="text-xs">Ano</Label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select></div>
        <Button variant="outline" className="ml-auto" disabled={exporting || !q.data} onClick={() => void doExport()}>
          <Download className="h-4 w-4 mr-1" />{exporting ? 'Gerando...' : 'Exportar Excel'}
        </Button>
      </div>
      {q.isLoading ? <Skeleton className="h-48 w-full" /> : q.isError ? (
        <div className="border rounded-lg"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>
      ) : q.data && (
        q.data.revenue.length + q.data.expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">Nenhum recebimento ou pagamento baixado em {year}.</p>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-muted-foreground">
                <tr><th className="text-left py-2 px-3">Categoria</th>{MONTHS.map((m) => <th key={m} className="text-right py-2 px-2">{m}</th>)}<th className="text-right py-2 px-3">Total</th></tr>
              </thead>
              <tbody className="divide-y">
                <tr><td colSpan={14} className="py-1.5 px-3 font-semibold text-emerald-800">Receitas</td></tr>
                {q.data.revenue.map((l) => <Row key={l.category} name={l.name} values={l.months} total={l.total} />)}
                <Row name="Total de receitas" values={q.data.totalRevenue} total={q.data.totals.revenue} bold cls="text-emerald-700" />
                <tr><td colSpan={14} className="py-1.5 px-3 font-semibold text-red-800">Despesas</td></tr>
                {q.data.expenses.map((l) => <Row key={l.category} name={l.name} values={l.months} total={l.total} />)}
                <Row name="Total de despesas" values={q.data.totalExpenses} total={q.data.totals.expenses} bold cls="text-red-700" />
                <Row name="Resultado" values={q.data.result} total={q.data.totals.result} bold />
              </tbody>
            </table>
          </div>
        )
      )}
      <p className="text-xs text-muted-foreground">DRE gerencial por regime de caixa: considera o que foi efetivamente recebido e pago em cada mês (com juros, multa e descontos), por categoria. Não substitui a contabilidade oficial.</p>
    </div>
  );
}
