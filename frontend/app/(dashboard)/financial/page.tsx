// Dashboard Financeiro - DRE, lançamentos, comissões
'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FinancialEntryRow } from '@/components/erp/financial-entry-row';
import {
  useFinancialSummary,
  useFinancialEntries,
  useFinancialForecast,
  useOverdueEntries,
  useCommissions,
  usePayEntry,
} from '@/hooks/use-financial';

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0));
}

export default function FinancialPage() {
  const [receivablePage, setReceivablePage] = useState(1);
  const [payablePage, setPayablePage] = useState(1);
  const [commissionStatus, setCommissionStatus] = useState('');

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
  const { data: commissionsData } = useCommissions({ status: commissionStatus || undefined });
  const payEntry = usePayEntry();

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
              <SelectItem value="">Todos</SelectItem>
              <SelectItem value="PENDING">Pendentes</SelectItem>
              <SelectItem value="PAID">Pagas</SelectItem>
            </SelectContent>
          </Select>

          {(commissionsData as any)?.items?.length === 0 ? (
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
                  {(commissionsData as any)?.items?.map((c: any) => (
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
    </div>
  );
}
