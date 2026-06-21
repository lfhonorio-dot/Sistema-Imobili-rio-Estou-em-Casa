// Página de detalhe do contrato
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useContract, useChangeContractStatus, useGenerateInstallments } from '@/hooks/use-contracts';
import { usePayEntry } from '@/hooks/use-financial';
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
  const changeStatus = useChangeContractStatus();
  const generateInstallments = useGenerateInstallments();
  const payEntry = usePayEntry();

  const [newStatus, setNewStatus] = useState('');
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showInstallmentsDialog, setShowInstallmentsDialog] = useState(false);
  const [months, setMonths] = useState('12');

  async function handleChangeStatus() {
    if (!newStatus) return;
    await changeStatus.mutateAsync({ id, status: newStatus });
    toast.success('Status atualizado!');
    setShowStatusDialog(false);
    setNewStatus('');
  }

  async function handleGenerateInstallments() {
    const result = await generateInstallments.mutateAsync({ id, months: parseInt(months) });
    toast.success(`${result.created} parcelas geradas com sucesso!`);
    setShowInstallmentsDialog(false);
  }

  if (isLoading) return <div className="p-6 text-muted-foreground">Carregando...</div>;
  if (!contract) return <div className="p-6">Contrato não encontrado</div>;

  const isRental = contract.type === 'RENTAL_RESIDENTIAL' || contract.type === 'RENTAL_COMMERCIAL';
  const financialEntries = (contract as any).financialEntries ?? [];
  const commissions = (contract as any).commissions ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
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

        <div className="flex gap-2">
          {/* Alterar Status */}
          <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">Alterar Status</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Alterar Status do Contrato</DialogTitle></DialogHeader>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue placeholder="Novo status..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Rascunho</SelectItem>
                  <SelectItem value="ACTIVE">Ativo</SelectItem>
                  <SelectItem value="TERMINATED">Encerrado</SelectItem>
                  <SelectItem value="RESCINDED">Rescindido</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2 justify-end mt-2">
                <Button variant="outline" onClick={() => setShowStatusDialog(false)}>Cancelar</Button>
                <Button onClick={handleChangeStatus} disabled={!newStatus || changeStatus.isPending}>
                  {changeStatus.isPending ? 'Salvando...' : 'Confirmar'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Gerar Parcelas (só para locação) */}
          {isRental && (
            <Dialog open={showInstallmentsDialog} onOpenChange={setShowInstallmentsDialog}>
              <DialogTrigger asChild>
                <Button size="sm">Gerar Parcelas</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Gerar Parcelas de Aluguel</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Quantidade de meses</Label>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={months}
                      onChange={(e) => setMonths(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Serão geradas {months} parcelas de {formatCurrency(contract.rentalValue)} cada.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setShowInstallmentsDialog(false)}>Cancelar</Button>
                    <Button onClick={handleGenerateInstallments} disabled={generateInstallments.isPending}>
                      {generateInstallments.isPending ? 'Gerando...' : 'Gerar'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="financial">Financeiro {financialEntries.length > 0 && `(${financialEntries.length})`}</TabsTrigger>
          <TabsTrigger value="commissions">Comissões</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Partes</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Proprietário: </span>{contract.owner?.name ?? '-'}</div>
                <div><span className="text-muted-foreground">{isRental ? 'Inquilino' : 'Comprador'}: </span>{contract.tenant?.name ?? '-'}</div>
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
                  <div><span className="text-muted-foreground">Aluguel: </span><strong>{formatCurrency(contract.rentalValue)}/mês</strong></div>
                )}
                {contract.saleValue && (
                  <div><span className="text-muted-foreground">Valor de Venda: </span><strong>{formatCurrency(contract.saleValue)}</strong></div>
                )}
                {contract.dueDay && (
                  <div><span className="text-muted-foreground">Vencimento: </span>Dia {contract.dueDay}</div>
                )}
                {contract.commissionRate && (
                  <div><span className="text-muted-foreground">Comissão: </span>{contract.commissionRate}%</div>
                )}
              </CardContent>
            </Card>
            {contract.notes && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Observações</CardTitle></CardHeader>
                <CardContent className="text-sm">{contract.notes}</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="financial" className="mt-4">
          {financialEntries.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm mb-3">Nenhum lançamento financeiro</p>
              {isRental && (
                <Button size="sm" onClick={() => setShowInstallmentsDialog(true)}>
                  Gerar Parcelas de Aluguel
                </Button>
              )}
            </div>
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
                  {financialEntries.map((entry: any) => (
                    <FinancialEntryRow
                      key={entry.id}
                      entry={entry}
                      onPay={(entryId) => payEntry.mutate({ id: entryId })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="commissions" className="mt-4">
          {commissions.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma comissão registrada</p>
          ) : (
            <div className="space-y-2">
              {commissions.map((c: any) => (
                <Card key={c.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{formatCurrency(c.amount)} ({c.rate}%)</p>
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
