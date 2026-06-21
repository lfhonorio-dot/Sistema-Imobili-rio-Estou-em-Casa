'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateContract, useGenerateInstallments } from '@/hooks/use-contracts';
import { useProperties } from '@/hooks/use-properties';
import { useContacts } from '@/hooks/use-contacts';

export default function NewContractPage() {
  const router = useRouter();
  const createContract = useCreateContract();
  const generateInstallments = useGenerateInstallments();

  const { data: propertiesData } = useProperties({ limit: 200, status: 'AVAILABLE' });
  const { data: contactsData } = useContacts({ limit: 200 });

  const properties = propertiesData?.items ?? [];
  const contacts = contactsData?.items ?? [];

  const [form, setForm] = useState({
    type: '',
    propertyId: '',
    ownerId: '',
    tenantId: '',
    startDate: '',
    endDate: '',
    rentalValue: '',
    saleValue: '',
    dueDay: '',
    commissionRate: '',
    notes: '',
  });
  const [generateMonths, setGenerateMonths] = useState('12');

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const isRental = form.type === 'RENTAL_RESIDENTIAL' || form.type === 'RENTAL_COMMERCIAL';
  const isSale = form.type === 'SALE';

  async function handleSubmit() {
    if (!form.type || !form.propertyId) {
      toast.error('Tipo e imóvel são obrigatórios.');
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        type: form.type,
        propertyId: form.propertyId,
        ownerId: form.ownerId || undefined,
        tenantId: form.tenantId || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        rentalValue: form.rentalValue ? parseFloat(form.rentalValue) : undefined,
        saleValue: form.saleValue ? parseFloat(form.saleValue) : undefined,
        dueDay: form.dueDay ? parseInt(form.dueDay) : undefined,
        commissionRate: form.commissionRate ? parseFloat(form.commissionRate) : undefined,
        notes: form.notes || undefined,
      };

      const contract = await createContract.mutateAsync(payload as any);

      // Para locação: gera parcelas automaticamente
      if (isRental && parseInt(generateMonths) > 0) {
        try {
          const result = await generateInstallments.mutateAsync({
            id: contract.id,
            months: parseInt(generateMonths),
          });
          toast.success(`Contrato criado! ${result.created} parcelas geradas.`);
        } catch {
          toast.success('Contrato criado! Gere as parcelas manualmente no detalhe do contrato.');
        }
      } else {
        toast.success('Contrato criado com sucesso!');
      }

      router.push(`/contracts/${contract.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao criar contrato.';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar
        </Button>
        <h1 className="text-2xl font-bold">Novo Contrato</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Dados do Contrato</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Tipo */}
          <div className="space-y-1.5">
            <Label>Tipo de Contrato *</Label>
            <Select value={form.type} onValueChange={(v) => setField('type', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="RENTAL_RESIDENTIAL">Locação Residencial</SelectItem>
                <SelectItem value="RENTAL_COMMERCIAL">Locação Comercial</SelectItem>
                <SelectItem value="SALE">Compra e Venda</SelectItem>
                <SelectItem value="BROKERAGE">Intermediação</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Imóvel */}
          <div className="space-y-1.5">
            <Label>Imóvel *</Label>
            <Select value={form.propertyId} onValueChange={(v) => setField('propertyId', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione o imóvel..." /></SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.code} — {p.street ? `${p.street}${p.number ? `, ${p.number}` : ''}` : 'Endereço não informado'} ({p.city})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Proprietário */}
          <div className="space-y-1.5">
            <Label>Proprietário</Label>
            <Select value={form.ownerId} onValueChange={(v) => setField('ownerId', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione o proprietário..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Locatário / Comprador */}
          {(isRental || isSale) && (
            <div className="space-y-1.5">
              <Label>{isRental ? 'Locatário' : 'Comprador'}</Label>
              <Select value={form.tenantId} onValueChange={(v) => setField('tenantId', v)}>
                <SelectTrigger><SelectValue placeholder={`Selecione o ${isRental ? 'locatário' : 'comprador'}...`} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Data de Início</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setField('startDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Data de Encerramento</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setField('endDate', e.target.value)} />
            </div>
          </div>

          {/* Valores */}
          {isRental && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Valor do Aluguel (R$)</Label>
                <Input type="number" placeholder="0.00" value={form.rentalValue} onChange={(e) => setField('rentalValue', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Dia do Vencimento</Label>
                <Input type="number" min={1} max={31} placeholder="10" value={form.dueDay} onChange={(e) => setField('dueDay', e.target.value)} />
              </div>
            </div>
          )}

          {isSale && (
            <div className="space-y-1.5">
              <Label>Valor de Venda (R$)</Label>
              <Input type="number" placeholder="0.00" value={form.saleValue} onChange={(e) => setField('saleValue', e.target.value)} />
            </div>
          )}

          {/* Comissão */}
          <div className="space-y-1.5">
            <Label>Taxa de Comissão (%)</Label>
            <Input type="number" min={0} max={100} step={0.1} placeholder="5.0" value={form.commissionRate} onChange={(e) => setField('commissionRate', e.target.value)} />
          </div>

          {/* Gerar parcelas automáticas (só para locação) */}
          {isRental && (
            <div className="space-y-1.5">
              <Label>Gerar Parcelas Automaticamente</Label>
              <Select value={generateMonths} onValueChange={setGenerateMonths}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Não gerar agora</SelectItem>
                  <SelectItem value="3">3 meses</SelectItem>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                  <SelectItem value="24">24 meses</SelectItem>
                  <SelectItem value="36">36 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={3} placeholder="Observações sobre o contrato..." value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={createContract.isPending || generateInstallments.isPending}>
          {createContract.isPending ? 'Criando...' : 'Criar Contrato'}
        </Button>
      </div>
    </div>
  );
}
