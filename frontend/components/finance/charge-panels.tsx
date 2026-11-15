'use client';

// Fase 5 — cobranças (boleto e PIX) de uma conta a receber: emitir, ver
// linha digitável / QR Code / copia-e-cola, enviar por e-mail e WhatsApp,
// cancelar (no Asaas também) e reemitir.

import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, ExternalLink, Mail, MessageCircle, RotateCw, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  brl, CHARGE_STATUS, dmy, todayISO, useCancelCharge, useGateways, useIssueCharge, useReissueCharge, useSendCharge,
  type Charge,
} from '@/hooks/use-finance';
import type { FinancialEntry } from '@/hooks/use-financial';
import { UnavailableNotice } from '@/components/common/error-state';

const ACTIVE = ['PENDING', 'REGISTERED', 'SENT', 'OVERDUE'];
const copy = (t: string, label: string) => { void navigator.clipboard.writeText(t); toast.success(`${label} copiado.`); };

/** Dados de pagamento e ações de uma cobrança. */
export function ChargeCard({ charge, compact }: { charge: Charge; compact?: boolean }) {
  const send = useSendCharge();
  const cancel = useCancelCharge();
  const reissue = useReissueCharge();
  const [reissueOpen, setReissueOpen] = useState(false);
  const [newDue, setNewDue] = useState(todayISO());
  const active = ACTIVE.includes(charge.status);
  const isPix = charge.kind === 'PIX';

  const doSend = async (channels: Array<'EMAIL' | 'WHATSAPP'>) => {
    try {
      await send.mutateAsync({ id: charge.id, channels });
      toast.success(channels[0] === 'EMAIL' ? 'Enviado por e-mail.' : 'Enviado por WhatsApp.');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };
  const doCancel = async () => {
    const reason = window.prompt('Motivo do cancelamento (a cobrança será cancelada também no Asaas):');
    if (!reason?.trim()) return;
    try {
      await cancel.mutateAsync({ id: charge.id, reason });
      toast.success('Cobrança cancelada no Asaas.');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };
  const doReissue = async (kind?: 'BOLETO' | 'PIX') => {
    try {
      await reissue.mutateAsync({ id: charge.id, newDueDate: newDue, kind });
      toast.success('Cobrança reemitida: a anterior foi cancelada no Asaas.');
      setReissueOpen(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div className={`rounded-md border p-3 text-sm space-y-2 ${active ? '' : 'opacity-70'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{isPix ? 'PIX' : 'Boleto'} · {brl(charge.amount)} · vence {dmy(charge.dueDate)}</span>
        <span className="text-xs rounded-full bg-gray-100 px-2 py-0.5">{CHARGE_STATUS[charge.status] ?? charge.status}</span>
      </div>
      {charge.cancelReason && <p className="text-xs text-muted-foreground">Motivo do cancelamento: {charge.cancelReason}</p>}
      {charge.lastSentAt && <p className="text-xs text-muted-foreground">Último envio: {new Date(charge.lastSentAt).toLocaleString('pt-BR')} ({charge.lastSentChannels?.replace('EMAIL', 'e-mail').replace('WHATSAPP', 'WhatsApp')})</p>}
      {active && !compact && (
        <>
          {!isPix && charge.linhaDigitavel && (
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-gray-100 p-2 text-xs">{charge.linhaDigitavel}</code>
              <Button size="sm" variant="outline" onClick={() => copy(charge.linhaDigitavel!, 'Linha digitável')}><Copy className="h-4 w-4" /></Button>
            </div>
          )}
          {isPix && charge.pixQrCode && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`data:image/png;base64,${charge.pixQrCode}`} alt="QR Code PIX" className="h-40 w-40 border rounded" />
          )}
          {isPix && charge.pixCopiaECola && (
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-gray-100 p-2 text-xs">{charge.pixCopiaECola}</code>
              <Button size="sm" variant="outline" onClick={() => copy(charge.pixCopiaECola!, 'PIX copia e cola')}><Copy className="h-4 w-4" /></Button>
            </div>
          )}
        </>
      )}
      {active && (
        <div className="flex flex-wrap gap-2">
          {charge.bankSlipUrl && (
            <a href={charge.bankSlipUrl} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline"><ExternalLink className="h-4 w-4 mr-1" />{isPix ? 'Página do PIX' : 'PDF do boleto'}</Button>
            </a>
          )}
          <Button size="sm" variant="outline" disabled={send.isPending} onClick={() => void doSend(['EMAIL'])}><Mail className="h-4 w-4 mr-1" />E-mail</Button>
          <Button size="sm" variant="outline" disabled={send.isPending} onClick={() => void doSend(['WHATSAPP'])}><MessageCircle className="h-4 w-4 mr-1" />WhatsApp</Button>
          <Button size="sm" variant="outline" onClick={() => setReissueOpen((v) => !v)}><RotateCw className="h-4 w-4 mr-1" />Reemitir</Button>
          <Button size="sm" variant="outline" className="text-red-600" disabled={cancel.isPending} onClick={() => void doCancel()}><XCircle className="h-4 w-4 mr-1" />Cancelar</Button>
        </div>
      )}
      {reissueOpen && (
        <div className="flex flex-wrap items-end gap-2 rounded bg-gray-50 p-2">
          <div className="space-y-1"><Label className="text-xs">Novo vencimento</Label>
            <Input type="date" min={todayISO()} value={newDue} onChange={(e) => setNewDue(e.target.value)} className="h-8" /></div>
          <Button size="sm" disabled={reissue.isPending} onClick={() => void doReissue()}>Reemitir {isPix ? 'PIX' : 'boleto'}</Button>
          <Button size="sm" variant="outline" disabled={reissue.isPending} onClick={() => void doReissue(isPix ? 'BOLETO' : 'PIX')}>Trocar para {isPix ? 'boleto' : 'PIX'}</Button>
        </div>
      )}
    </div>
  );
}

/** Emitir boleto ou PIX para uma conta a receber. */
export function IssueChargeDialog({ entry, onClose }: { entry: FinancialEntry | null; onClose: () => void }) {
  const gateways = useGateways();
  const issue = useIssueCharge();
  const [kind, setKind] = useState<'BOLETO' | 'PIX'>('BOLETO');
  const [due, setDue] = useState('');
  const [issued, setIssued] = useState<Charge | null>(null);
  const hasAsaas = (gateways.data ?? []).some((g) => g.provider === 'ASAAS' && g.isActive);
  const entryDue = entry?.dueDate?.slice(0, 10) ?? '';
  const pastDue = entryDue < todayISO();

  const close = () => { setIssued(null); setDue(''); onClose(); };
  const submit = async () => {
    if (!entry) return;
    const dueDate = due || (pastDue ? '' : undefined);
    if (dueDate === '') return toast.error('O vencimento já passou: informe uma nova data.');
    try {
      const c = await issue.mutateAsync({ financialEntryId: entry.id, kind, dueDate: dueDate ? `${dueDate}T12:00:00` : undefined });
      setIssued(c);
      toast.success(kind === 'PIX' ? 'PIX gerado no Asaas.' : 'Boleto emitido no Asaas.');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open={!!entry} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Cobrar {entry?.description}</DialogTitle></DialogHeader>
        {issued ? (
          <div className="space-y-3">
            <ChargeCard charge={issued} />
            <div className="flex justify-end"><Button onClick={close}>Fechar</Button></div>
          </div>
        ) : gateways.isLoading ? (
          <p className="text-sm text-muted-foreground">Verificando o gateway...</p>
        ) : gateways.isError ? (
          <p className="text-sm text-red-600">Não foi possível verificar o gateway: {getApiErrorMessage(gateways.error)}</p>
        ) : !hasAsaas ? (
          <UnavailableNotice title="Boleto e PIX não disponíveis">
            Nenhum gateway Asaas ativo está configurado. Configure em Financeiro → Boletos e PIX, ou registre o recebimento manualmente.
          </UnavailableNotice>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              {(['BOLETO', 'PIX'] as const).map((k) => (
                <button key={k} type="button" onClick={() => setKind(k)}
                  className={`rounded-md border p-3 text-left ${kind === k ? 'border-blue-500 bg-blue-50' : ''}`}>
                  <p className="font-medium">{k === 'PIX' ? 'PIX' : 'Boleto'}</p>
                  <p className="text-xs text-muted-foreground">{k === 'PIX' ? 'QR Code e copia-e-cola' : 'Linha digitável e PDF'}</p>
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <Label>Vencimento da cobrança {pastDue ? '(obrigatório: o original já passou)' : `(padrão: ${dmy(entry?.dueDate)})`}</Label>
              <Input type="date" min={todayISO()} value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">O valor cobrado é o saldo em aberto da conta. Multa e juros seguem o padrão configurado. Quando o pagador pagar, a baixa é automática.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={close}>Voltar</Button>
              <Button disabled={issue.isPending} onClick={() => void submit()}>{issue.isPending ? 'Emitindo...' : kind === 'PIX' ? 'Gerar PIX' : 'Emitir boleto'}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
