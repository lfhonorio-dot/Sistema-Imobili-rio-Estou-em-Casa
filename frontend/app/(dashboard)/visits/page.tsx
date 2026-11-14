// Visitas (Fase 3): agenda de visitas por dia, com imóvel, cliente e
// corretor; registro do retorno do cliente; "minhas visitas".
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Plus } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/error-state';
import { CompleteVisitForm, ScheduleVisitForm, useCancelVisit } from '@/components/funnel/visit-forms';
import { useVisits, type Visit } from '@/hooks/use-funnel';
import { INTEREST_LEVELS, VISIT_STATUS } from '@/lib/funnel';

type Range = 'upcoming' | 'past' | 'all';

const dayKey = (d: Date) => d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
const hour = (v: string) => new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export default function VisitsPage() {
  const [open, setOpen] = useState(false);
  const [completing, setCompleting] = useState<Visit | null>(null);
  const [range, setRange] = useState<Range>('upcoming');
  const [mine, setMine] = useState(false);
  const cancelVisit = useCancelVisit();

  const query = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (range === 'upcoming') return { from: today.toISOString(), mine };
    if (range === 'past') return { to: today.toISOString(), mine };
    return { mine };
  }, [range, mine]);
  const visits = useVisits(query);

  const groups = useMemo(() => {
    const items = [...(visits.data ?? [])];
    if (range === 'past') items.reverse();
    const map = new Map<string, Visit[]>();
    for (const v of items) {
      const k = dayKey(new Date(v.scheduledAt));
      map.set(k, [...(map.get(k) ?? []), v]);
    }
    return [...map.entries()];
  }, [visits.data, range]);

  const toggle = (active: boolean) => `px-3 py-1.5 ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`;

  return (
    <div>
      <Header title="Visitas" />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <div className="flex border rounded-md overflow-hidden text-sm">
              <button className={toggle(range === 'upcoming')} onClick={() => setRange('upcoming')}>Próximas</button>
              <button className={toggle(range === 'past')} onClick={() => setRange('past')}>Anteriores</button>
              <button className={toggle(range === 'all')} onClick={() => setRange('all')}>Todas</button>
            </div>
            <div className="flex border rounded-md overflow-hidden text-sm">
              <button className={toggle(!mine)} onClick={() => setMine(false)}>Todos os corretores</button>
              <button className={toggle(mine)} onClick={() => setMine(true)}>Minhas visitas</button>
            </div>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Agendar visita
          </Button>
        </div>

        {visits.isLoading ? (
          <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
        ) : visits.isError ? (
          <Card><ErrorState error={visits.error} onRetry={() => visits.refetch()} /></Card>
        ) : groups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <CalendarDays className="mx-auto mb-2 h-8 w-8" />
              {range === 'upcoming' ? 'Nenhuma visita agendada.' : 'Nenhuma visita encontrada.'}
            </CardContent>
          </Card>
        ) : (
          groups.map(([day, items]) => (
            <div key={day}>
              <p className="mb-2 text-sm font-semibold capitalize text-muted-foreground">{day}</p>
              <Card>
                <CardContent className="p-0 divide-y">
                  {items.map((v) => (
                    <div key={v.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                      <div className="flex gap-4 min-w-0">
                        <div className="w-14 shrink-0 text-lg font-semibold">{hour(v.scheduledAt)}</div>
                        <div className="min-w-0 text-sm">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link href={`/properties/${v.property.id}`} className="font-medium hover:underline">
                              {v.property.code}{v.property.street ? ` — ${v.property.street}${v.property.number ? `, ${v.property.number}` : ''}` : ''}
                            </Link>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${VISIT_STATUS[v.status].className}`}>{VISIT_STATUS[v.status].label}</span>
                          </div>
                          <p className="text-muted-foreground">
                            Cliente: <Link href={`/contacts/${v.contact.id}`} className="hover:underline">{v.contact.name}</Link>
                            {v.contact.phone ? ` · ${v.contact.phone}` : ''} · Corretor: {v.broker?.name ?? '—'}
                          </p>
                          {v.deal && (
                            <p className="text-muted-foreground">Negócio: <Link href={`/deals/${v.deal.id}`} className="hover:underline">{v.deal.title}</Link></p>
                          )}
                          {v.interestLevel && <p>Interesse: {INTEREST_LEVELS[v.interestLevel]}{v.feedback ? ` — “${v.feedback}”` : ''}</p>}
                          {v.cancelReason && <p className="text-muted-foreground">Motivo: {v.cancelReason}</p>}
                        </div>
                      </div>
                      {v.status === 'SCHEDULED' && (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => setCompleting(v)}>Realizada</Button>
                          <Button size="sm" variant="ghost" onClick={() => cancelVisit(v, 'NO_SHOW')}>Não compareceu</Button>
                          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => cancelVisit(v, 'CANCELLED')}>Cancelar</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agendar visita</DialogTitle></DialogHeader>
          <ScheduleVisitForm onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      <Dialog open={!!completing} onOpenChange={(o) => !o && setCompleting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Visita realizada — retorno do cliente</DialogTitle></DialogHeader>
          {completing && <CompleteVisitForm visit={completing} onDone={() => setCompleting(null)} onCancel={() => setCompleting(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
