'use client';

// Fase 3 — painéis do detalhe do negócio: imóveis de interesse, visitas e
// propostas (com contraproposta, aceite, recusa e documento para PDF).

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CalendarPlus, FileText, Plus, X } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error';
import { INTEREST_LEVELS, PAYMENT_METHODS, PROPOSAL_STATUS, VISIT_STATUS, brl } from '@/lib/funnel';
import { useProperties } from '@/hooks/use-properties';
import { funnelApi, useFunnelMutation, useProposals, useVisits, type Proposal, type Visit } from '@/hooks/use-funnel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/error-state';
import { CompleteVisitForm, ScheduleVisitForm, nativeSelect, useCancelVisit } from './visit-forms';
import { ProposalForm } from './proposal-form';

const dateTime = (v: string) => new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const date = (v: string) => new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

type DealProperty = { propertyId: string; property?: { id: string; code: string; street?: string | null; neighborhood?: string | null; salePrice?: unknown } | null };

export function DealPropertiesPanel({ dealId, items }: { dealId: string; items: DealProperty[] }) {
  const properties = useProperties({ limit: 500 });
  const [adding, setAdding] = useState('');
  const save = useFunnelMutation(funnelApi.setDealProperties);
  const ids = items.map((i) => i.propertyId);

  const update = async (next: string[]) => {
    try {
      await save.mutateAsync({ dealId, propertyIds: next });
      toast.success('Imóveis do negócio atualizados');
      setAdding('');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const options = ((properties.data?.items ?? []) as Array<{ id: string; code: string; street?: string | null; status: string }>)
    .filter((p) => !ids.includes(p.id) && p.status !== 'SOLD');

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-sm">Imóveis de interesse</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {items.length === 0 && <p className="text-muted-foreground">Nenhum imóvel vinculado.</p>}
        {items.map((i) => (
          <div key={i.propertyId} className="flex items-center justify-between gap-2">
            <Link href={`/properties/${i.propertyId}`} className="hover:underline truncate">
              {i.property?.code ?? i.propertyId}{i.property?.street ? ` — ${i.property.street}` : ''}
            </Link>
            <span className="text-muted-foreground whitespace-nowrap">{brl(i.property?.salePrice)}</span>
            <button className="text-red-600" title="Remover" disabled={save.isPending}
              onClick={() => update(ids.filter((x) => x !== i.propertyId))}><X className="h-4 w-4" /></button>
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <select className={nativeSelect} value={adding} onChange={(e) => setAdding(e.target.value)}>
            <option value="">Adicionar imóvel…</option>
            {options.map((p) => <option key={p.id} value={p.id}>{p.code}{p.street ? ` — ${p.street}` : ''}</option>)}
          </select>
          <Button size="sm" variant="outline" disabled={!adding || save.isPending} onClick={() => update([...ids, adding])}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {properties.isError && <p className="text-xs text-red-600">{getApiErrorMessage(properties.error)}</p>}
      </CardContent>
    </Card>
  );
}

export function DealVisitsPanel({ dealId, propertyIds }: { dealId: string; propertyIds: string[] }) {
  const visits = useVisits({ dealId });
  const [scheduling, setScheduling] = useState(false);
  const [completing, setCompleting] = useState<Visit | null>(null);
  const cancelVisit = useCancelVisit();

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Visitas</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setScheduling(true)}>
          <CalendarPlus className="h-4 w-4 mr-1" /> Agendar
        </Button>
      </CardHeader>
      <CardContent className="text-sm">
        {visits.isLoading ? <Skeleton className="h-12 w-full" /> : visits.isError ? (
          <ErrorState error={visits.error} onRetry={() => visits.refetch()} compact />
        ) : visits.data!.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma visita neste negócio.</p>
        ) : (
          <div className="divide-y">
            {visits.data!.map((v) => (
              <div key={v.id} className="py-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${VISIT_STATUS[v.status].className}`}>{VISIT_STATUS[v.status].label}</span>
                    <span className="font-medium">{dateTime(v.scheduledAt)}</span>
                    <span>{v.property.code}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Corretor: {v.broker?.name ?? '—'}
                    {v.interestLevel && ` · Interesse: ${INTEREST_LEVELS[v.interestLevel]}`}
                  </p>
                  {v.feedback && <p className="text-xs mt-0.5">“{v.feedback}”</p>}
                  {v.cancelReason && <p className="text-xs text-muted-foreground">Motivo: {v.cancelReason}</p>}
                </div>
                {v.status === 'SCHEDULED' && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button size="sm" onClick={() => setCompleting(v)}>Realizada</Button>
                    <Button size="sm" variant="ghost" onClick={() => cancelVisit(v, 'NO_SHOW')}>Não compareceu</Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => cancelVisit(v, 'CANCELLED')}>Cancelar</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={scheduling} onOpenChange={setScheduling}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agendar visita</DialogTitle></DialogHeader>
          <ScheduleVisitForm dealId={dealId} propertyIds={propertyIds} onDone={() => setScheduling(false)} onCancel={() => setScheduling(false)} />
        </DialogContent>
      </Dialog>
      <Dialog open={!!completing} onOpenChange={(o) => !o && setCompleting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Visita realizada — retorno do cliente</DialogTitle></DialogHeader>
          {completing && <CompleteVisitForm visit={completing} onDone={() => setCompleting(null)} onCancel={() => setCompleting(null)} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

async function openProposalDocument(id: string) {
  try {
    const html = await funnelApi.proposalDocument(id);
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    toast.error(getApiErrorMessage(err, 'Não foi possível gerar o documento da proposta.'));
  }
}

export function DealProposalsPanel({
  dealId, properties, closed,
}: {
  dealId: string;
  properties: Array<{ id: string; code: string }>;
  closed: boolean;
}) {
  const list = useProposals(dealId);
  const [creating, setCreating] = useState(false);
  const [countering, setCountering] = useState<Proposal | null>(null);
  const decide = useFunnelMutation(funnelApi.decideProposal);
  const hasOpen = (list.data ?? []).some((p) => p.status === 'OPEN');

  const act = async (p: Proposal, action: 'accept' | 'reject' | 'withdraw') => {
    let note: string | undefined;
    if (action === 'reject') {
      note = prompt('Motivo da recusa:') ?? undefined;
      if (!note?.trim()) return;
    } else if (action === 'accept') {
      if (!confirm(`Aceitar ${brl(p.amount)}? O valor do negócio passa a ser este e o negócio vai para "Documentação".`)) return;
    } else if (!confirm('Retirar esta proposta?')) return;
    try {
      const r = await decide.mutateAsync({ id: p.id, action, note });
      toast.success(
        action === 'accept' ? `Proposta aceita${r.dealMovedTo ? `. Negócio movido para "${r.dealMovedTo}"` : ''}.`
          : action === 'reject' ? 'Proposta recusada' : 'Proposta retirada',
      );
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Propostas</CardTitle>
        {!closed && !hasOpen && (
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" /> Nova proposta</Button>
        )}
      </CardHeader>
      <CardContent className="text-sm">
        {list.isLoading ? <Skeleton className="h-12 w-full" /> : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} compact />
        ) : list.data!.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma proposta registrada.</p>
        ) : (
          <ol className="space-y-3">
            {list.data!.map((p) => (
              <li key={p.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{p.kind === 'OFFER' ? 'Comprador' : 'Vendedor (contraproposta)'}</span>
                    <span className="font-semibold">{brl(p.amount)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${PROPOSAL_STATUS[p.situation].className}`}>{PROPOSAL_STATUS[p.situation].label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString('pt-BR')} · válida até {date(p.validUntil)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {PAYMENT_METHODS[p.paymentMethod] ?? p.paymentMethod}
                  {p.downPayment != null && ` · entrada ${brl(p.downPayment)}`}
                  {p.financedAmount != null && ` · financiado ${brl(p.financedAmount)}`}
                  {p.fgtsAmount != null && ` · FGTS ${brl(p.fgtsAmount)}`}
                  {p.exchangeDescription && ` · permuta: ${p.exchangeDescription}`}
                  {p.property?.code && ` · ${p.property.code}`}
                </p>
                {p.conditions && <p className="text-xs mt-1">{p.conditions}</p>}
                {p.decisionNote && <p className="text-xs mt-1 text-muted-foreground">Observação: {p.decisionNote}</p>}
                <div className="flex flex-wrap gap-1 mt-2">
                  <Button size="sm" variant="ghost" onClick={() => openProposalDocument(p.id)}><FileText className="h-4 w-4 mr-1" /> PDF</Button>
                  {p.situation === 'OPEN' && !closed && (
                    <>
                      <Button size="sm" onClick={() => act(p, 'accept')} disabled={decide.isPending}>Aceitar</Button>
                      <Button size="sm" variant="outline" onClick={() => setCountering(p)}>Contraproposta</Button>
                      <Button size="sm" variant="ghost" onClick={() => act(p, 'reject')}>Recusar</Button>
                      <Button size="sm" variant="ghost" onClick={() => act(p, 'withdraw')}>Retirar</Button>
                    </>
                  )}
                  {p.situation === 'EXPIRED' && !closed && (
                    <Button size="sm" variant="ghost" onClick={() => act(p, 'withdraw')}>Encerrar (vencida)</Button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova proposta</DialogTitle></DialogHeader>
          <ProposalForm dealId={dealId} properties={properties} onDone={() => setCreating(false)} onCancel={() => setCreating(false)} />
        </DialogContent>
      </Dialog>
      <Dialog open={!!countering} onOpenChange={(o) => !o && setCountering(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Contraproposta</DialogTitle></DialogHeader>
          {countering && (
            <ProposalForm dealId={dealId} properties={properties} counterOf={countering} onDone={() => setCountering(null)} onCancel={() => setCountering(null)} />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
