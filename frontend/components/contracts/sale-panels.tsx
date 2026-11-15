'use client';

// Fase 4 — ações do contrato de venda: ativar (com prévia das contas),
// rescindir, análise de pagamento em espécie e checklist de pós-venda.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Loader2, Plus } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error';
import { brl, parseMoney, PAYMENT_METHODS } from '@/lib/funnel';
import {
  useActivateSale, useCashReview, useChecklist, useChecklistMutation, useRescindSale, useSalePreview,
  type ActivateSaleInput, type ChecklistItem,
} from '@/hooks/use-sale';
import { useMembers, nativeSelect } from '@/components/funnel/visit-forms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/error-state';

const date = (v?: string | null) => (v ? new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—');
const in30 = () => new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

interface SaleContract {
  id: string;
  code?: string | null;
  status: string;
  saleValue?: unknown;
  commissionRate?: unknown;
  paymentMethod?: string | null;
  owner?: { id: string; name: string } | null;
  tenant?: { id: string; name: string } | null;
  cashInvolved?: boolean;
  cashAmount?: unknown;
  cashReviewStatus?: string | null;
  cashReviewNote?: string | null;
  cashReviewedAt?: string | null;
  rescindedAt?: string | null;
  rescissionReason?: string | null;
  activatedAt?: string | null;
  commissionAmount?: unknown;
}

// ── Ativar venda ─────────────────────────────────────────────────────────

export function ActivateSaleDialog({ contract, open, onOpenChange }: { contract: SaleContract; open: boolean; onOpenChange: (o: boolean) => void }) {
  const members = useMembers();
  const preview = useSalePreview(contract.id);
  const activate = useActivateSale(contract.id);
  const defaultCommission = contract.saleValue != null && contract.commissionRate != null
    ? (Number(contract.saleValue) * Number(contract.commissionRate)) / 100 : null;

  const [f, setF] = useState({
    commission: defaultCommission != null ? defaultCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
    payer: contract.owner?.id ?? '',
    count: '1',
    firstDueDate: in30(),
    sellerBrokerId: '',
    sellerBrokerPct: '',
    captorBrokerId: '',
    captorBrokerPct: '',
    paymentMethod: contract.paymentMethod ?? 'CASH',
    cashInvolved: false,
    cashAmount: '',
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  const input = (): ActivateSaleInput => ({
    commissionAmount: parseMoney(f.commission),
    commissionPayerId: f.payer || undefined,
    installmentsCount: Number(f.count) || 1,
    firstDueDate: f.firstDueDate,
    sellerBrokerId: f.sellerBrokerId || undefined,
    sellerBrokerPct: f.sellerBrokerPct ? Number(f.sellerBrokerPct.replace(',', '.')) : undefined,
    captorBrokerId: f.captorBrokerId || undefined,
    captorBrokerPct: f.captorBrokerPct ? Number(f.captorBrokerPct.replace(',', '.')) : undefined,
    paymentMethod: f.paymentMethod,
    cashInvolved: f.cashInvolved,
    cashAmount: f.cashInvolved ? parseMoney(f.cashAmount) : undefined,
  });

  // primeira prévia ao abrir: traz o captador sugerido pela autorização
  useEffect(() => {
    if (!open) return;
    preview.mutateAsync(input())
      .then((p) => { if (p.suggestedCaptorId && !f.captorBrokerId) set('captorBrokerId', p.suggestedCaptorId); })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const runPreview = () => preview.mutate(input());

  const submit = async () => {
    if (!confirm('Ativar a venda? O imóvel será marcado como vendido e as contas a receber e a pagar serão geradas.')) return;
    try {
      const r = await activate.mutateAsync(input());
      toast.success(`Venda ativada: ${r.receivables} conta(s) a receber e ${r.payables} a pagar geradas.`);
      for (const w of r.warnings) toast.warning(w);
      onOpenChange(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Não foi possível ativar a venda.'));
    }
  };

  const p = preview.data;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Ativar venda {contract.code ?? ''}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div className="space-y-1"><Label>Comissão total da imobiliária (R$)</Label>
            <Input inputMode="decimal" value={f.commission} onChange={(e) => set('commission', e.target.value)} />
            {defaultCommission != null && <p className="text-xs text-muted-foreground">Pela taxa do contrato: {brl(defaultCommission)}</p>}
          </div>
          <div className="space-y-1"><Label>Quem paga a comissão</Label>
            <select className={nativeSelect} value={f.payer} onChange={(e) => set('payer', e.target.value)}>
              {contract.owner && <option value={contract.owner.id}>Vendedor — {contract.owner.name}</option>}
              {contract.tenant && <option value={contract.tenant.id}>Comprador — {contract.tenant.name}</option>}
            </select>
          </div>
          <div className="space-y-1"><Label>Parcelas da comissão</Label>
            <Input type="number" min={1} max={60} value={f.count} onChange={(e) => set('count', e.target.value)} /></div>
          <div className="space-y-1"><Label>1º vencimento</Label>
            <Input type="date" value={f.firstDueDate} onChange={(e) => set('firstDueDate', e.target.value)} /></div>

          <div className="space-y-1"><Label>Corretor vendedor</Label>
            <select className={nativeSelect} value={f.sellerBrokerId} onChange={(e) => set('sellerBrokerId', e.target.value)}>
              <option value="">— nenhum —</option>
              {(members.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.user.name}</option>)}
            </select></div>
          <div className="space-y-1"><Label>% da comissão para o vendedor</Label>
            <Input inputMode="decimal" value={f.sellerBrokerPct} onChange={(e) => set('sellerBrokerPct', e.target.value)} placeholder="30" /></div>
          <div className="space-y-1"><Label>Corretor captador</Label>
            <select className={nativeSelect} value={f.captorBrokerId} onChange={(e) => set('captorBrokerId', e.target.value)}>
              <option value="">— nenhum —</option>
              {(members.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.user.name}</option>)}
            </select></div>
          <div className="space-y-1"><Label>% da comissão para o captador</Label>
            <Input inputMode="decimal" value={f.captorBrokerPct} onChange={(e) => set('captorBrokerPct', e.target.value)} placeholder="10" /></div>
          {members.isError && <p className="sm:col-span-2 text-xs text-red-600">Lista de corretores indisponível: {getApiErrorMessage(members.error)}</p>}

          <div className="space-y-1"><Label>Forma de pagamento da compra</Label>
            <select className={nativeSelect} value={f.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)}>
              {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div className="space-y-1">
            <label className="flex items-center gap-2 mt-6">
              <input type="checkbox" checked={f.cashInvolved} onChange={(e) => set('cashInvolved', e.target.checked)} />
              Há pagamento em espécie (dinheiro vivo)
            </label>
            {f.cashInvolved && (
              <Input inputMode="decimal" placeholder="Valor em espécie (R$)" value={f.cashAmount} onChange={(e) => set('cashAmount', e.target.value)} />
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Os corretores parceiros cadastrados no contrato entram automaticamente com o percentual deles.</p>

        <div className="flex justify-end">
          <Button variant="outline" onClick={runPreview} disabled={preview.isPending}>
            {preview.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Atualizar prévia
          </Button>
        </div>

        {preview.isError ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{getApiErrorMessage(preview.error)}</div>
        ) : p ? (
          <div className="space-y-3 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <Card><CardContent className="p-3">
                <p className="font-medium mb-1">A receber (comissão) — pago por {p.payer.name}</p>
                {p.receivables.map((r) => (
                  <div key={r.installment} className="flex justify-between"><span>Parcela {r.installment}/{r.totalInstallments} · {date(r.dueDate)}</span><span>{brl(r.amount)}</span></div>
                ))}
                <div className="flex justify-between font-medium border-t mt-1 pt-1"><span>Total</span><span>{brl(p.commissionTotal)}</span></div>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <p className="font-medium mb-1">A pagar (comissões dos corretores)</p>
                {p.perBeneficiary.length === 0 && <p className="text-muted-foreground">Nenhum repasse.</p>}
                {p.perBeneficiary.map((b) => (
                  <div key={b.label} className="flex justify-between"><span>{b.label.charAt(0).toUpperCase() + b.label.slice(1)} ({Number(b.pct.toFixed(2))}%)</span><span>{brl(b.amount)}</span></div>
                ))}
                <div className="flex justify-between font-medium border-t mt-1 pt-1"><span>Fica para a imobiliária</span><span>{brl(p.agencyNet)}</span></div>
                {p.receivables.length > 1 && <p className="text-xs text-muted-foreground mt-1">Cada repasse é dividido na mesma proporção das parcelas.</p>}
              </CardContent></Card>
            </div>
            {p.warnings.length > 0 && (
              <ul className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-amber-900 list-disc pl-8">
                {p.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            )}
          </div>
        ) : preview.isPending ? <Skeleton className="h-24 w-full" /> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={activate.isPending || preview.isError}>
            {activate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Ativar venda
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Rescindir ────────────────────────────────────────────────────────────

export function RescindSaleDialog({ contract, open, onOpenChange }: { contract: SaleContract; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [reason, setReason] = useState('');
  const rescind = useRescindSale(contract.id);
  const submit = async () => {
    if (!reason.trim()) return toast.error('Informe o motivo da rescisão.');
    try {
      const r = await rescind.mutateAsync(reason.trim());
      toast.success(`Venda rescindida: ${r.cancelled} lançamento(s) cancelado(s) e ${r.reversals} estorno(s) gerado(s).`);
      for (const w of r.warnings) toast.warning(w, { duration: 10000 });
      onOpenChange(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Não foi possível rescindir.'));
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Rescindir venda {contract.code ?? ''}</DialogTitle></DialogHeader>
        <div className="space-y-2 text-sm">
          <p>O que acontece:</p>
          <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
            <li>contas a receber e a pagar ainda em aberto são <strong>canceladas</strong> (ficam no histórico com o motivo);</li>
            <li>o que já foi pago ganha um lançamento de <strong>estorno</strong> pendente, para você decidir se há devolução;</li>
            <li>o imóvel volta a ficar <strong>disponível</strong>;</li>
            <li>a venda sai da DIMOB e o checklist de pós-venda é encerrado.</li>
          </ul>
          <Label>Motivo da rescisão *</Label>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: financiamento negado ao comprador" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button variant="destructive" onClick={submit} disabled={rescind.isPending || !reason.trim()}>
            {rescind.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Rescindir venda
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Avisos do contrato de venda ──────────────────────────────────────────

export function SaleBanners({ contract, onActivate }: { contract: SaleContract; onActivate: () => void }) {
  const review = useCashReview(contract.id);
  const doReview = async () => {
    const note = prompt('Conclusão da análise do pagamento em espécie (ex.: origem comprovada; comunicação ao COAF feita em dd/mm):');
    if (!note?.trim()) return;
    try {
      await review.mutateAsync(note.trim());
      toast.success('Análise do pagamento em espécie registrada');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };
  return (
    <div className="space-y-2">
      {contract.status === 'DRAFT' && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 flex flex-wrap items-center justify-between gap-2">
          <span>Venda em rascunho: nenhum lançamento foi feito ainda. Ao ativar, o imóvel vira vendido e as comissões a receber e a pagar são geradas.</span>
          <Button size="sm" onClick={onActivate}>Ativar venda</Button>
        </div>
      )}
      {contract.cashInvolved && contract.cashReviewStatus === 'PENDING_REVIEW' && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />
            Pagamento em espécie de {brl(contract.cashAmount)} aguardando análise do responsável
            {Number(contract.cashAmount) >= 100000 ? ' (a partir de R$ 100 mil: avaliar comunicação ao COAF)' : ''}.
          </span>
          <Button size="sm" variant="outline" onClick={doReview} disabled={review.isPending}>Registrar análise</Button>
        </div>
      )}
      {contract.cashInvolved && contract.cashReviewStatus === 'REVIEWED' && (
        <div className="rounded-md border px-4 py-2 text-xs text-muted-foreground">
          Pagamento em espécie de {brl(contract.cashAmount)} analisado em {date(contract.cashReviewedAt)}: {contract.cashReviewNote}
        </div>
      )}
      {contract.status === 'RESCINDED' && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Venda rescindida em {date(contract.rescindedAt)}{contract.rescissionReason ? ` — ${contract.rescissionReason}` : ''}.
          Veja na aba Financeiro os lançamentos cancelados e os estornos pendentes.
        </div>
      )}
    </div>
  );
}

// ── Checklist de pós-venda ───────────────────────────────────────────────

const ITEM_STATUS: Record<ChecklistItem['status'], { label: string; className: string }> = {
  PENDING: { label: 'Pendente', className: 'bg-blue-100 text-blue-700' },
  DONE: { label: 'Concluído', className: 'bg-green-100 text-green-700' },
  NOT_APPLICABLE: { label: 'Não se aplica', className: 'bg-gray-100 text-gray-600' },
  CANCELLED: { label: 'Cancelado', className: 'bg-gray-100 text-gray-500' },
};

export function PostSaleChecklist({ contractId, active }: { contractId: string; active: boolean }) {
  const list = useChecklist(contractId, true);
  const members = useMembers();
  const { update, add } = useChecklistMutation(contractId);
  const [newTitle, setNewTitle] = useState('');
  const [newDue, setNewDue] = useState('');

  const change = async (itemId: string, body: Record<string, unknown>, okMsg?: string) => {
    try {
      await update.mutateAsync({ itemId, ...body });
      if (okMsg) toast.success(okMsg);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  if (list.isLoading) return <Skeleton className="h-40 w-full" />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;
  const items = list.data ?? [];
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">O checklist de pós-venda é criado quando a venda é ativada.</p>;
  }
  const done = items.filter((i) => i.status === 'DONE' || i.status === 'NOT_APPLICABLE').length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Pós-venda — {done} de {items.length} concluídos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {items.map((i) => (
          <div key={i.id} className={`rounded-md border p-3 ${i.overdue ? 'border-red-300 bg-red-50' : ''}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {i.status === 'DONE' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                <span className={i.status === 'DONE' || i.status === 'CANCELLED' ? 'line-through text-muted-foreground' : 'font-medium'}>{i.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${ITEM_STATUS[i.status].className}`}>{ITEM_STATUS[i.status].label}</span>
                {i.overdue && <span className="text-xs text-red-700 font-medium">atrasado</span>}
              </div>
              {active && i.status !== 'CANCELLED' && (
                <div className="flex gap-1">
                  {i.status !== 'DONE' && <Button size="sm" onClick={() => change(i.id, { status: 'DONE' }, 'Item concluído')}>Concluir</Button>}
                  {i.status === 'PENDING' && <Button size="sm" variant="ghost" onClick={() => change(i.id, { status: 'NOT_APPLICABLE' })}>Não se aplica</Button>}
                  {i.status !== 'PENDING' && <Button size="sm" variant="ghost" onClick={() => change(i.id, { status: 'PENDING' })}>Reabrir</Button>}
                </div>
              )}
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3 items-center text-xs">
              <label className="flex items-center gap-1">Responsável:
                <select className={nativeSelect + ' h-7 text-xs'} value={i.responsibleId ?? ''} disabled={!active || i.status === 'CANCELLED'}
                  onChange={(e) => change(i.id, { responsibleId: e.target.value || null })}>
                  <option value="">—</option>
                  {(members.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.user.name}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1">Prazo:
                <Input type="date" className="h-7 text-xs" defaultValue={i.dueDate?.slice(0, 10) ?? ''} disabled={!active || i.status === 'CANCELLED'}
                  onBlur={(e) => { if (e.target.value !== (i.dueDate?.slice(0, 10) ?? '')) void change(i.id, { dueDate: e.target.value || null }); }} />
              </label>
              <span className="text-muted-foreground">{i.status === 'DONE' && i.doneAt ? `Concluído em ${new Date(i.doneAt).toLocaleDateString('pt-BR')}${i.doneByName ? ` por ${i.doneByName}` : ''}` : ''}</span>
            </div>
            {i.notes && <p className="mt-1 text-xs text-muted-foreground">{i.notes}</p>}
          </div>
        ))}
        {active && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Input className="flex-1 min-w-48" placeholder="Novo item (ex.: quitar condomínio atrasado)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            <Input type="date" className="w-40" value={newDue} onChange={(e) => setNewDue(e.target.value)} />
            <Button size="sm" variant="outline" disabled={!newTitle.trim() || add.isPending}
              onClick={() => add.mutateAsync({ title: newTitle.trim(), dueDate: newDue || undefined })
                .then(() => { toast.success('Item adicionado'); setNewTitle(''); setNewDue(''); })
                .catch((err) => toast.error(getApiErrorMessage(err)))}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
