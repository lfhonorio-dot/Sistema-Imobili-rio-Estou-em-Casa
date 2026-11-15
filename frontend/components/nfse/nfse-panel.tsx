'use client';

// Fase 6 — tela "Notas Fiscais": lista com filtros e ações (XML, PDF,
// e-mail ao tomador, cancelar, reenviar), relatório mensal do contador e
// configuração fiscal (dados do prestador, alíquotas, retenções, certificado
// digital, ambiente de homologação/produção).

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Download, FileText, Mail, RotateCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ErrorState } from '@/components/common/error-state';
import { getApiErrorMessage } from '@/lib/api-error';
import { apiFileUrl } from '@/lib/api';
import { brl, downloadXlsx, parseMoney } from '@/hooks/use-finance';
import {
  NFSE_STATUS_STYLE, useNfseActions, useNfseConfig, useNfseConfigActions, useNfseList, useNfseReport, type Nfse, type NfseConfig,
} from '@/hooks/use-nfse';

const ALL = 'ALL';
const dt = (v?: string | null) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—');
const run = async (p: Promise<unknown>, ok: string) => {
  try { await p; toast.success(ok); return true; } catch (err) { toast.error(getApiErrorMessage(err)); return false; }
};

function NotesList() {
  const [status, setStatus] = useState(ALL);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useNfseList({ page, limit: 20, ...(status !== ALL && { status }), ...(search.trim() && { search: search.trim() }) });
  const a = useNfseActions();

  const cancel = async (n: Nfse) => {
    const code = window.prompt('Motivo oficial do cancelamento — digite 1 (erro na emissão), 2 (serviço não prestado) ou 4 (duplicidade):', '1');
    if (!code) return;
    const reason = window.prompt('Explique o motivo (fica registrado):');
    if (!reason?.trim()) return;
    await run(a.cancel.mutateAsync({ id: n.id, reason, code: code.trim() }), 'Nota cancelada.');
  };
  const email = async (n: Nfse) => {
    const to = window.prompt('Enviar PDF e XML para o e-mail:', n.takerEmail ?? '');
    if (!to?.trim()) return;
    await run(a.email.mutateAsync({ id: n.id, to: to.trim() }), `Enviada para ${to}.`);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select value={status} onValueChange={(v) => { setPage(1); setStatus(v); }}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as situações</SelectItem>
            <SelectItem value="QUEUED">Na fila</SelectItem>
            <SelectItem value="AUTHORIZED">Autorizadas</SelectItem>
            <SelectItem value="REJECTED">Rejeitadas</SelectItem>
            <SelectItem value="ERROR">Falha de comunicação</SelectItem>
            <SelectItem value="CANCELLED">Canceladas</SelectItem>
          </SelectContent>
        </Select>
        <Input className="w-64" placeholder="Buscar tomador, número ou descrição" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
      </div>
      <p className="text-xs text-muted-foreground">Para emitir, abra a conta em Financeiro → A Receber → Detalhes → &quot;Emitir NF&quot;.</p>
      {q.isLoading ? <Skeleton className="h-40 w-full" /> : q.isError ? <Card><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card>
        : (q.data?.items ?? []).length === 0 ? <p className="py-10 text-center text-gray-400">Nenhuma nota fiscal.</p> : (
        <div className="space-y-2">
          {q.data!.items.map((n) => {
            const legacy = n.status === 'ISSUED' && !n.number;
            return (
              <div key={n.id} className="rounded-lg border bg-white p-3 text-sm space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {n.number ? `NFS-e nº ${n.number}` : `RPS ${n.rpsSerie ?? ''}-${n.rpsNumber ?? '—'}`} · {n.takerName}
                    {n.environment === 'HOMOLOG' && <span className="ml-2 rounded bg-blue-50 px-1.5 text-xs text-blue-700">homologação</span>}
                    {n.autoIssued && <span className="ml-2 rounded bg-gray-100 px-1.5 text-xs">automática</span>}
                  </span>
                  <span className={`text-xs rounded-full px-2 py-0.5 ${legacy ? 'bg-gray-100 text-gray-600' : NFSE_STATUS_STYLE[n.status] ?? 'bg-gray-100'}`}>
                    {legacy ? 'Registro interno — não emitida' : n.statusLabel}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  {brl(n.baseAmount ?? n.amount)} · ISS {brl(n.issDue ?? 0)}{Number(n.totalRetained) ? ` · retenções ${brl(n.totalRetained)} · líquido ${brl(n.netAmount)}` : ''}
                  {' · '}{n.issuedAt ? `emitida ${dt(n.issuedAt)}` : `pedida ${dt(n.createdAt)}`}
                </p>
                {n.rejectionReason && <p className={n.status === 'QUEUED' ? 'text-amber-700' : 'text-red-700'}>{n.rejectionReason}</p>}
                {n.retentionWarning && <p className="text-amber-700">{n.retentionWarning}</p>}
                {n.cancelReason && <p className="text-muted-foreground">Cancelada: {n.cancelReason}</p>}
                <div className="flex flex-wrap gap-2 pt-1">
                  {n.pdfDownloadUrl && <a href={apiFileUrl(n.pdfDownloadUrl)} target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><FileText className="h-4 w-4 mr-1" />PDF</Button></a>}
                  {n.xmlDownloadUrl && <a href={apiFileUrl(n.xmlDownloadUrl)} target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><Download className="h-4 w-4 mr-1" />XML</Button></a>}
                  {n.status === 'AUTHORIZED' && <Button size="sm" variant="outline" disabled={a.email.isPending} onClick={() => void email(n)}><Mail className="h-4 w-4 mr-1" />E-mail{n.emailedAt ? ' (enviado)' : ''}</Button>}
                  {['REJECTED', 'ERROR'].includes(n.status) && <Button size="sm" variant="outline" disabled={a.retry.isPending} onClick={() => void run(a.retry.mutateAsync(n.id), 'Nota reenviada.')}><RotateCw className="h-4 w-4 mr-1" />Reenviar</Button>}
                  {['AUTHORIZED', 'QUEUED', 'REJECTED', 'ERROR'].includes(n.status) && !legacy && <Button size="sm" variant="outline" className="text-red-600" disabled={a.cancel.isPending} onClick={() => void cancel(n)}><XCircle className="h-4 w-4 mr-1" />Cancelar</Button>}
                </div>
              </div>
            );
          })}
          {q.data!.meta.pages > 1 && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page >= q.data!.meta.pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AccountantReport() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const r = useNfseReport(month);
  const [busy, setBusy] = useState(false);
  const t = r.data?.totals;
  const rows: Array<[string, number | undefined]> = t ? [
    ['Base de cálculo (notas válidas)', t.base], ['ISS devido', t.issDue], ['ISS retido pelo tomador', t.issRetained], ['IR retido', t.irRetained],
    ['PIS retido', t.pisRetained], ['COFINS retido', t.cofinsRetained], ['CSLL retido', t.csllRetained], ['Total retido', t.totalRetained], ['Líquido', t.net],
  ] : [];
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-end gap-2">
        <div className="space-y-1"><Label className="text-xs">Mês</Label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
        <Button variant="outline" className="ml-auto" disabled={busy || !r.data} onClick={async () => {
          setBusy(true);
          try { await downloadXlsx('/nfse/report/export', { month }, `nfse-${month}.xlsx`); } catch (err) { toast.error(getApiErrorMessage(err)); } finally { setBusy(false); }
        }}><Download className="h-4 w-4 mr-1" />{busy ? 'Gerando...' : 'Exportar Excel para o contador'}</Button>
      </div>
      {r.isLoading ? <Skeleton className="h-32 w-full" /> : r.isError ? <ErrorState error={r.error} onRetry={() => r.refetch()} /> : r.data && (
        <>
          {r.data.environment !== 'PRODUCTION' && <p className="text-xs text-blue-700">Ambiente de homologação: notas de teste, sem valor fiscal.</p>}
          <p>{t!.count} nota(s) válida(s){t!.cancelled ? ` e ${t!.cancelled} cancelada(s)` : ''} em {month}.</p>
          <div className="grid md:grid-cols-2 gap-4">
            <table className="w-full rounded border"><tbody className="divide-y">
              {rows.map(([k, v]) => <tr key={k}><td className="px-3 py-1.5">{k}</td><td className="px-3 py-1.5 text-right font-medium">{brl(v)}</td></tr>)}
            </tbody></table>
            <div className="rounded border p-3 space-y-1">
              <p className="font-medium">Estimativa de tributos (Lucro Presumido)</p>
              <p>PIS {brl(r.data.estimate.pis)} · COFINS {brl(r.data.estimate.cofins)}</p>
              <p>IRPJ {brl(r.data.estimate.irpj)} · CSLL {brl(r.data.estimate.csll)} (base presumida)</p>
              <p className="text-xs text-muted-foreground">Calculado com as alíquotas da configuração, só para conferência. O contador apura os valores oficiais.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const pctNum = (v: unknown) => String(Number(v ?? 0)).replace('.', ',');

function ConfigPanel() {
  const q = useNfseConfig();
  const a = useNfseConfigActions();
  const [f, setF] = useState<Record<string, string | boolean>>({});
  const [file, setFile] = useState<File | null>(null);
  const [pwd, setPwd] = useState('');
  useEffect(() => {
    const c = q.data;
    if (!c) return;
    setF({
      razaoSocial: c.razaoSocial ?? '', cnpj: c.cnpj ?? '', inscricaoMunicipal: c.inscricaoMunicipal ?? '', itemListaServico: c.itemListaServico ?? '',
      codigoTributacaoMunicipio: c.codigoTributacaoMunicipio ?? '', cnae: c.cnae ?? '',
      aliquotaISS: pctNum(c.aliquotaISS), aliquotaPIS: pctNum(c.aliquotaPIS), aliquotaCOFINS: pctNum(c.aliquotaCOFINS), aliquotaIRPJ: pctNum(c.aliquotaIRPJ),
      aliquotaCSLL: pctNum(c.aliquotaCSLL), presumidoIRPJ: pctNum(c.presumidoIRPJ), presumidoCSLL: pctNum(c.presumidoCSLL),
      retentionsEnabled: c.retentionsEnabled, retIrPct: pctNum(c.retIrPct), retPisPct: pctNum(c.retPisPct), retCofinsPct: pctNum(c.retCofinsPct),
      retCsllPct: pctNum(c.retCsllPct), retMinAmount: pctNum(c.retMinAmount), retainIssWhenPj: c.retainIssWhenPj, autoIssueOnReceipt: c.autoIssueOnReceipt,
      rpsSerie: c.rpsSerie, rpsNextNumber: String(c.rpsNextNumber), nfseWsUrlHomolog: c.nfseWsUrlHomolog ?? '', nfseWsUrlProd: c.nfseWsUrlProd ?? '',
      optanteSimples: c.optanteSimples, incentivoFiscal: c.incentivoFiscal,
    });
  }, [q.data]);
  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const c = q.data as NfseConfig;
  const s = (k: string) => String(f[k] ?? '');
  const field = (k: string, label: string, ph = '') => (
    <div className="space-y-1"><Label htmlFor={`nf-${k}`} className="text-xs">{label}</Label><Input id={`nf-${k}`} value={s(k)} placeholder={ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );
  const check = (k: string, label: string) => (
    <label className="flex items-center gap-2"><input type="checkbox" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} />{label}</label>
  );
  const save = () => {
    const pct = ['aliquotaISS', 'aliquotaPIS', 'aliquotaCOFINS', 'aliquotaIRPJ', 'aliquotaCSLL', 'presumidoIRPJ', 'presumidoCSLL', 'retIrPct', 'retPisPct', 'retCofinsPct', 'retCsllPct', 'retMinAmount'];
    const dto: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(f)) {
      if (pct.includes(k)) {
        const n = parseMoney(String(v));
        if (Number.isNaN(n)) return toast.error(`Valor inválido em ${k}.`);
        dto[k] = n;
      } else if (k === 'rpsNextNumber') {
        if (Number(v) !== c.rpsNextNumber) dto[k] = Number(v);
      } else dto[k] = typeof v === 'string' ? v.trim() : v;
    }
    void run(a.save.mutateAsync(dto), 'Configuração fiscal salva.');
  };
  const sendCert = async () => {
    if (!file || !pwd) return toast.error('Escolha o arquivo .pfx e informe a senha.');
    if (await run(a.uploadCert.mutateAsync({ file, password: pwd }), 'Certificado instalado.')) { setFile(null); setPwd(''); }
  };
  const authorize = async () => {
    const t = window.prompt('ATENÇÃO: a partir daqui as notas são REAIS (valor fiscal). Para confirmar, digite: AUTORIZO NOTAS REAIS');
    if (t) await run(a.authorizeProduction.mutateAsync(t), 'Notas reais autorizadas: ambiente de produção ligado.');
  };

  return (
    <div className="space-y-4 text-sm">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Situação</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p>Provedor: <b>SIL Tecnologia (ABRASF 2.04)</b> · Prefeitura de Franca · Regime: <b>{c.regime === 'LUCRO_PRESUMIDO' ? 'Lucro Presumido' : c.regime}</b></p>
          <p>Ambiente: <b className={c.nfseEnvironment === 'PRODUCTION' ? 'text-red-700' : 'text-blue-700'}>{c.nfseEnvironment === 'PRODUCTION' ? 'PRODUÇÃO — notas reais' : 'Homologação (teste, sem valor fiscal)'}</b>
            {c.effectiveWsUrl ? <span className="text-xs text-muted-foreground"> · {c.effectiveWsUrl}</span> : null}</p>
          {c.readiness.ready ? <p className="text-green-700">Pronto para emitir.</p> : <p className="text-red-700">Falta: {c.readiness.missing.join(', ')}.</p>}
          <div className="flex gap-2">
            {c.nfseEnvironment === 'HOMOLOG'
              ? <Button size="sm" variant="outline" className="text-red-700" disabled={a.authorizeProduction.isPending} onClick={() => void authorize()}>Autorizar notas reais (produção)</Button>
              : <Button size="sm" variant="outline" onClick={() => void run(a.backToHomolog.mutateAsync(), 'Voltou para homologação.')}>Voltar para homologação</Button>}
          </div>
          {c.productionAuthorizedAt && <p className="text-xs text-muted-foreground">Notas reais autorizadas em {new Date(c.productionAuthorizedAt).toLocaleString('pt-BR')}.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Certificado digital A1 (e-CNPJ)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {c.hasCertificate
            ? <p>{c.certSubject} · válido até <b className={c.certificateExpired ? 'text-red-700' : ''}>{dt(c.certValidUntil)}</b></p>
            : <p className="text-muted-foreground">Nenhum certificado instalado. Ele é guardado criptografado e usado só para assinar as notas.</p>}
          <div className="flex flex-wrap items-end gap-2">
            <Input type="file" accept=".pfx,.p12" className="max-w-xs" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Input type="password" autoComplete="new-password" placeholder="Senha do certificado" className="max-w-[200px]" value={pwd} onChange={(e) => setPwd(e.target.value)} />
            <Button size="sm" disabled={a.uploadCert.isPending} onClick={() => void sendCert()}>{c.hasCertificate ? 'Trocar certificado' : 'Instalar certificado'}</Button>
            {c.hasCertificate && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => { if (confirm('Remover o certificado? A emissão para até instalar outro.')) void run(a.removeCert.mutateAsync(), 'Certificado removido.'); }}>Remover</Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Prestador e serviço</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3">
          {field('razaoSocial', 'Razão social')}{field('cnpj', 'CNPJ')}{field('inscricaoMunicipal', 'Inscrição municipal (Franca)')}
          {field('itemListaServico', 'Item da LC 116', 'ex.: 10.05')}{field('codigoTributacaoMunicipio', 'Código de tributação do município')}{field('cnae', 'CNAE')}
          {field('rpsSerie', 'Série do RPS')}{field('rpsNextNumber', 'Próximo número de RPS')}
          <div className="space-y-2 pt-5">{check('optanteSimples', 'Optante pelo Simples')}{check('incentivoFiscal', 'Incentivo fiscal')}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Alíquotas (%) — Lucro Presumido</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-3">
          {field('aliquotaISS', 'ISS em Franca')}{field('aliquotaPIS', 'PIS')}{field('aliquotaCOFINS', 'COFINS')}{field('aliquotaIRPJ', 'IRPJ')}
          {field('aliquotaCSLL', 'CSLL')}{field('presumidoIRPJ', 'Presunção IRPJ')}{field('presumidoCSLL', 'Presunção CSLL')}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Retenções na fonte (tomador pessoa jurídica)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {check('retentionsEnabled', 'Reter IR, PIS, COFINS e CSLL quando o tomador for PJ')}
          <div className="grid md:grid-cols-5 gap-3">
            {field('retIrPct', 'IR (%)')}{field('retPisPct', 'PIS (%)')}{field('retCofinsPct', 'COFINS (%)')}{field('retCsllPct', 'CSLL (%)')}{field('retMinAmount', 'Não reter abaixo de (R$)')}
          </div>
          {check('retainIssWhenPj', 'ISS retido pelo tomador PJ')}
          <p className="text-xs text-muted-foreground">Confirme estes percentuais com o contador. Com retenção, a conta a receber passa a esperar o valor líquido.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Emissão e webservice</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {check('autoIssueOnReceipt', 'Emitir a nota automaticamente quando uma comissão for recebida (vale a partir de agora)')}
          <div className="grid md:grid-cols-2 gap-3">
            {field('nfseWsUrlHomolog', 'Webservice de HOMOLOGAÇÃO da SIL', 'informado pela SIL/prefeitura')}
            {field('nfseWsUrlProd', 'Webservice de PRODUÇÃO (padrão: SIL Franca)', 'https://franca.siltecnologia.com.br/services/Abrasf24')}
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end"><Button disabled={a.save.isPending} onClick={save}>{a.save.isPending ? 'Salvando...' : 'Salvar configuração fiscal'}</Button></div>
    </div>
  );
}

export function NfsePanel({ initialSub }: { initialSub?: string | null }) {
  const [sub, setSub] = useState(initialSub === 'config' || initialSub === 'report' ? initialSub : 'notes');
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([['notes', 'Notas'], ['report', 'Relatório do contador'], ['config', 'Configuração fiscal']] as const).map(([k, l]) => (
          <Button key={k} size="sm" variant={sub === k ? 'default' : 'outline'} onClick={() => setSub(k)}>{l}</Button>
        ))}
      </div>
      {sub === 'notes' && <NotesList />}
      {sub === 'report' && <AccountantReport />}
      {sub === 'config' && <ConfigPanel />}
    </div>
  );
}
