// Tela de Comissões — listagem, resumo e marcação de recebimento
'use client';

import { useMemo, useState } from 'react';
import { Percent, TrendingUp, Clock, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCommissions, useReceiveCommission, type CommissionItem } from '@/hooks/use-financial';

function brl(v: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v ?? 0));
}

const PAYMENT_METHODS = ['PIX', 'TED', 'DINHEIRO', 'CHEQUE'];

export default function CommissionsPage() {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const { data, isLoading } = useCommissions({ status: statusFilter === 'ALL' ? undefined : statusFilter });
  const receive = useReceiveCommission();

  const items = data?.items ?? [];

  const [modal, setModal] = useState<CommissionItem | null>(null);
  const [receivedValue, setReceivedValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('PIX');

  const totals = useMemo(() => {
    let pending = 0;
    let received = 0;
    for (const c of items) {
      if (c.status === 'RECEIVED' || c.status === 'PAID') received += Number(c.receivedValue ?? c.amount);
      else pending += Number(c.amount);
    }
    return { pending, received };
  }, [items]);

  function openModal(c: CommissionItem) {
    setModal(c);
    setReceivedValue(String(c.amount));
    setPaymentMethod('PIX');
  }

  async function confirmReceive() {
    if (!modal) return;
    try {
      await receive.mutateAsync({
        id: modal.id,
        receivedValue: parseFloat(receivedValue.replace(/\./g, '').replace(',', '.')) || undefined,
        paymentMethod,
      });
      toast.success('Comissão recebida e lançada no financeiro!');
      setModal(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao receber comissão.';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Percent className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold">Comissões</h1>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendente</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{brl(totals.pending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recebido</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{brl(totals.received)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtro */}
      <div className="flex items-center gap-3">
        <Label className="text-sm">Status:</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas</SelectItem>
            <SelectItem value="PENDING">Pendentes</SelectItem>
            <SelectItem value="RECEIVED">Recebidas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhuma comissão encontrada.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Imóvel / Contrato</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Taxa</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Valor</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const isReceived = c.status === 'RECEIVED' || c.status === 'PAID';
                const prop = c.contract?.property;
                return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50/50">
                    <td className="py-3 px-4 text-sm">
                      {prop?.code ? <span className="font-medium">{prop.code}</span> : '—'}
                      {prop?.street ? <span className="text-muted-foreground"> · {prop.street}</span> : ''}
                    </td>
                    <td className="py-3 px-4 text-sm">{Number(c.rate)}%</td>
                    <td className="py-3 px-4 text-sm font-semibold">
                      {brl(isReceived ? c.receivedValue ?? c.amount : c.amount)}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={isReceived ? 'default' : 'secondary'}>
                        {isReceived ? 'Recebida' : 'Pendente'}
                      </Badge>
                      {isReceived && c.paymentMethod && (
                        <span className="ml-2 text-xs text-muted-foreground">{c.paymentMethod}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {!isReceived && (
                        <Button size="sm" variant="outline" onClick={() => openModal(c)}>
                          Marcar como Recebida
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de recebimento */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Receber Comissão</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                Valor previsto: <strong>{brl(modal.amount)}</strong>
              </div>

              <div className="space-y-1.5">
                <Label>Valor Recebido (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={receivedValue}
                  onChange={(e) => setReceivedValue(e.target.value)}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Forma de Pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
                <Button onClick={confirmReceive} disabled={receive.isPending}>
                  {receive.isPending ? 'Registrando...' : 'Confirmar Recebimento'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
