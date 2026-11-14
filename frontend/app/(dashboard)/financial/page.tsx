// Financeiro (Fase 5): contas a receber e a pagar com baixa parcial, juros,
// multa, desconto, estorno e comprovante; cobrança por boleto ou PIX; fluxo
// de caixa realizado x projetado; DRE por regime de caixa; configurações.
'use client';
import { getApiErrorMessage } from '@/lib/api-error';

import { Suspense, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ErrorState } from '@/components/common/error-state';
import { FinancialEntryForm } from '@/components/erp/financial-entry-form';
import { EntriesTable } from '@/components/finance/entries-table';
import { PaymentDialog } from '@/components/finance/payment-dialog';
import { IssueChargeDialog } from '@/components/finance/charge-panels';
import { EntryDetailSheet } from '@/components/finance/entry-detail';
import { CashFlowPanel, DrePanel } from '@/components/finance/reports-panels';
import { FinanceSettingsPanel } from '@/components/finance/settings-panels';
import {
  useFinancialSummary,
  useFinancialForecast,
  useOverdueEntries,
  useCommissions,
  fetchCommissionReceiptHtml,
  type FinancialEntry,
} from '@/hooks/use-financial';

type Entry = FinancialEntry & { openAmount?: number; isPartial?: boolean };

function formatCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0));
}

// Abre um HTML vindo da API numa aba nova (o endpoint exige autenticação,
// então não dá para linkar direto para a rota do backend)
function openHtmlInNewTab(html: string) {
  const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

const FINANCIAL_TABS = ['receivable', 'payable', 'overdue', 'commissions', 'cashflow', 'dre', 'settings'];

// A aba ativa vem do endereço (?tab=), para o menu abrir direto em
// "A Receber", "A Pagar", "Fluxo de Caixa" ou "DRE".
export default function FinancialPage() {
  return (
    <Suspense fallback={null}>
      <FinancialPageContent />
    </Suspense>
  );
}

function FinancialPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [commissionStatus, setCommissionStatus] = useState('ALL');
  const tabParam = searchParams.get('tab');
  const tab = tabParam && FINANCIAL_TABS.includes(tabParam) ? tabParam : 'receivable';
  const setTab = (t: string) => router.replace(`${pathname}?tab=${t}`, { scroll: false });
  // Tipo pré-selecionado do lançamento manual (null = modal fechado)
  const [newEntryType, setNewEntryType] = useState<'RECEIVABLE' | 'PAYABLE' | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [paying, setPaying] = useState<Entry | null>(null);
  const [charging, setCharging] = useState<Entry | null>(null);
  const [detail, setDetail] = useState<Entry | null>(null);

  const summary = useFinancialSummary();
  const { data: forecast } = useFinancialForecast();
  const overdue = useOverdueEntries();
  const commissions = useCommissions({ status: commissionStatus === 'ALL' ? undefined : commissionStatus });
  const commissionsData = commissions.data;
  const [receiptId, setReceiptId] = useState<string | null>(null);

  async function handleViewReceipt(id: string) {
    setReceiptId(id);
    try {
      openHtmlInNewTab(await fetchCommissionReceiptHtml(id));
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao gerar o recibo.'));
    } finally {
      setReceiptId(null);
    }
  }

  const s = summary.data;
  const kpis = [
    { label: 'A Receber (em aberto)', value: formatCurrency(s?.totalReceivable), icon: TrendingUp, color: 'text-blue-600' },
    { label: 'A Pagar (em aberto)', value: formatCurrency(s?.totalPayable), icon: TrendingDown, color: 'text-orange-600' },
    { label: 'Recebido no Mês', value: formatCurrency(s?.totalReceived), icon: DollarSign, color: 'text-green-600' },
    { label: 'Em Atraso', value: formatCurrency(s?.totalOverdue), icon: AlertTriangle, color: 'text-red-600', sub: s?.overdueCount ? `${s.overdueCount} lançamentos` : undefined },
  ];
  const openDetail = (e: Entry) => setDetail(e);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-muted-foreground text-sm">Contas a receber e a pagar, cobranças, fluxo de caixa e DRE</p>
        </div>
        <Button onClick={() => setNewEntryType(tab === 'payable' ? 'PAYABLE' : 'RECEIVABLE')}>
          <Plus className="w-4 h-4 mr-1.5" />
          Novo Lançamento
        </Button>
      </div>

      {/* KPIs */}
      {summary.isError ? (
        <Card><ErrorState error={summary.error} onRetry={() => summary.refetch()} title="Não foi possível carregar o resumo" compact /></Card>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-muted-foreground">{kpi.label}</CardTitle>
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                {summary.isLoading ? <Skeleton className="h-7 w-24" /> : <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>}
                {kpi.sub && <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Previsão */}
      {forecast && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Previsão de Recebimentos (saldo em aberto)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {([['Próx. 30 dias', forecast.next30Days], ['30–60 dias', forecast.next60Days], ['60–90 dias', forecast.next90Days]] as const).map(([l, v]) => (
                <div key={l} className="text-center">
                  <p className="text-muted-foreground">{l}</p>
                  <p className="font-bold text-lg">{formatCurrency(v.amount)}</p>
                  <p className="text-xs text-muted-foreground">{v.count} lançamentos</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="receivable">Contas a Receber</TabsTrigger>
          <TabsTrigger value="payable">Contas a Pagar</TabsTrigger>
          <TabsTrigger value="overdue">Em Atraso</TabsTrigger>
          <TabsTrigger value="commissions">Comissões</TabsTrigger>
          <TabsTrigger value="cashflow">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="dre">DRE</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="receivable" className="mt-4">
          <EntriesTable type="RECEIVABLE" onNew={() => setNewEntryType('RECEIVABLE')} onPay={setPaying} onCharge={setCharging} onOpen={openDetail} />
        </TabsContent>

        <TabsContent value="payable" className="mt-4">
          <EntriesTable type="PAYABLE" onNew={() => setNewEntryType('PAYABLE')} onPay={setPaying} onCharge={setCharging} onOpen={openDetail} />
        </TabsContent>

        {/* Em Atraso */}
        <TabsContent value="overdue" className="mt-4">
          {overdue.isLoading ? <Skeleton className="h-24 w-full" /> : overdue.isError ? (
            <Card><ErrorState error={overdue.error} onRetry={() => overdue.refetch()} /></Card>
          ) : !overdue.data || overdue.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum lançamento em atraso</p>
          ) : (
            <div className="space-y-2">
              {(overdue.data as Array<Entry & { daysOverdue: number }>).map((entry) => (
                <Card key={entry.id} className="border-red-100">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <button type="button" className="font-medium text-sm hover:underline" onClick={() => openDetail(entry)}>{entry.description}</button>
                      <p className="text-xs text-muted-foreground">
                        {entry.type === 'PAYABLE' ? 'A pagar' : 'A receber'} · venceu há {entry.daysOverdue} dia(s)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">{formatCurrency(Number(entry.amount) - Number(entry.paidAmount ?? 0))}</p>
                      <Button size="sm" variant="outline" className="mt-1" onClick={() => openDetail(entry)}>Detalhes</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Comissões */}
        <TabsContent value="commissions" className="mt-4 space-y-4">
          <Select value={commissionStatus} onValueChange={setCommissionStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="PENDING">Pendentes</SelectItem>
              {/* O fluxo grava RECEIVED; PAID fica para as comissões antigas */}
              <SelectItem value="RECEIVED">Recebidas</SelectItem>
              <SelectItem value="PAID">Pagas (antigas)</SelectItem>
            </SelectContent>
          </Select>

          {commissions.isLoading ? <Skeleton className="h-24 w-full" /> : commissions.isError ? (
            <Card><ErrorState error={commissions.error} onRetry={() => commissions.refetch()} /></Card>
          ) : commissionsData?.items?.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma comissão encontrada</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Imóvel</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Taxa</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Valor</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {commissionsData?.items?.map((c) => (
                    <tr key={c.id} className="border-t hover:bg-gray-50/50">
                      <td className="py-3 px-4 text-sm">
                        {c.contract?.property?.street ?? '-'}
                        <p className="text-xs text-muted-foreground">{c.contract?.type}</p>
                      </td>
                      <td className="py-3 px-4 text-sm">{c.rate}%</td>
                      <td className="py-3 px-4 text-sm font-semibold">{formatCurrency(c.amount)}</td>
                      <td className="py-3 px-4">
                        {/* RECEIVED é o status atual do fluxo; PAID fica por compatibilidade */}
                        <Badge variant={c.status === 'RECEIVED' || c.status === 'PAID' ? 'default' : 'secondary'}>
                          {c.status === 'RECEIVED' || c.status === 'PAID' ? 'Recebida' : 'Pendente'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {/* Registrar recebimento fica na tela de Comissões, que
                            pede valor e forma de pagamento. Aqui é só consulta. */}
                        {(c.status === 'RECEIVED' || c.status === 'PAID') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={receiptId === c.id}
                            onClick={() => void handleViewReceipt(c.id)}
                          >
                            {receiptId === c.id ? 'Gerando...' : 'Ver recibo'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="cashflow" className="mt-4"><CashFlowPanel /></TabsContent>
        <TabsContent value="dre" className="mt-4"><DrePanel /></TabsContent>
        <TabsContent value="settings" className="mt-4"><FinanceSettingsPanel /></TabsContent>
      </Tabs>

      {/* Novo lançamento / edição */}
      <Dialog open={newEntryType !== null || editing !== null} onOpenChange={(open) => { if (!open) { setNewEntryType(null); setEditing(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar lançamento' : 'Novo Lançamento'}</DialogTitle>
          </DialogHeader>
          {(newEntryType || editing) && (
            <FinancialEntryForm
              key={editing?.id ?? newEntryType ?? ''}
              defaultType={newEntryType ?? undefined}
              entry={editing}
              onCancel={() => { setNewEntryType(null); setEditing(null); }}
              onSuccess={(type) => {
                setNewEntryType(null);
                setEditing(null);
                setTab(type === 'PAYABLE' ? 'payable' : 'receivable');
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <PaymentDialog entry={paying} onClose={() => setPaying(null)} />
      <IssueChargeDialog entry={charging} onClose={() => setCharging(null)} />
      <EntryDetailSheet
        entry={detail}
        onClose={() => setDetail(null)}
        onPay={(e) => { setDetail(null); setPaying(e); }}
        onCharge={(e) => { setDetail(null); setCharging(e); }}
        onEdit={(e) => { setDetail(null); setEditing(e); }}
      />
    </div>
  );
}
