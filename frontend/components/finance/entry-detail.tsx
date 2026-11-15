'use client';

// Fase 5 — detalhe de uma conta: baixas (com estorno e comprovante),
// cobranças (boleto/PIX) e cancelamento com motivo.

import { toast } from 'sonner';
import { Paperclip, Undo2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/error-state';
import { getApiErrorMessage } from '@/lib/api-error';
import { apiFileUrl } from '@/lib/api';
import type { FinancialEntry } from '@/hooks/use-financial';
import {
  brl, dmy, METHOD_LABELS, SOURCE_LABELS, useAttachReceipt, useEntry, useCancelEntry, useCharges, useEntryPayments, useReversePayment,
} from '@/hooks/use-finance';
import { ChargeCard } from './charge-panels';
import { NFSE_STATUS_STYLE, useNfseList } from '@/hooks/use-nfse';

type Entry = FinancialEntry & { openAmount?: number; isPartial?: boolean };

export function EntryDetailSheet({ entry: initial, onClose, onPay, onCharge, onEdit, onIssueNfse }: {
  entry: Entry | null; onClose: () => void;
  onPay: (e: Entry) => void; onCharge: (e: Entry) => void; onEdit: (e: Entry) => void;
  onIssueNfse?: (e: Entry) => void;
}) {
  const fresh = useEntry(initial?.id);
  // dados atualizados depois de baixa/estorno/cobrança (cai no da lista enquanto carrega)
  const entry: Entry | null = initial ? { ...initial, ...(fresh.data ?? {}) } : null;
  const payments = useEntryPayments(entry?.id);
  const charges = useCharges({ entryId: entry?.id, limit: 50 }, !!entry && entry.type === 'RECEIVABLE');
  const nfse = useNfseList({ entryId: initial?.id, limit: 10 }, !!initial && initial.type === 'RECEIVABLE');
  const reverse = useReversePayment();
  const attach = useAttachReceipt();
  const cancel = useCancelEntry();
  if (!entry) return null;
  const open = ['PENDING', 'OVERDUE'].includes(entry.status);
  const hasActiveCharge = (charges.data?.items ?? []).some((c) => ['PENDING', 'REGISTERED', 'SENT', 'OVERDUE'].includes(c.status));

  const doReverse = async (paymentId: string) => {
    const reason = window.prompt('Motivo do estorno desta baixa:');
    if (!reason?.trim()) return;
    try {
      await reverse.mutateAsync({ paymentId, reason });
      toast.success('Baixa estornada: a conta voltou a ficar em aberto.');
    } catch (err) { toast.error(getApiErrorMessage(err)); }
  };
  const doAttach = async (paymentId: string, file?: File) => {
    if (!file) return;
    try {
      await attach.mutateAsync({ paymentId, file });
      toast.success('Comprovante anexado.');
    } catch (err) { toast.error(getApiErrorMessage(err)); }
  };
  const doCancel = async () => {
    const reason = window.prompt(hasActiveCharge
      ? 'Motivo do cancelamento (a cobrança em aberto será cancelada também no Asaas):'
      : 'Motivo do cancelamento da conta:');
    if (!reason?.trim()) return;
    try {
      await cancel.mutateAsync({ id: entry.id, reason });
      toast.success('Conta cancelada.');
      onClose();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
  };

  return (
    <Sheet open={!!entry} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader><SheetTitle>{entry.description}</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-5 text-sm">
          <div className="grid grid-cols-2 gap-2 rounded-md bg-gray-50 p-3">
            <span>Valor</span><b className="text-right">{brl(entry.amount)}</b>
            <span>Já baixado</span><b className="text-right">{brl(entry.paidAmount)}</b>
            <span>Saldo em aberto</span><b className="text-right">{brl(entry.openAmount)}</b>
            <span>Vencimento</span><span className="text-right">{dmy(entry.dueDate)}</span>
          </div>
          {entry.cancelReason && <p className="text-muted-foreground">Cancelada: {entry.cancelReason}</p>}

          {open && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => onPay(entry)}>{entry.type === 'PAYABLE' ? 'Registrar pagamento' : 'Registrar recebimento'}</Button>
              {entry.type === 'RECEIVABLE' && !hasActiveCharge && <Button size="sm" variant="outline" onClick={() => onCharge(entry)}>Cobrar (boleto/PIX)</Button>}
              {!Number(entry.paidAmount) && <Button size="sm" variant="outline" onClick={() => onEdit(entry)}>Editar</Button>}
              <Button size="sm" variant="outline" className="text-red-600" disabled={cancel.isPending} onClick={() => void doCancel()}>Cancelar conta</Button>
            </div>
          )}

          <section>
            <h3 className="font-semibold mb-2">Baixas</h3>
            {payments.isLoading ? <Skeleton className="h-12 w-full" /> : payments.isError ? (
              <ErrorState error={payments.error} onRetry={() => payments.refetch()} compact />
            ) : (payments.data ?? []).length === 0 ? (
              <p className="text-muted-foreground">Nenhuma baixa registrada.</p>
            ) : (
              <ul className="space-y-2">
                {payments.data!.map((p) => (
                  <li key={p.id} className={`rounded-md border p-2 ${p.reversedAt ? 'opacity-60' : ''}`}>
                    <div className="flex justify-between">
                      <span>{dmy(p.paidAt)} · {METHOD_LABELS[p.method ?? ''] ?? p.method ?? '—'} · {SOURCE_LABELS[p.source] ?? p.source}</span>
                      <b className={p.reversedAt ? 'line-through' : ''}>{brl(p.total)}</b>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Principal {brl(p.principal)}
                      {Number(p.fine) ? ` · multa ${brl(p.fine)}` : ''}{Number(p.interest) ? ` · juros ${brl(p.interest)}` : ''}
                      {Number(p.discount) ? ` · desconto ${brl(p.discount)}` : ''}
                      {p.bankAccountName ? ` · ${p.bankAccountName}` : ''}
                    </p>
                    {p.reversedAt && <p className="text-xs text-red-600">Estornada em {dmy(p.reversedAt)}: {p.reversalReason}</p>}
                    <div className="mt-1 flex flex-wrap gap-2">
                      {p.receiptUrl && <a className="text-xs text-blue-600 hover:underline" href={apiFileUrl(p.receiptUrl)} target="_blank" rel="noreferrer">Ver comprovante</a>}
                      {!p.reversedAt && (
                        <>
                          <label className="text-xs text-blue-600 hover:underline cursor-pointer inline-flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />{p.receiptUrl ? 'Trocar comprovante' : 'Anexar comprovante'}
                            <input type="file" className="hidden" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => void doAttach(p.id, e.target.files?.[0])} />
                          </label>
                          <button type="button" className="text-xs text-red-600 hover:underline inline-flex items-center gap-1" onClick={() => void doReverse(p.id)}>
                            <Undo2 className="h-3 w-3" />Estornar
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {entry.type === 'RECEIVABLE' && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Nota fiscal (NFS-e)</h3>
                {onIssueNfse && entry.status !== 'CANCELLED' && !(nfse.data?.items ?? []).some((n) => ['QUEUED', 'PROCESSING', 'AUTHORIZED', 'ISSUED'].includes(n.status)) && (
                  <Button size="sm" variant="outline" onClick={() => onIssueNfse(entry)}>Emitir NF</Button>
                )}
              </div>
              {nfse.isLoading ? <Skeleton className="h-8 w-full" /> : nfse.isError ? (
                <ErrorState error={nfse.error} onRetry={() => nfse.refetch()} compact />
              ) : (nfse.data?.items ?? []).length === 0 ? (
                <p className="text-muted-foreground">Nenhuma nota emitida para esta conta.</p>
              ) : (
                <ul className="space-y-1">
                  {nfse.data!.items.map((n) => (
                    <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
                      <span>{n.number ? `NFS-e nº ${n.number}` : `RPS ${n.rpsNumber ?? '—'}`}{n.environment === 'HOMOLOG' ? ' (homologação)' : ''}{Number(n.totalRetained) ? ` · retido ${brl(n.totalRetained)}` : ''}</span>
                      <span className={`text-xs rounded-full px-2 py-0.5 ${NFSE_STATUS_STYLE[n.status] ?? 'bg-gray-100'}`}>{n.statusLabel}</span>
                      {n.rejectionReason && <p className="w-full text-xs text-red-700">{n.rejectionReason}</p>}
                      {n.pdfDownloadUrl && <a className="text-xs text-blue-600 hover:underline" href={apiFileUrl(n.pdfDownloadUrl)} target="_blank" rel="noreferrer">PDF</a>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {entry.type === 'RECEIVABLE' && (
            <section>
              <h3 className="font-semibold mb-2">Cobranças (boleto / PIX)</h3>
              {charges.isLoading ? <Skeleton className="h-12 w-full" /> : charges.isError ? (
                <ErrorState error={charges.error} onRetry={() => charges.refetch()} compact />
              ) : (charges.data?.items ?? []).length === 0 ? (
                <p className="text-muted-foreground">Nenhuma cobrança emitida.</p>
              ) : (
                <div className="space-y-2">{charges.data!.items.map((c) => <ChargeCard key={c.id} charge={c} />)}</div>
              )}
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
