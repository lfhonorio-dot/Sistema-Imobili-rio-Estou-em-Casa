// Visitas (Fase 1): lista as atividades do tipo "Visita" já existentes.
// A agenda completa de visitas (imóvel, corretor, retorno do cliente,
// calendário) é escopo da Fase 3.
'use client';

import { useState } from 'react';
import { CalendarDays, Plus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { TaskForm } from '@/components/crm/task-form';
import { ErrorState } from '@/components/common/error-state';
import { useActivities, useMarkActivityDone, type Activity } from '@/hooks/use-activities';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatDateTime } from '@/lib/utils';

function VisitRow({ visit, onDone, busy }: { visit: Activity; onDone?: () => void; busy?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="font-medium truncate">{visit.title || 'Visita'}</p>
        <p className="text-sm text-muted-foreground">
          {visit.dueAt ? formatDateTime(visit.dueAt) : 'Sem data definida'}
          {visit.contact?.name ? ` · ${visit.contact.name}` : ''}
          {visit.deal?.title ? ` · ${visit.deal.title}` : ''}
        </p>
        {visit.content && <p className="text-sm mt-1 text-muted-foreground line-clamp-2">{visit.content}</p>}
      </div>
      {onDone && (
        <Button size="sm" variant="outline" onClick={onDone} disabled={busy}>
          <Check className="h-4 w-4 mr-1" />
          Realizada
        </Button>
      )}
    </div>
  );
}

function VisitList({
  title, query, emptyText, allowDone,
}: {
  title: string;
  query: ReturnType<typeof useActivities>;
  emptyText: string;
  allowDone?: boolean;
}) {
  const markDone = useMarkActivityDone();
  const items = query.data?.items ?? [];

  const handleDone = async (id: string) => {
    try {
      await markDone.mutateAsync(id);
      toast.success('Visita marcada como realizada');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Não foi possível marcar a visita.'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} compact />
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <div className="divide-y">
            {items.map((v) => (
              <VisitRow
                key={v.id}
                visit={v}
                busy={markDone.isPending}
                onDone={allowDone ? () => handleDone(v.id) : undefined}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function VisitsPage() {
  const [open, setOpen] = useState(false);
  const pending = useActivities({ type: 'VISIT', done: 'false', limit: 100 });
  const done = useActivities({ type: 'VISIT', done: 'true', limit: 20 });

  return (
    <div>
      <Header title="Visitas" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Visitas agendadas como atividade do tipo &quot;Visita&quot;.
          </p>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Agendar visita
          </Button>
        </div>

        <VisitList title="A realizar" query={pending} emptyText="Nenhuma visita agendada." allowDone />
        <VisitList title="Realizadas recentemente" query={done} emptyText="Nenhuma visita realizada ainda." />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar visita</DialogTitle>
          </DialogHeader>
          <TaskForm defaultType="VISIT" onSuccess={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
