// Dashboard Financeiro - DRE, lançamentos, comissões
'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, Copy, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FinancialEntryRow } from '@/components/erp/financial-entry-row';
import { useBilling } from '@/hooks/use-billing';
import {
  useFinancialSummary,
  useFinancialEntries,
  useFinancialForecast,
  useOverdueEntries,
  useCommissions,
  usePayEntry,
} from '@/hooks/use-financial';

interface BoletoResult {
  linhaDigitavel: string;
  codigoBarras: string;
  pixCopiaECola?: string;
  amount: number;
  dueDate: string;
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0));
}

export default function FinancialPage() {
  const [receivablePage, setReceivablePage] = useState(1);
  const [payablePage, setPayablePage] = useState(1);
  const [commissionStatus, setCommissionStatus] = useState('ALL');

  const { data: summary } = useFinancialSummary();
  const { data: forecast } = useFinancialForecast();
  const { data: overdueData } = useOverdueEntries();
  const { data: receivables, isLoading: loadingReceivable } = useFinancialEntries({
    type: 'RECEIVABLE',
    page: receivablePage,
    limit: 20,
  });
  const { data: payables, isLoading: loadingPayable } = useFinancialEntries({
    type: 'PAYABLE',
    page: payablePage,
    limit: 20,
  });
  const { data: commissionsData } = useCommissions({ status: commissionStatus === 'ALL' ? undefined : commissionStatus });
  const payEntry = usePayEntry();
  const { generateBoleto } = useBilling();
  const [boletoResult, setBoletoResult] = useState<BoletoResult | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  async function handleGenerateBoleto(financialEntryId: string) {
    setGeneratingId(financialEntryId);
    try {
      const boleto = await generateBoleto({ financialEntryId });
      setBoletoResult(boleto);
      toast.success('Boleto gerado com sucesso!');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao gerar boleto.';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setGeneratingId(null);
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  }

  const kpis = [
    {
      label: 'A Receber',
      value: formatCurrency(summary?.totalReceivable),
      icon: TrendingUp,
      color: 'text-blue-600',
    },
    {
      label: 'A Pagar',
      value: formatCurrency(summary?.totalPayable),
      icon: TrendingDown,
      color: 'text-orange-600',
    },
    {
      label: 'Recebido no Mês',
      value: formatCurrency(summary?.totalReceived),
      icon: DollarSign,
      color: 'text-green-600',
    },
    {
      label: 'Em Atraso',
      value: formatCurrency(summary?.totalOverdue),
      icon: AlertTriangle,
      color: 'text-red-600',
      sub: summary?.overdueCount ? `${summary.overdueCount} lançamentos` : undefined,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <p className="text-muted-foreground text-sm">Gestão financeira da imobiliária</p>
      </div>

      {/* KPIs */}
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
              <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
              {kpi.sub && <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Previsão */}
      {forecast && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Previsão de Recebimentos</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <p className="text-muted-foreground">Próx. 30 dias</p>
                <p className="font-bold text-lg">{formatCurrency(forecast.next30Days.amount)}</p>
                <p className="text-xs text-muted-foreground">{forecast.next30Days.count} lançamentos</p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground">30–60 dias</p>
                <p className="font-bold text-lg">{formatCurrency(forecast.next60Days.amount)}</p>
                <p className="text-xs text-muted-foreground">{forecast.next60Days.count} lançamentos</p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground">60–90 dias</p>
                <p className="font-bold text-lg">{formatCurrency(forecast.next90Days.amount)}</p>
                <p className="text-xs text-muted-foreground">{forecast.next90Days.count} lançamentos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs principais */}
      <Tabs defaultValue="receivable">
        <TabsList>
          <TabsTrigger value="receivable">Contas a Receber</TabsTrigger>
          <TabsTrigger value="payable">Contas a Pagar</TabsTrigger>
          <TabsTrigger value="overdue">Em Atraso</TabsTrigger>
          <TabsTrigger value="commissions">Comissões</TabsTrigger>
        </TabsList>

        {/* Contas a Receber */}
        <TabsContent value="receivable" className="mt-4">
          {loadingReceivable ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : receivables?.items.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma conta a receber</p>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Descrição</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Vencimento</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Valor</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="py-3 px-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {receivables?.items.map((entry) => (
                      <FinancialEntryRow
                        key={entry.id}
                        entry={entry}
                        onPay={(id) => payEntry.mutate({ id })}
                        onGenerateBoleto={handleGenerateBoleto}
                        generatingBoleto={generatingId === entry.id}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              {receivables && receivables.meta.pages > 1 && (
                <div className="flex justify-between items-center mt-4">
                  <p className="text-sm text-muted-foreground">Página {receivablePage} de {receivables.meta.pages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={receivablePage === 1} onClick={() => setReceivablePage((p) => p - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={receivablePage >= receivables.meta.pages} onClick={() => setReceivablePage((p) => p + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Contas a Pagar */}
        <TabsContent value="payable" className="mt-4">
          {loadingPayable ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : payables?.items.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma conta a pagar</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Descrição</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Vencimento</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Valor</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {payables?.items.map((entry) => (
                    <FinancialEntryRow key={entry.id} entry={entry} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Em Atraso */}
        <TabsContent value="overdue" className="mt-4">
          {!overdueData || overdueData.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum lançamento em atraso</p>
          ) : (
            <div className="space-y-2">
              {overdueData.map((entry) => (
                <Card key={entry.id} className="border-red-100">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{entry.description}</p>
                      <p className="text-xs text-muted-foreground">
                        Venceu {entry.daysOverdue} dias atrás
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">
                        {formatCurrency(Number(entry.amount))}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-1"
                        onClick={() => payEntry.mutate({ id: entry.id })}
                      >
                        Receber
                      </Button>
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
              <SelectItem value="PAID">Pagas</SelectItem>
            </SelectContent>
          </Select>

          {commissionsData?.items?.length === 0 ? (
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
                        <Badge variant={c.status === 'PAID' ? 'default' : 'secondary'}>
                          {c.status === 'PAID' ? 'Pago' : 'Pendente'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal de resultado do boleto */}
      {boletoResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setBoletoResult(null)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Boleto Gerado</h3>
              <button onClick={() => setBoletoResult(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between rounded-lg bg-gray-50 p-3 text-sm">
                <span className="text-gray-500">Valor</span>
                <span className="font-semibold">{formatCurrency(Number(boletoResult.amount))}</span>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-gray-500">Linha Digitável</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded-lg bg-gray-100 p-2 text-xs">{boletoResult.linhaDigitavel}</code>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(boletoResult.linhaDigitavel, 'Linha digitável')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {boletoResult.pixCopiaECola && (
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-500">PIX Copia e Cola</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 break-all rounded-lg bg-gray-100 p-2 text-xs">{boletoResult.pixCopiaECola}</code>
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(boletoResult.pixCopiaECola!, 'PIX')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <p className="text-center text-xs text-gray-400">
                Boleto em modo simulado. Configure um gateway (EFÍ/ASAAS) no Railway para emissão bancária real.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
