'use client';

// Fase 5 — registrar recebimento/pagamento (baixa): total ou parcial, com
// multa, juros, desconto, data, forma, conta bancária e comprovante.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getApiErrorMessage } from '@/lib/api-error';
import type { FinancialEntry } from '@/hooks/use-financial';
import {
  brl, METHOD_LABELS, parseMoney, todayISO, uploadReceipt, useBankAccounts, usePaymentSuggestion, useRegisterPayment,
} from '@/hooks/use-finance';

const NONE = 'NONE';
const fmt = (n: number) => (n ? n.toFixed(2).replace('.', ',') : '');

export function PaymentDialog({ entry, onClose }: { entry: (FinancialEntry & { openAmount?: number }) | null; onClose: () => void }) {
  const [paidAt, setPaidAt] = useState(todayISO());
  const suggestion = usePaymentSuggestion(entry?.id, paidAt);
  const accounts = useBankAccounts();
  const register = useRegisterPayment();
  const [f, setF] = useState({ principal: '', fine: '', interest: '', discount: '', method: 'PIX', bankAccountId: NONE, notes: '' });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const open = suggestion.data?.openAmount ?? entry?.openAmount ?? 0;
  useEffect(() => {
    if (!suggestion.data) return;
    setF((p) => ({ ...p, principal: fmt(suggestion.data.openAmount), fine: fmt(suggestion.data.fine), interest: fmt(suggestion.data.interest) }));
  }, [suggestion.data]);
  useEffect(() => {
    const def = accounts.data?.find((a) => a.isDefault);
    if (def) setF((p) => (p.bankAccountId === NONE ? { ...p, bankAccountId: def.id } : p));
  }, [accounts.data]);
  useEffect(() => { if (!entry) { setFile(null); setPaidAt(todayISO()); } }, [entry]);

  if (!entry) return null;
  const isPay = entry.type === 'PAYABLE';
  const principal = parseMoney(f.principal);
  const total = principal + (parseMoney(f.fine) || 0) + (parseMoney(f.interest) || 0) - (parseMoney(f.discount) || 0);
  const partial = principal > 0 && principal < open - 0.004;

  const submit = async () => {
    if (!(principal > 0)) return toast.error('Informe o valor a baixar.');
    if ([f.fine, f.interest, f.discount].some((v) => v && Number.isNaN(parseMoney(v)))) return toast.error('Confira multa, juros e desconto.');
    setSaving(true);
    try {
      let receiptFileId: string | undefined;
      if (file) receiptFileId = (await uploadReceipt(file)).id;
      await register.mutateAsync({
        entryId: entry.id, principal,
        fine: parseMoney(f.fine) || 0, interest: parseMoney(f.interest) || 0, discount: parseMoney(f.discount) || 0,
        paidAt: `${paidAt}T12:00:00`, method: f.method,
        bankAccountId: f.bankAccountId === NONE ? undefined : f.bankAccountId,
        receiptFileId, notes: f.notes || undefined,
      });
      toast.success(partial ? 'Baixa parcial registrada.' : isPay ? 'Pagamento registrado.' : 'Recebimento registrado.');
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!entry} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{isPay ? 'Registrar pagamento' : 'Registrar recebimento'}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-md bg-gray-50 p-3">
            <p className="font-medium">{entry.description}</p>
            <p className="text-muted-foreground">Saldo em aberto: <b>{brl(open)}</b>
              {suggestion.data?.daysLate ? <span className="text-red-600"> · {suggestion.data.daysLate} dia(s) de atraso</span> : null}</p>
          </div>
          {suggestion.isError && <p className="text-xs text-red-600">{getApiErrorMessage(suggestion.error)}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Data do {isPay ? 'pagamento' : 'recebimento'}</Label>
              <Input type="date" value={paidAt} max={todayISO()} onChange={(e) => setPaidAt(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="pay-principal">Valor a baixar (R$)</Label>
              <Input id="pay-principal" inputMode="decimal" value={f.principal} onChange={(e) => setF({ ...f, principal: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="pay-fine">Multa (R$)</Label>
              <Input id="pay-fine" inputMode="decimal" value={f.fine} onChange={(e) => setF({ ...f, fine: e.target.value })} placeholder="0,00" /></div>
            <div className="space-y-1"><Label htmlFor="pay-interest">Juros (R$)</Label>
              <Input id="pay-interest" inputMode="decimal" value={f.interest} onChange={(e) => setF({ ...f, interest: e.target.value })} placeholder="0,00" /></div>
            <div className="space-y-1"><Label htmlFor="pay-discount">Desconto (R$)</Label>
              <Input id="pay-discount" inputMode="decimal" value={f.discount} onChange={(e) => setF({ ...f, discount: e.target.value })} placeholder="0,00" /></div>
            <div className="space-y-1"><Label>Forma</Label>
              <Select value={f.method} onValueChange={(v) => setF({ ...f, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(METHOD_LABELS).filter(([k]) => k !== 'BOLETO').map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>
          <div className="space-y-1"><Label>Conta bancária</Label>
            <Select value={f.bankAccountId} onValueChange={(v) => setF({ ...f, bankAccountId: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Não informar</SelectItem>
                {(accounts.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {accounts.isError && <p className="text-xs text-red-600">Contas bancárias: {getApiErrorMessage(accounts.error)}</p>}
          </div>
          <div className="space-y-1"><Label>Comprovante (PDF ou imagem, opcional)</Label>
            <Input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
          <div className="space-y-1"><Label>Observação</Label>
            <Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <div className="rounded-md border p-3 flex justify-between">
            <span>{isPay ? 'Total pago' : 'Total recebido'}{partial && <span className="ml-2 text-amber-700">(baixa parcial — sobra {brl(open - principal)})</span>}</span>
            <b>{Number.isFinite(total) ? brl(total) : '—'}</b>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Voltar</Button>
            <Button onClick={() => void submit()} disabled={saving}>{saving ? 'Salvando...' : 'Confirmar baixa'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
