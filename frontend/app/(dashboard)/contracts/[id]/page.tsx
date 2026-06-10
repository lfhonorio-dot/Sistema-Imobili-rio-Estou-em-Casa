// Página de detalhe do contrato
'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useContract } from '@/hooks/use-contracts';
import { FinancialEntryRow } from '@/components/erp/financial-entry-row';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TYPE_LABELS: Record<string, string> = {
  SALE: 'Venda', RENTAL_RESIDENTIAL: 'Locação Residencial',
  RENTAL_COMMERCIAL: 'Locação Comercial', BROKERAGE: 'Intermediação',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho', ACTIVE: 'Ativo', TERMINATED: 'Encerrado', RESCINDED: 'Rescindido',
};

function formatCurrency(value: number | null | undefined) {
  if (!value) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
}

function formatDate(d: string | null | undefined) {
  if (!d) return '-';
  return format(new Date(d), 'dd/MM/yyyy', { locale: ptBR });
}

export default function ContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: contract, isLoading } = useContract(id);

  if (isLoading) return <div className="p-6 text-muted-foreground">Carregando...</div>;
  if (!contract) return <div className="p-6">Contrato não encontrado</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Contrato</h1>
            <Badge variant="secondary">{TYPE_LABELS[contract.type] ?? contract.type}</Badge>
            <Badge>{STATUS_LABELS[contract.status] ?? contract.status}</Badge>
          </div>
          {contract.property && (
            <p className="text-sm text-muted-foreground">
              {contract.property.street}, {contract.property.number} — {contract.property.city}
            </p>
          )}
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="financial">Financeiro</TabsTrigger>
          <TabsTrigger value="commissions">Comissões</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Partes</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Proprietário: </span>{contract.owner?.name ?? '-'}</div>
                <div><span className="text-muted-foreground">Inquilino/Comprador: </span>{contract.tenant?.name ?? '-'}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Datas</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Início: </span>{formatDate(contract.startDate)}</div>
                <div><span className="text-muted-foreground">Fim: </span>{formatDate(contract.endDate)}</div>
                <div><span className="text-muted-foreground">Assinatura: </span>{formatDate(contract.signedAt)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Valores</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {contract.rentalValue && (
                  <div><span className="text-muted-foreground">Aluguel: </span>{formatCurrency(contract.rentalValue)}/mês</div>
                )}
                {contract.saleValue && (
                  <div><span className="text-muted-foreground">Valor de Venda: </span>{formatCurrency(contract.saleValue)}</div>
                )}
                {contract.dueDay && (
                  <div><span className="text-muted-foreground">Vencimento: </span>Dia {contract.dueDay}</div>
                )}
                {contract.commissionRate && (
                  <div><span className="text-muted-foreground">Comissão: </span>{contract.commissionRate}%</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="financial" className="mt-4">
          {(contract as any).financialEntries?.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum lançamento financeiro</p>
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
                  {(contract as any).financialEntries?.map((entry: any) => (
                    <FinancialEntryRow key={entry.id} entry={entry} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="commissions" className="mt-4">
          {(contract as any).commissions?.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma comissão</p>
          ) : (
            <div className="space-y-2">
              {(contract as any).commissions?.map((c: any) => (
                <Card key={c.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {formatCurrency(c.amount)} ({c.rate}%)
                      </p>
                      <p className="text-xs text-muted-foreground">Usuário: {c.userId}</p>
                    </div>
                    <Badge variant={c.status === 'PAID' ? 'default' : 'secondary'}>
                      {c.status === 'PAID' ? 'Pago' : 'Pendente'}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
