'use client';

// Fase 3 — formulário de proposta / contraproposta.

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error';
import { PAYMENT_METHODS, brl, parseMoney } from '@/lib/funnel';
import { funnelApi, useFunnelMutation, type Proposal } from '@/hooks/use-funnel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { nativeSelect } from './visit-forms';

const in7days = () => new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

export function ProposalForm({
  dealId, properties, counterOf, onDone, onCancel,
}: {
  dealId: string;
  properties: Array<{ id: string; code: string }>;
  /** quando informado, registra uma contraproposta a esta proposta */
  counterOf?: Proposal;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const [f, setF] = useState({
    propertyId: counterOf?.propertyId ?? (properties.length === 1 ? properties[0].id : ''),
    amount: '',
    paymentMethod: counterOf?.paymentMethod ?? 'CASH',
    downPayment: '',
    financedAmount: '',
    fgtsAmount: '',
    exchangeDescription: '',
    conditions: '',
    validUntil: in7days(),
  });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useFunnelMutation(funnelApi.createProposal);
  const counter = useFunnelMutation(funnelApi.counterProposal);
  const busy = create.isPending || counter.isPending;

  const showParts = ['FINANCING', 'FGTS', 'MIXED'].includes(f.paymentMethod);
  const amount = parseMoney(f.amount);
  const parts = (parseMoney(f.downPayment) ?? 0) + (parseMoney(f.financedAmount) ?? 0) + (parseMoney(f.fgtsAmount) ?? 0);

  const submit = async () => {
    if (!amount) return toast.error('Informe o valor da proposta.');
    if (!counterOf && !f.propertyId) return toast.error('Escolha o imóvel.');
    const terms = {
      amount,
      paymentMethod: f.paymentMethod,
      downPayment: parseMoney(f.downPayment),
      financedAmount: parseMoney(f.financedAmount),
      fgtsAmount: parseMoney(f.fgtsAmount),
      exchangeDescription: f.exchangeDescription || undefined,
      conditions: f.conditions || undefined,
      validUntil: f.validUntil,
    };
    try {
      const r = counterOf
        ? await counter.mutateAsync({ id: counterOf.id, ...terms })
        : await create.mutateAsync({ dealId, propertyId: f.propertyId, ...terms });
      toast.success(
        `${counterOf ? 'Contraproposta' : 'Proposta'} registrada${r.dealMovedTo ? `. Negócio movido para "${r.dealMovedTo}"` : ''}.`,
      );
      onDone?.();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Não foi possível registrar a proposta.'));
    }
  };

  return (
    <div className="space-y-3">
      {counterOf ? (
        <p className="text-sm text-muted-foreground">
          Respondendo à {counterOf.kind === 'OFFER' ? 'proposta do comprador' : 'contraproposta do vendedor'} de {brl(counterOf.amount)}.
        </p>
      ) : (
        <div className="space-y-1">
          <Label>Imóvel *</Label>
          <select className={nativeSelect} value={f.propertyId} onChange={(e) => set('propertyId', e.target.value)}>
            <option value="">Selecione…</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
          </select>
          {properties.length === 0 && (
            <p className="text-xs text-amber-700">Vincule o imóvel ao negócio (quadro &quot;Imóveis de interesse&quot;) antes da proposta.</p>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Valor (R$) *</Label>
          <Input inputMode="decimal" value={f.amount} onChange={(e) => set('amount', e.target.value)} placeholder="380.000,00" />
        </div>
        <div className="space-y-1">
          <Label>Validade *</Label>
          <Input type="date" value={f.validUntil} onChange={(e) => set('validUntil', e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Forma de pagamento *</Label>
        <select className={nativeSelect} value={f.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)}>
          {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {showParts && (
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1"><Label className="text-xs">Entrada</Label>
            <Input inputMode="decimal" value={f.downPayment} onChange={(e) => set('downPayment', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Financiado</Label>
            <Input inputMode="decimal" value={f.financedAmount} onChange={(e) => set('financedAmount', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">FGTS</Label>
            <Input inputMode="decimal" value={f.fgtsAmount} onChange={(e) => set('fgtsAmount', e.target.value)} /></div>
          {amount ? (
            <p className={`col-span-3 text-xs ${Math.round(parts * 100) > Math.round(amount * 100) ? 'text-red-600' : 'text-muted-foreground'}`}>
              Soma das partes: {brl(parts)} de {brl(amount)}
            </p>
          ) : null}
        </div>
      )}
      {f.paymentMethod === 'PERMUTA' && (
        <div className="space-y-1">
          <Label>Bem dado em permuta *</Label>
          <Input value={f.exchangeDescription} onChange={(e) => set('exchangeDescription', e.target.value)} placeholder="Ex.: apartamento no Centro avaliado em R$ 200 mil" />
        </div>
      )}
      <div className="space-y-1">
        <Label>Condições</Label>
        <Textarea rows={3} value={f.conditions} onChange={(e) => set('conditions', e.target.value)} placeholder="Prazos, sinal, quem paga o ITBI, data de entrega das chaves…" />
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancelar</Button>}
        <Button onClick={submit} disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {counterOf ? 'Registrar contraproposta' : 'Registrar proposta'}
        </Button>
      </div>
    </div>
  );
}
