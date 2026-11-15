'use client';

// Relatórios (Fase 7): 8 relatórios de venda, com período e exportação
// para Excel e PDF. Substitui a tela antiga de "analytics", que não
// diferenciava erro de lista vazia.

import { Suspense, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/error-state';
import { getApiErrorMessage } from '@/lib/api-error';
import { downloadReport, formatCell, useSalesReport } from '@/hooks/use-team';

const REPORTS: Array<{ key: string; label: string; period?: boolean; days?: { label: string; def: number } }> = [
  { key: 'vgv', label: 'VGV vendido', period: true },
  { key: 'funnel', label: 'Conversão do funil', period: true },
  { key: 'sales-time', label: 'Tempo médio de venda', period: true },
  { key: 'lead-sources', label: 'Origem dos leads', period: true },
  { key: 'broker-ranking', label: 'Ranking de corretores', period: true },
  { key: 'commissions', label: 'Comissões a receber e a pagar' },
  { key: 'idle-properties', label: 'Imóveis sem movimento', days: { label: 'Parados há mais de (dias)', def: 60 } },
  { key: 'authorizations', label: 'Autorizações a vencer', days: { label: 'Vencendo em até (dias)', def: 30 } },
];

export default function ReportsPage() {
  return <Suspense fallback={null}><ReportsContent /></Suspense>;
}

function ReportsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const key = REPORTS.some((r) => r.key === sp.get('r')) ? sp.get('r')! : 'vgv';
  const def = REPORTS.find((r) => r.key === key)!;
  const year = new Date().getFullYear();
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState<number | ''>('');
  const params = { ...(def.period && { from, to }), ...(def.days && { days: days || def.days.def }) };
  const q = useSalesReport(key, params);
  const [busy, setBusy] = useState<string | null>(null);

  const exp = async (format: 'xlsx' | 'pdf') => {
    setBusy(format);
    try { await downloadReport(key, format, params); } catch (e) { toast.error(getApiErrorMessage(e, 'Não foi possível gerar o arquivo.')); } finally { setBusy(null); }
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Indicadores de venda, comissões e carteira de imóveis.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <Button key={r.key} size="sm" variant={r.key === key ? 'default' : 'outline'} onClick={() => { setDays(''); router.replace(`${pathname}?r=${r.key}`, { scroll: false }); }}>{r.label}</Button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {def.period && (<>
          <div className="space-y-1"><Label className="text-xs">De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </>)}
        {def.days && (
          <div className="space-y-1"><Label className="text-xs">{def.days.label}</Label>
            <Input type="number" className="w-32" min={1} value={days === '' ? def.days.def : days} onChange={(e) => setDays(e.target.value ? Number(e.target.value) : '')} /></div>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" disabled={!!busy || !q.data} onClick={() => void exp('xlsx')}><Download className="h-4 w-4 mr-1" />{busy === 'xlsx' ? 'Gerando...' : 'Excel'}</Button>
          <Button variant="outline" disabled={!!busy || !q.data} onClick={() => void exp('pdf')}><FileText className="h-4 w-4 mr-1" />{busy === 'pdf' ? 'Gerando...' : 'PDF'}</Button>
        </div>
      </div>

      {q.isLoading ? <Skeleton className="h-64 w-full" /> : q.isError ? <Card><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card> : q.data && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <h2 className="text-lg font-semibold">{q.data.title}</h2>
              {q.data.subtitle && <p className="text-sm text-muted-foreground">{q.data.subtitle}</p>}
            </div>
            {!!q.data.summary?.length && (
              <div className="flex flex-wrap gap-3">
                {q.data.summary.map((s) => (
                  <div key={s.label} className="rounded-md border px-3 py-2 text-sm">
                    <p className="text-muted-foreground text-xs">{s.label}</p>
                    <p className="font-semibold">{s.type ? formatCell(s.value, s.type) : s.value ?? '—'}</p>
                  </div>
                ))}
              </div>
            )}
            {q.data.rows.length === 0 ? <p className="py-6 text-sm text-muted-foreground">Nenhum registro {def.period ? 'no período' : ''}.</p> : (
              <div className="overflow-x-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-muted-foreground"><tr>
                    {q.data.columns.map((c) => <th key={c.key} className={`px-3 py-2 font-medium ${c.type === 'text' ? 'text-left' : 'text-right'}`}>{c.label}</th>)}
                  </tr></thead>
                  <tbody className="divide-y">
                    {q.data.rows.map((r, i) => (
                      <tr key={i}>{q.data!.columns.map((c) => <td key={c.key} className={`px-3 py-1.5 ${c.type === 'text' ? '' : 'text-right whitespace-nowrap'}`}>{formatCell(r[c.key], c.type)}</td>)}</tr>
                    ))}
                    {q.data.totals && (
                      <tr className="bg-gray-50 font-semibold">{q.data.columns.map((c, i) => <td key={c.key} className={`px-3 py-1.5 ${c.type === 'text' ? '' : 'text-right whitespace-nowrap'}`}>{i === 0 ? 'Total' : q.data!.totals![c.key] !== undefined ? formatCell(q.data!.totals![c.key], c.type) : ''}</td>)}</tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {q.data.notes?.map((n) => <p key={n} className="text-xs text-muted-foreground">{n}</p>)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
