'use client';

// Fase 3 — formulários de visita: agendar, concluir (retorno do cliente) e cancelar.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { INTEREST_LEVELS } from '@/lib/funnel';
import { useAuthStore } from '@/stores/auth.store';
import { useContacts } from '@/hooks/use-contacts';
import { useProperties } from '@/hooks/use-properties';
import { funnelApi, useFunnelMutation, type Visit } from '@/hooks/use-funnel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export const nativeSelect =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring';

export function useMembers() {
  const ws = useAuthStore((s) => s.currentWorkspaceId);
  return useQuery({
    queryKey: ['workspace-members', ws],
    queryFn: async () => (await api.get('/users/workspace/members')).data.data as Array<{ id: string; user: { name: string } }>,
    enabled: !!ws,
    retry: false,
  });
}

/** Data/hora local do input datetime-local → ISO (UTC). */
function localToIso(v: string) {
  return new Date(v).toISOString();
}

export function ScheduleVisitForm({
  dealId, contactId, propertyIds, onDone, onCancel,
}: {
  dealId?: string;
  contactId?: string;
  /** imóveis sugeridos (os do negócio) */
  propertyIds?: string[];
  onDone?: (v: Visit) => void;
  onCancel?: () => void;
}) {
  const contacts = useContacts({ limit: 500 });
  const properties = useProperties({ limit: 500 });
  const members = useMembers();
  const [form, setForm] = useState({
    contactId: contactId ?? '',
    propertyId: propertyIds?.length === 1 ? propertyIds[0] : '',
    brokerId: '',
    when: '',
    durationMin: '60',
    notes: '',
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const create = useFunnelMutation(funnelApi.createVisit);

  const allProps = (properties.data?.items ?? []) as Array<{ id: string; code: string; street?: string | null; neighborhood?: string | null; status: string }>;
  const suggested = new Set(propertyIds ?? []);
  const propOptions = [...allProps].filter((p) => p.status !== 'SOLD' && p.status !== 'INACTIVE')
    .sort((a, b) => Number(suggested.has(b.id)) - Number(suggested.has(a.id)));

  const submit = async () => {
    if (!form.propertyId) return toast.error('Escolha o imóvel da visita.');
    if (!dealId && !form.contactId) return toast.error('Escolha o cliente.');
    if (!form.when) return toast.error('Informe data e hora da visita.');
    try {
      const v = await create.mutateAsync({
        dealId,
        contactId: form.contactId || undefined,
        propertyId: form.propertyId,
        brokerId: form.brokerId || undefined,
        scheduledAt: localToIso(form.when),
        durationMin: Number(form.durationMin) || 60,
        notes: form.notes || undefined,
      });
      toast.success(v.dealMovedTo ? `Visita agendada. Negócio movido para "${v.dealMovedTo}".` : 'Visita agendada');
      onDone?.(v);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Não foi possível agendar a visita.'));
    }
  };

  return (
    <div className="space-y-3">
      {!dealId && (
        <div className="space-y-1">
          <Label>Cliente *</Label>
          <select className={nativeSelect} value={form.contactId} onChange={(e) => set('contactId', e.target.value)}>
            <option value="">Selecione…</option>
            {((contacts.data?.items ?? []) as Array<{ id: string; name: string }>).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      <div className="space-y-1">
        <Label>Imóvel *</Label>
        <select className={nativeSelect} value={form.propertyId} onChange={(e) => set('propertyId', e.target.value)}>
          <option value="">Selecione…</option>
          {propOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {suggested.has(p.id) ? '★ ' : ''}{p.code}{p.street ? ` — ${p.street}` : ''}{p.neighborhood ? `, ${p.neighborhood}` : ''}
            </option>
          ))}
        </select>
        {properties.isError && <p className="text-xs text-red-600">{getApiErrorMessage(properties.error)}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Data e hora *</Label>
          <Input type="datetime-local" value={form.when} onChange={(e) => set('when', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Duração (min)</Label>
          <Input type="number" min={15} max={480} step={15} value={form.durationMin} onChange={(e) => set('durationMin', e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Corretor que acompanha</Label>
        <select className={nativeSelect} value={form.brokerId} onChange={(e) => set('brokerId', e.target.value)} disabled={members.isError}>
          <option value="">Eu mesmo(a)</option>
          {(members.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.user.name}</option>)}
        </select>
        {members.isError && <p className="text-xs text-muted-foreground">Lista de corretores indisponível: {getApiErrorMessage(members.error)}</p>}
      </div>
      <div className="space-y-1">
        <Label>Observações</Label>
        <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Ex.: pegar chave na imobiliária" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancelar</Button>}
        <Button onClick={submit} disabled={create.isPending}>
          {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Agendar visita
        </Button>
      </div>
    </div>
  );
}

export function CompleteVisitForm({ visit, onDone, onCancel }: { visit: Visit; onDone?: () => void; onCancel?: () => void }) {
  const [interest, setInterest] = useState('');
  const [feedback, setFeedback] = useState('');
  const complete = useFunnelMutation(funnelApi.completeVisit);
  const submit = async () => {
    if (!interest) return toast.error('Informe o interesse do cliente.');
    try {
      const r = await complete.mutateAsync({ id: visit.id, interestLevel: interest, feedback: feedback || undefined });
      toast.success(r.dealMovedTo ? `Visita registrada. Negócio movido para "${r.dealMovedTo}".` : 'Visita registrada como realizada');
      onDone?.();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Não foi possível registrar a visita.'));
    }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{visit.property.code} — {visit.contact.name}</p>
      <div className="space-y-1">
        <Label>Interesse do cliente *</Label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(INTEREST_LEVELS).map(([k, v]) => (
            <button key={k} type="button" onClick={() => setInterest(k)}
              className={`rounded-full border px-3 py-1 text-sm ${interest === k ? 'border-primary bg-primary/10 font-medium' : ''}`}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <Label>Retorno do cliente</Label>
        <Textarea rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="O que o cliente achou? Objeções, pontos positivos, próximos passos…" />
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancelar</Button>}
        <Button onClick={submit} disabled={complete.isPending}>
          {complete.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Registrar visita realizada
        </Button>
      </div>
    </div>
  );
}

export function useCancelVisit() {
  const cancel = useFunnelMutation(funnelApi.cancelVisit);
  return async (visit: Visit, status: 'CANCELLED' | 'NO_SHOW') => {
    const reason = prompt(status === 'NO_SHOW' ? 'Observação (cliente não compareceu):' : 'Motivo do cancelamento:',
      status === 'NO_SHOW' ? 'Cliente não compareceu' : '');
    if (!reason?.trim()) return;
    try {
      await cancel.mutateAsync({ id: visit.id, reason, status });
      toast.success(status === 'NO_SHOW' ? 'Registrado: cliente não compareceu' : 'Visita cancelada');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };
}
