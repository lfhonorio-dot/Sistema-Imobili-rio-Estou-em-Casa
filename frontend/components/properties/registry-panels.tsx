'use client';

// Fase 2 — painéis do detalhe do imóvel. Cada painel carrega seus dados,
// mostra erro de verdade (com "Tentar de novo") e a mensagem do backend
// em cada ação.

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, Trash2, Star, KeyRound, FileText, Loader2, AlertTriangle } from 'lucide-react';
import api, { apiFileUrl } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/error-state';
import { useContacts } from '@/hooks/use-contacts';
import { useAuthStore } from '@/stores/auth.store';
import {
  useMatchingContacts, usePriceHistory, usePropertyAuthorizations, usePropertyDocuments, usePropertyKeys,
  usePropertyMutation, usePropertyOwners, type PropertyAuthorization,
} from '@/hooks/use-property-registry';

const brl = (v: unknown) =>
  v === null || v === undefined || v === ''
    ? '—'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v));
const date = (v?: string | null) => (v ? new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—');
const dateTime = (v?: string | null) => (v ? new Date(v).toLocaleString('pt-BR') : '—');
const today = () => new Date().toISOString().slice(0, 10);
const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring';

function Loading() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

// ── Proprietários ─────────────────────────────────────────────────────

export function OwnersPanel({ propertyId }: { propertyId: string }) {
  const owners = usePropertyOwners(propertyId);
  const contacts = useContacts({ limit: 500 });
  const [contactId, setContactId] = useState('');
  const [share, setShare] = useState('');
  const invalidate = ['property-owners', 'property'];
  const add = usePropertyMutation(
    (v: { contactId: string; sharePct?: number }) => api.post(`/properties/${propertyId}/owners`, v),
    invalidate,
  );
  const remove = usePropertyMutation((id: string) => api.delete(`/properties/${propertyId}/owners/${id}`), invalidate);
  const makePrimary = usePropertyMutation(
    async (link: { id: string; contactId: string; sharePct: number | null }) => {
      // troca o principal: remove e adiciona de novo como principal (histórico preservado)
      await api.delete(`/properties/${propertyId}/owners/${link.id}`);
      await api.post(`/properties/${propertyId}/owners`, { contactId: link.contactId, isPrimary: true, ...(link.sharePct ? { sharePct: link.sharePct } : {}) });
    },
    invalidate,
  );

  const submit = async () => {
    if (!contactId) return toast.error('Escolha o contato do proprietário.');
    try {
      await add.mutateAsync({ contactId, ...(share ? { sharePct: Number(share.replace(',', '.')) } : {}) });
      toast.success('Proprietário adicionado');
      setContactId('');
      setShare('');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Não foi possível adicionar o proprietário.'));
    }
  };

  const linkedIds = new Set((owners.data ?? []).map((o) => o.contactId));
  const options = (contacts.data?.items ?? []).filter((c: { id: string }) => !linkedIds.has(c.id));

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Proprietários</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {owners.isLoading ? <Loading /> : owners.isError ? (
          <ErrorState error={owners.error} onRetry={() => owners.refetch()} compact />
        ) : owners.data!.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum proprietário vinculado.</p>
        ) : (
          <div className="divide-y">
            {owners.data!.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <Link href={`/contacts/${o.contact.id}`} className="font-medium hover:underline">{o.contact.name}</Link>
                  <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                    {o.isPrimary && <Badge variant="secondary">Principal</Badge>}
                    {o.sharePct != null && <span>{Number(o.sharePct)}% do imóvel</span>}
                    {(o.contact.maritalStatus === 'CASADO' || o.contact.maritalStatus === 'UNIAO_ESTAVEL') && !o.contact.spouseContactId && (
                      <span className="text-amber-700 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> casado(a) sem cônjuge cadastrado
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  {!o.isPrimary && (
                    <Button size="sm" variant="ghost" title="Tornar principal" disabled={makePrimary.isPending}
                      onClick={() => makePrimary.mutateAsync({ id: o.id, contactId: o.contactId, sharePct: o.sharePct != null ? Number(o.sharePct) : null })
                        .then(() => toast.success('Proprietário principal alterado'))
                        .catch((err) => toast.error(getApiErrorMessage(err)))}>
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-red-600" disabled={remove.isPending}
                    onClick={() => {
                      if (!confirm(`Remover ${o.contact.name} dos proprietários?`)) return;
                      remove.mutateAsync(o.id).then(() => toast.success('Proprietário removido'))
                        .catch((err) => toast.error(getApiErrorMessage(err)));
                    }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto] items-end border-t pt-3">
          <div className="space-y-1">
            <Label className="text-xs">Adicionar proprietário</Label>
            <select className={selectClass} value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">Selecione o contato…</option>
              {options.map((c: { id: string; name: string }) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {contacts.isError && <p className="text-xs text-red-600">{getApiErrorMessage(contacts.error)}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">% (opcional)</Label>
            <Input inputMode="decimal" placeholder="50" value={share} onChange={(e) => setShare(e.target.value)} />
          </div>
          <Button onClick={submit} disabled={add.isPending}>{add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Adicionar'}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Autorização de venda ───────────────────────────────────────────────

export const SITUATION_LABEL: Record<PropertyAuthorization['situation'], string> = {
  ACTIVE: 'Vigente', EXPIRING: 'Vencendo', EXPIRED: 'Vencida', CANCELLED: 'Cancelada',
};
export const SITUATION_CLASS: Record<PropertyAuthorization['situation'], string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  EXPIRING: 'bg-amber-100 text-amber-800',
  EXPIRED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

function useMembers() {
  const ws = useAuthStore((s) => s.currentWorkspaceId);
  return useQuery({
    queryKey: ['workspace-members', ws],
    queryFn: async () =>
      (await api.get('/users/workspace/members')).data.data as Array<{ id: string; user: { name: string } }>,
    enabled: !!ws,
    retry: false,
  });
}

export function AuthorizationPanel({ propertyId }: { propertyId: string }) {
  const list = usePropertyAuthorizations(propertyId);
  const members = useMembers();
  const [form, setForm] = useState({ signedAt: today(), validUntil: '', exclusive: false, commissionRate: '', askingPrice: '', captorUserId: '', notes: '' });
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const inv = ['property-authorizations', 'authorizations-expiring'];
  const create = usePropertyMutation((body: Record<string, unknown>) => api.post(`/properties/${propertyId}/authorizations`, body), inv);
  const cancel = usePropertyMutation(
    ({ id, reason }: { id: string; reason: string }) => api.patch(`/properties/${propertyId}/authorizations/${id}/cancel`, { reason }),
    inv,
  );

  const submit = async () => {
    if (!form.validUntil) return toast.error('Informe a data de validade da autorização.');
    const num = (v: string) => (v ? Number(v.replace(/\./g, '').replace(',', '.')) : undefined);
    try {
      await create.mutateAsync({
        signedAt: form.signedAt,
        validUntil: form.validUntil,
        exclusive: form.exclusive,
        commissionRate: num(form.commissionRate),
        askingPrice: num(form.askingPrice),
        captorUserId: form.captorUserId || undefined,
        notes: form.notes || undefined,
      });
      toast.success('Autorização de venda registrada');
      setForm({ signedAt: today(), validUntil: '', exclusive: false, commissionRate: '', askingPrice: '', captorUserId: '', notes: '' });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Não foi possível registrar a autorização.'));
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Autorização de venda (captação)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {list.isLoading ? <Loading /> : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} compact />
        ) : list.data!.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma autorização registrada para este imóvel.</p>
        ) : (
          <div className="divide-y">
            {list.data!.map((a) => (
              <div key={a.id} className="py-2 text-sm flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SITUATION_CLASS[a.situation]}`}>
                      {SITUATION_LABEL[a.situation]}
                      {a.situation === 'EXPIRING' && a.daysLeft != null && ` — ${a.daysLeft === 0 ? 'vence hoje' : `${a.daysLeft} dia(s)`}`}
                    </span>
                    {a.exclusive && <Badge variant="outline">Exclusiva</Badge>}
                  </div>
                  <p className="mt-1">Assinada em {date(a.signedAt)} · válida até <strong>{date(a.validUntil)}</strong></p>
                  <p className="text-muted-foreground">
                    {a.commissionRate != null && `Comissão ${Number(a.commissionRate)}% · `}
                    {a.askingPrice != null && `Valor autorizado ${brl(a.askingPrice)} · `}
                    Captador: {a.captor?.name ?? '—'}
                  </p>
                  {a.cancelReason && <p className="text-muted-foreground">Motivo do cancelamento: {a.cancelReason}</p>}
                </div>
                {a.situation !== 'CANCELLED' && (
                  <Button size="sm" variant="outline" disabled={cancel.isPending}
                    onClick={() => {
                      const reason = prompt('Motivo do cancelamento da autorização:');
                      if (!reason?.trim()) return;
                      cancel.mutateAsync({ id: a.id, reason }).then(() => toast.success('Autorização cancelada'))
                        .catch((err) => toast.error(getApiErrorMessage(err)));
                    }}>Cancelar</Button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 border-t pt-3">
          <div className="space-y-1"><Label className="text-xs">Assinada em</Label>
            <Input type="date" value={form.signedAt} onChange={(e) => set('signedAt', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Válida até *</Label>
            <Input type="date" value={form.validUntil} onChange={(e) => set('validUntil', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Comissão combinada (%)</Label>
            <Input inputMode="decimal" placeholder="6" value={form.commissionRate} onChange={(e) => set('commissionRate', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Valor autorizado (R$)</Label>
            <Input inputMode="decimal" placeholder="450.000,00" value={form.askingPrice} onChange={(e) => set('askingPrice', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Corretor captador</Label>
            <select className={selectClass} value={form.captorUserId} onChange={(e) => set('captorUserId', e.target.value)} disabled={members.isError}>
              <option value="">{members.isError ? 'Lista de corretores indisponível' : 'Selecione…'}</option>
              {(members.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.user.name}</option>)}
            </select>
            {members.isError && <p className="text-xs text-muted-foreground">{getApiErrorMessage(members.error)}</p>}
          </div>
          <label className="flex items-center gap-2 text-sm mt-6">
            <input type="checkbox" checked={form.exclusive} onChange={(e) => set('exclusive', e.target.checked)} /> Exclusividade
          </label>
          <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Observações</Label>
            <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
          <div className="sm:col-span-2 flex justify-end">
            <Button onClick={submit} disabled={create.isPending}>{create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar autorização'}</Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Dica: anexe a autorização assinada na aba Documentos, tipo &quot;Autorização de venda&quot;.</p>
      </CardContent>
    </Card>
  );
}

// ── Chaves ────────────────────────────────────────────────────────────

export function KeysPanel({ propertyId }: { propertyId: string }) {
  const keys = usePropertyKeys(propertyId);
  const [holderName, setHolderName] = useState('');
  const [keyLabel, setKeyLabel] = useState('');
  const [expected, setExpected] = useState('');
  const move = usePropertyMutation((body: Record<string, unknown>) => api.post(`/properties/${propertyId}/keys`, body), ['property-keys']);

  const doMove = async (action: 'CHECKOUT' | 'RETURN') => {
    try {
      await move.mutateAsync({
        action,
        ...(action === 'CHECKOUT' && { holderName, keyLabel: keyLabel || undefined, expectedReturnAt: expected || undefined }),
      });
      toast.success(action === 'CHECKOUT' ? 'Retirada registrada' : 'Devolução registrada');
      setHolderName('');
      setExpected('');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm flex items-center gap-2"><KeyRound className="h-4 w-4" /> Controle de chaves</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        {keys.isLoading ? <Loading /> : keys.isError ? (
          <ErrorState error={keys.error} onRetry={() => keys.refetch()} compact />
        ) : (
          <>
            <div className={`rounded-md p-3 ${keys.data!.currentlyOut ? 'bg-amber-50 text-amber-900' : 'bg-green-50 text-green-800'}`}>
              {keys.data!.currentlyOut ? (
                <>Chave com <strong>{keys.data!.holder!.name}</strong> desde {dateTime(keys.data!.holder!.since)}
                  {keys.data!.holder!.expectedReturnAt && <> · devolução prevista {dateTime(keys.data!.holder!.expectedReturnAt)}</>}</>
              ) : 'Chave na imobiliária.'}
            </div>
            {keys.data!.currentlyOut ? (
              <Button onClick={() => doMove('RETURN')} disabled={move.isPending}>Registrar devolução</Button>
            ) : (
              <div className="grid gap-2 sm:grid-cols-3 items-end">
                <div className="space-y-1"><Label className="text-xs">Quem retira *</Label>
                  <Input value={holderName} onChange={(e) => setHolderName(e.target.value)} placeholder="Nome" /></div>
                <div className="space-y-1"><Label className="text-xs">Identificação da chave</Label>
                  <Input value={keyLabel} onChange={(e) => setKeyLabel(e.target.value)} placeholder="Jogo 1" /></div>
                <div className="space-y-1"><Label className="text-xs">Devolução prevista</Label>
                  <Input type="datetime-local" value={expected} onChange={(e) => setExpected(e.target.value)} /></div>
                <div className="sm:col-span-3 flex justify-end">
                  <Button onClick={() => doMove('CHECKOUT')} disabled={move.isPending || !holderName.trim()}>Registrar retirada</Button>
                </div>
              </div>
            )}
            {keys.data!.movements.length > 0 && (
              <div className="border-t pt-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">Histórico</p>
                <ul className="space-y-1">
                  {keys.data!.movements.slice(0, 15).map((m) => (
                    <li key={m.id} className="text-xs text-muted-foreground">
                      {dateTime(m.createdAt)} — {m.action === 'CHECKOUT' ? 'Retirada' : 'Devolução'} · {m.holderName}{m.keyLabel ? ` · ${m.keyLabel}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Fotos (upload) ────────────────────────────────────────────────────

export function PhotoUploadButton({ propertyId }: { propertyId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = usePropertyMutation(async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/properties/${propertyId}/photos/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  }, ['property', 'properties']);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    let okCount = 0;
    for (const f of Array.from(files)) {
      try {
        await upload.mutateAsync(f);
        okCount++;
      } catch (err) {
        toast.error(`${f.name}: ${getApiErrorMessage(err, 'falha no envio')}`);
      }
    }
    setBusy(false);
    if (okCount) toast.success(`${okCount} foto(s) enviada(s)`);
    if (input.current) input.current.value = '';
  };

  return (
    <>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
      <Button variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
        Enviar fotos
      </Button>
    </>
  );
}

// ── Documentos ────────────────────────────────────────────────────────

export const DOCUMENT_TYPES: Record<string, string> = {
  MATRICULA: 'Matrícula', IPTU: 'IPTU', CERTIDAO: 'Certidão', AUTORIZACAO_VENDA: 'Autorização de venda',
  PLANTA: 'Planta', HABITE_SE: 'Habite-se', ESCRITURA: 'Escritura', OUTRO: 'Outro',
};

export function DocumentsPanel({ propertyId }: { propertyId: string }) {
  const docs = usePropertyDocuments(propertyId);
  const input = useRef<HTMLInputElement>(null);
  const [type, setType] = useState('MATRICULA');
  const [expiresAt, setExpiresAt] = useState('');
  const upload = usePropertyMutation(async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', type);
    if (expiresAt) fd.append('expiresAt', expiresAt);
    return api.post(`/properties/${propertyId}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  }, ['property-documents']);
  const remove = usePropertyMutation((id: string) => api.delete(`/properties/${propertyId}/documents/${id}`), ['property-documents']);

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      await upload.mutateAsync(file);
      toast.success('Documento enviado');
      setExpiresAt('');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Não foi possível enviar o documento.'));
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Documentos do imóvel</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end">
          <div className="space-y-1"><Label className="text-xs">Tipo</Label>
            <select className={selectClass} value={type} onChange={(e) => setType(e.target.value)}>
              {Object.entries(DOCUMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div className="space-y-1"><Label className="text-xs">Validade (certidões)</Label>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></div>
          <div>
            <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button onClick={() => input.current?.click()} disabled={upload.isPending}>
              {upload.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />} Enviar arquivo
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">PDF, JPG, PNG ou WEBP até 10 MB.</p>

        {docs.isLoading ? <Loading /> : docs.isError ? (
          <ErrorState error={docs.error} onRetry={() => docs.refetch()} compact />
        ) : docs.data!.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum documento enviado.</p>
        ) : (
          <div className="divide-y">
            {docs.data!.map((d) => {
              const expired = d.expiresAt && new Date(d.expiresAt) < new Date();
              return (
                <div key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a href={apiFileUrl(d.url)} target="_blank" rel="noreferrer" className="truncate hover:underline">{d.name}</a>
                    <Badge variant="outline">{DOCUMENT_TYPES[d.type] ?? d.type}</Badge>
                    {d.expiresAt && (
                      <span className={`text-xs ${expired ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {expired ? 'vencido em' : 'válido até'} {date(d.expiresAt)}
                      </span>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" className="text-red-600" disabled={remove.isPending}
                    onClick={() => {
                      if (!confirm(`Remover o documento "${d.name}"?`)) return;
                      remove.mutateAsync(d.id).then(() => toast.success('Documento removido'))
                        .catch((err) => toast.error(getApiErrorMessage(err)));
                    }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Histórico de preço ────────────────────────────────────────────────

export function PriceHistoryPanel({ propertyId }: { propertyId: string }) {
  const h = usePriceHistory(propertyId);
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Histórico de preço</CardTitle></CardHeader>
      <CardContent>
        {h.isLoading ? <Loading /> : h.isError ? (
          <ErrorState error={h.error} onRetry={() => h.refetch()} compact />
        ) : h.data!.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem alterações de preço registradas.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground"><th className="py-1 font-medium">Data</th><th className="py-1 font-medium">Preço</th><th className="py-1 font-medium text-right">De</th><th className="py-1 font-medium text-right">Para</th></tr></thead>
            <tbody className="divide-y">
              {h.data!.map((r) => (
                <tr key={r.id}>
                  <td className="py-1.5">{dateTime(r.createdAt)}</td>
                  <td className="py-1.5">{r.field === 'SALE_PRICE' ? 'Venda' : 'Locação'}</td>
                  <td className="py-1.5 text-right">{brl(r.oldValue)}</td>
                  <td className="py-1.5 text-right font-medium">{brl(r.newValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

// ── Clientes compatíveis ──────────────────────────────────────────────

export function MatchingContactsPanel({ propertyId }: { propertyId: string }) {
  const m = useMatchingContacts(propertyId);
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Clientes com perfil compatível</CardTitle></CardHeader>
      <CardContent>
        {m.isLoading ? <Loading /> : m.isError ? (
          <ErrorState error={m.error} onRetry={() => m.refetch()} compact />
        ) : m.data!.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum cliente com perfil de interesse compatível. Preencha o perfil de interesse no cadastro dos clientes compradores.
          </p>
        ) : (
          <div className="divide-y">
            {m.data!.map((r) => (
              <div key={r.contact.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <Link href={`/contacts/${r.contact.id}`} className="font-medium hover:underline">{r.contact.name}</Link>
                  <p className="text-xs text-muted-foreground">{r.reasons.join(' · ')}</p>
                </div>
                <Badge variant={r.score >= 75 ? 'default' : 'secondary'}>{r.score}%</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
