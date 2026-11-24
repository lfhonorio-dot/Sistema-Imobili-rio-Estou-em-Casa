'use client';

// Dados legais da empresa (CNPJ, razão social...) com histórico.
// Trocar CNPJ ou razão social NÃO sobrescreve: encerra o registro atual e
// abre outro a partir da data escolhida. Documentos já emitidos continuam
// com os dados da data em que foram emitidos.

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Circle, History, Loader2, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorState } from '@/components/common/error-state';

interface LegalEntity {
  id: string;
  cnpj: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  inscricaoMunicipal: string | null;
  endereco: string | null;
  regimeTributario: string | null;
  validFrom: string;
  validTo: string | null;
  hasArchivedCertificate?: boolean;
}
interface ChecklistItem { key: string; label: string; help: string; done: boolean; auto: boolean }
interface IssuerData {
  current: LegalEntity | null;
  history: LegalEntity[];
  checklist: { applies: boolean; previousCnpj: string | null; items: ChecklistItem[] };
}

const digits = (v?: string | null) => (v ?? '').replace(/\D/g, '');
export const fmtCnpj = (v?: string | null) => {
  const d = digits(v);
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : v || '—';
};
// o primeiro registro vale "desde o início" (não há histórico anterior ao sistema)
const fmtFrom = (iso: string) => (iso.startsWith('2000-01-01') ? 'o início' : new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const today = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const REGIMES: Record<string, string> = { SIMPLES: 'Simples Nacional', LUCRO_PRESUMIDO: 'Lucro Presumido', LUCRO_REAL: 'Lucro Real', MEI: 'MEI' };

export function CompanyLegalCard({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['issuer'],
    queryFn: async () => (await api.get<{ data: IssuerData }>('/issuer')).data.data,
  });
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const toggle = useMutation({
    mutationFn: async (v: { key: string; done: boolean }) => (await api.put('/issuer/checklist', v)).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['issuer'] }),
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível marcar o item.')),
  });

  if (q.isLoading) return <Card><CardContent className="py-6 text-sm text-muted-foreground">Carregando dados da empresa…</CardContent></Card>;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const data = q.data!;
  const cur = data.current;
  const pending = data.checklist.items.filter((i) => !i.done).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Dados legais da empresa</CardTitle>
          <CardDescription>
            Aparecem em contratos, notas fiscais, boletos, recibos e na DIMOB. Cada documento guarda uma cópia destes
            dados no dia em que é emitido: trocar depois não altera documentos antigos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            <div><span className="text-muted-foreground">CNPJ</span><p className="font-medium font-mono">{fmtCnpj(cur?.cnpj)}</p></div>
            <div><span className="text-muted-foreground">Razão social</span><p className="font-medium">{cur?.razaoSocial || '—'}</p></div>
            <div><span className="text-muted-foreground">Nome fantasia</span><p>{cur?.nomeFantasia || '—'}</p></div>
            <div><span className="text-muted-foreground">Inscrição municipal</span><p>{cur?.inscricaoMunicipal || '—'}</p></div>
            <div><span className="text-muted-foreground">Regime tributário</span><p>{REGIMES[cur?.regimeTributario ?? ''] ?? (cur?.regimeTributario || '—')}</p></div>
            <div><span className="text-muted-foreground">Vigente desde</span><p>{cur ? fmtFrom(cur.validFrom) : '—'}</p></div>
          </div>
          <p className="text-xs text-muted-foreground">
            Nome, endereço e telefone se editam normalmente no formulário abaixo. CNPJ e razão social vazios podem ser
            preenchidos lá ou na configuração fiscal; para <b>trocar</b>, use o botão ao lado.
          </p>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
                <RefreshCw className="mr-2 h-4 w-4" />Trocar CNPJ ou razão social
              </Button>
            )}
            {data.history.length > 1 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowHistory((v) => !v)}>
                <History className="mr-2 h-4 w-4" />{showHistory ? 'Esconder histórico' : `Ver histórico (${data.history.length})`}
              </Button>
            )}
          </div>
          {showHistory && (
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50"><tr><th className="p-2 text-left">Período</th><th className="p-2 text-left">CNPJ</th><th className="p-2 text-left">Razão social</th><th className="p-2 text-left">Certificado antigo</th></tr></thead>
                <tbody>
                  {data.history.map((h) => (
                    <tr key={h.id} className="border-t">
                      <td className="p-2 whitespace-nowrap">de {fmtFrom(h.validFrom)} {h.validTo ? `até ${fmtDate(new Date(new Date(h.validTo).getTime() - 864e5).toISOString())}` : '(atual)'}</td>
                      <td className="p-2 font-mono">{fmtCnpj(h.cnpj)}</td>
                      <td className="p-2">{h.razaoSocial || '—'}</td>
                      <td className="p-2">{h.validTo ? (h.hasArchivedCertificate ? 'guardado (para cancelar notas antigas)' : '—') : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {data.checklist.applies && (
        <Card className={pending ? 'border-amber-300' : 'border-green-300'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {pending ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
              O CNPJ mudou: confira o que precisa ser refeito {pending ? <Badge variant="outline">{pending} pendente(s)</Badge> : <Badge variant="outline">tudo certo</Badge>}
            </CardTitle>
            <CardDescription>CNPJ anterior: {fmtCnpj(data.checklist.previousCnpj)}. Os itens marcados com "conferido pelo sistema" se marcam sozinhos.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {data.checklist.items.map((i) => (
                <li key={i.key} className="flex gap-3">
                  {i.auto ? (
                    i.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" /> : <Circle className="h-5 w-5 shrink-0 text-amber-600" />
                  ) : (
                    <input type="checkbox" aria-label={i.label} className="mt-1 h-4 w-4 shrink-0" checked={i.done} disabled={!canEdit || toggle.isPending}
                      onChange={(e) => toggle.mutate({ key: i.key, done: e.target.checked })} />
                  )}
                  <div>
                    <p className="font-medium">{i.label} {i.auto && <span className="text-xs font-normal text-muted-foreground">(conferido pelo sistema)</span>}</p>
                    <p className="text-muted-foreground">{i.help}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {open && cur && <ChangeDialog current={cur} onClose={() => setOpen(false)} />}
    </div>
  );
}

function ChangeDialog({ current, onClose }: { current: LegalEntity; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    cnpj: fmtCnpj(current.cnpj) === '—' ? '' : fmtCnpj(current.cnpj),
    razaoSocial: current.razaoSocial ?? '',
    nomeFantasia: current.nomeFantasia ?? '',
    inscricaoMunicipal: '',
    endereco: current.endereco ?? '',
    validFrom: today(),
  });
  const [confirmed, setConfirmed] = useState(false);
  const cnpjChanged = digits(f.cnpj) !== digits(current.cnpj);
  const nameChanged = f.razaoSocial.trim() !== (current.razaoSocial ?? '');
  const changed = cnpjChanged || nameChanged;
  const fromLabel = useMemo(() => (f.validFrom ? new Date(`${f.validFrom}T12:00:00`).toLocaleDateString('pt-BR') : ''), [f.validFrom]);

  const m = useMutation({
    mutationFn: async () => (await api.post('/issuer/change', {
      cnpj: f.cnpj, razaoSocial: f.razaoSocial.trim(), validFrom: f.validFrom,
      ...(f.nomeFantasia.trim() && { nomeFantasia: f.nomeFantasia.trim() }),
      ...(f.inscricaoMunicipal.trim() && { inscricaoMunicipal: f.inscricaoMunicipal.trim() }),
      ...(f.endereco.trim() && { endereco: f.endereco.trim() }),
    })).data,
    onSuccess: () => {
      toast.success(cnpjChanged ? 'CNPJ trocado. Veja abaixo o que precisa ser refeito.' : 'Razão social trocada.');
      for (const k of ['issuer', 'workspace', 'nfse-config']) void qc.invalidateQueries({ queryKey: [k] });
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível trocar os dados da empresa.')),
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Trocar CNPJ ou razão social</DialogTitle>
          <DialogDescription>
            Os dados atuais ficam guardados no histórico. Contratos, notas, boletos e recibos já emitidos continuam com
            eles; o que for emitido a partir de agora sai com os novos.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="lc-cnpj">CNPJ</Label><Input id="lc-cnpj" value={f.cnpj} onChange={set('cnpj')} placeholder="00.000.000/0001-00" /></div>
            <div className="space-y-1"><Label htmlFor="lc-from">Vale a partir de</Label><Input id="lc-from" type="date" max={today()} value={f.validFrom} onChange={set('validFrom')} /></div>
          </div>
          <div className="space-y-1"><Label htmlFor="lc-rs">Razão social</Label><Input id="lc-rs" value={f.razaoSocial} onChange={set('razaoSocial')} /></div>
          <div className="space-y-1"><Label htmlFor="lc-nf">Nome fantasia (opcional)</Label><Input id="lc-nf" value={f.nomeFantasia} onChange={set('nomeFantasia')} /></div>
          {cnpjChanged && (
            <div className="space-y-1"><Label htmlFor="lc-im">Inscrição municipal do novo CNPJ (se já tiver)</Label><Input id="lc-im" value={f.inscricaoMunicipal} onChange={set('inscricaoMunicipal')} /></div>
          )}
          <div className="space-y-1"><Label htmlFor="lc-end">Endereço</Label><Input id="lc-end" value={f.endereco} onChange={set('endereco')} /></div>

          {cnpjChanged && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
              <p className="font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Atenção: CNPJ novo é outra empresa para bancos, prefeitura e Receita.</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Cobranças novas só saem depois de cadastrar a conta Asaas do novo CNPJ. A conta antiga fica guardada para baixar e cancelar as cobranças já emitidas.</li>
                <li>Notas fiscais param até instalar o certificado digital do novo CNPJ; a emissão volta para homologação. O certificado antigo fica guardado para cancelar notas antigas.</li>
                <li>Revise contas bancárias, WhatsApp Business e modelos de contrato.</li>
                <li>Na DIMOB, operações a partir de {fromLabel || 'a data escolhida'} vão para o novo CNPJ (um arquivo por CNPJ).</li>
              </ul>
              <label className="flex items-center gap-2"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />Entendi e quero trocar o CNPJ a partir de {fromLabel}.</label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="button" disabled={!changed || (cnpjChanged && !confirmed) || !f.validFrom || m.isPending} onClick={() => m.mutate()}>
            {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar troca
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
