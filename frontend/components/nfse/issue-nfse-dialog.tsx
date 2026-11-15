'use client';

// Fase 6 — "Emitir NF" a partir de uma conta a receber: mostra tomador,
// valores, ISS e retenções (quando o tomador é PJ) antes de enviar.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/error-state';
import { getApiErrorMessage } from '@/lib/api-error';
import { brl } from '@/hooks/use-finance';
import { useNfseActions, useNfsePreview, type Nfse } from '@/hooks/use-nfse';

export function IssueNfseDialog({ entryId, onClose }: { entryId: string | null; onClose: () => void }) {
  const pv = useNfsePreview(entryId ?? undefined);
  const { request } = useNfseActions();
  const [description, setDescription] = useState('');
  const [result, setResult] = useState<Nfse | null>(null);
  useEffect(() => { if (pv.data) setDescription(pv.data.description); }, [pv.data]);
  const close = () => { setResult(null); setDescription(''); onClose(); };

  const submit = async () => {
    if (!entryId) return;
    try {
      const n = await request.mutateAsync({ entryId, description });
      setResult(n);
      if (n.status === 'AUTHORIZED') toast.success(`NFS-e nº ${n.number} autorizada.`);
      else if (n.status === 'REJECTED') toast.error('A prefeitura rejeitou a nota. Veja o motivo.');
      else toast.message('Nota na fila: o sistema vai tentar de novo automaticamente.');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const t = pv.data?.taxes;
  return (
    <Dialog open={!!entryId} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Emitir nota fiscal de serviço</DialogTitle></DialogHeader>
        {result ? (
          <div className="space-y-3 text-sm">
            <p>Situação: <b>{result.statusLabel}</b>{result.number ? ` · nº ${result.number}` : ''}</p>
            {result.rejectionReason && <p className="rounded bg-red-50 p-2 text-red-700">{result.rejectionReason}</p>}
            {result.retentionWarning && <p className="rounded bg-amber-50 p-2 text-amber-800">{result.retentionWarning}</p>}
            <div className="flex justify-end gap-2">
              <Link href="/fiscal?tab=nfse"><Button variant="outline">Ver notas fiscais</Button></Link>
              <Button onClick={close}>Fechar</Button>
            </div>
          </div>
        ) : pv.isLoading ? <Skeleton className="h-40 w-full" /> : pv.isError ? (
          <ErrorState error={pv.error} onRetry={() => pv.refetch()} compact />
        ) : pv.data && t && (
          <div className="space-y-3 text-sm">
            {pv.data.environment !== 'PRODUCTION' && (
              <p className="rounded bg-blue-50 p-2 text-blue-800">Ambiente de <b>homologação</b> (teste): a nota não tem valor fiscal.</p>
            )}
            {!pv.data.readiness.ready && (
              <p className="rounded bg-red-50 p-2 text-red-700">
                Falta configurar: {pv.data.readiness.missing.join(', ')}. <Link className="underline" href="/fiscal?tab=nfse&sub=config">Abrir configuração fiscal</Link>
              </p>
            )}
            {pv.data.problems.map((p) => <p key={p} className="rounded bg-red-50 p-2 text-red-700">{p}</p>)}
            <div className="rounded-md border p-3">
              <p className="font-medium">Tomador</p>
              {pv.data.taker
                ? <p>{pv.data.taker.name} · {pv.data.taker.type === 'PJ' ? 'CNPJ' : pv.data.taker.type === 'PF' ? 'CPF' : 'documento'} {pv.data.taker.document ?? '—'}{pv.data.taker.email ? ` · ${pv.data.taker.email}` : ''}</p>
                : <p className="text-red-700">Sem pagador na conta.</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="nfse-desc">Discriminação do serviço</Label>
              <Textarea id="nfse-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-gray-50 p-3">
              <span>Valor do serviço</span><b className="text-right">{brl(t.base)}</b>
              <span>ISS ({t.issRatePct}%){t.issRetained ? ' — retido' : ''}</span><span className="text-right">{brl(t.issDue)}</span>
              {t.totalRetained > 0 && (<>
                <span>IR retido</span><span className="text-right">{brl(t.irRetained)}</span>
                <span>PIS / COFINS / CSLL retidos</span><span className="text-right">{brl(t.pisRetained + t.cofinsRetained + t.csllRetained)}</span>
                {t.issRetainedAmount > 0 && (<><span>ISS retido</span><span className="text-right">{brl(t.issRetainedAmount)}</span></>)}
                <span className="font-medium">Valor líquido a receber</span><b className="text-right">{brl(t.netAmount)}</b>
              </>)}
            </div>
            {t.totalRetained > 0 && (
              <p className="text-xs text-muted-foreground">Tomador pessoa jurídica: ao autorizar, a conta a receber passa a esperar só o valor líquido e as retenções ficam registradas para o contador.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={close}>Voltar</Button>
              <Button disabled={!pv.data.canIssue || request.isPending} onClick={() => void submit()}>{request.isPending ? 'Enviando à prefeitura...' : 'Emitir NF'}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
