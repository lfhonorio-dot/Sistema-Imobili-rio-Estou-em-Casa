'use client';
// Boletos e PIX (Fase 5): configuração do Asaas (chave, teste de conexão,
// webhook com token, conta onde o dinheiro cai) e todas as cobranças, com
// envio ao pagador, cancelamento e reemissão (sempre também no Asaas).
// A emissão é feita na conta a receber (Financeiro → A Receber → Cobrar).

import { useState } from 'react';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ErrorState, UnavailableNotice } from '@/components/common/error-state';
import { ChargeCard } from '@/components/finance/charge-panels';
import { getApiErrorMessage } from '@/lib/api-error';
import { apiPublicUrl } from '@/lib/api';
import {
  CHARGE_STATUS, useBankAccounts, useCharges, useGatewayActions, useGateways, useSaveGateway, type Gateway,
} from '@/hooks/use-finance';

const ALL = 'ALL';
const NONE = 'NONE';

function GatewayCard() {
  const gateways = useGateways();
  const accounts = useBankAccounts();
  const save = useSaveGateway();
  const { rotate, test } = useGatewayActions();
  // conta do CNPJ vigente; as de CNPJs anteriores ficam guardadas só para as cobranças antigas
  const asaas: Gateway | undefined = (gateways.data ?? []).find((g) => g.provider === 'ASAAS' && !g.previousCnpj);
  const oldAccounts = (gateways.data ?? []).filter((g) => g.previousCnpj);
  const [apiKey, setApiKey] = useState('');
  const [env, setEnv] = useState<string | null>(null);
  const [acc, setAcc] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const environment = env ?? asaas?.environment ?? 'SANDBOX';
  const account = acc ?? asaas?.settlementBankAccountId ?? NONE;

  const submit = async () => {
    if (!asaas && !apiKey.trim()) return toast.error('Informe a chave de API do Asaas.');
    try {
      await save.mutateAsync({
        ...(asaas ? { id: asaas.id } : { provider: 'ASAAS', name: 'Asaas', isDefault: true }),
        ...(apiKey.trim() && { apiKey: apiKey.trim() }),
        environment,
        settlementBankAccountId: account === NONE ? '' : account,
      });
      setApiKey('');
      toast.success(asaas ? 'Configuração salva.' : 'Asaas cadastrado. Agora gere o token do webhook e teste a conexão.');
    } catch (err) { toast.error(getApiErrorMessage(err)); }
  };
  const doTest = async () => {
    if (!asaas) return;
    try { const r = await test.mutateAsync(asaas.id); toast.success(`Conexão com o Asaas OK (${r.environment === 'PRODUCTION' ? 'produção' : 'sandbox'}).`); }
    catch (err) { toast.error(getApiErrorMessage(err)); }
  };
  const doRotate = async () => {
    if (!asaas) return;
    if (asaas.hasWebhookToken && !confirm('Gerar um novo token? O antigo deixa de valer: você precisará atualizar no Asaas.')) return;
    try { const r = await rotate.mutateAsync(asaas.id); setToken(r.webhookToken); toast.success('Token gerado. Copie e cole no Asaas.'); }
    catch (err) { toast.error(getApiErrorMessage(err)); }
  };
  const toggleActive = async () => {
    if (!asaas) return;
    try { await save.mutateAsync({ id: asaas.id, isActive: !asaas.isActive }); toast.success(asaas.isActive ? 'Gateway desativado.' : 'Gateway ativado.'); }
    catch (err) { toast.error(getApiErrorMessage(err)); }
  };
  const copy = (t: string, l: string) => { void navigator.clipboard.writeText(t); toast.success(`${l} copiado.`); };

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Gateway Asaas</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        {gateways.isLoading ? <Skeleton className="h-20 w-full" /> : gateways.isError ? (
          <ErrorState error={gateways.error} onRetry={() => gateways.refetch()} compact />
        ) : (
          <>
            <p className="text-muted-foreground">
              {asaas
                ? <>Situação: <b className={asaas.isActive ? 'text-green-700' : 'text-red-700'}>{asaas.isActive ? 'ativo' : 'desativado'}</b> · ambiente {asaas.environment === 'PRODUCTION' ? 'produção' : 'sandbox (teste)'}</>
                : oldAccounts.length
                  ? <span className="text-amber-800">O CNPJ da empresa mudou: cadastre a conta Asaas aberta no <b>novo CNPJ</b> para emitir cobranças novas.</span>
                  : 'Nenhum gateway cadastrado: boleto e PIX ficam indisponíveis até você cadastrar a chave do Asaas.'}
            </p>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="space-y-1 md:col-span-1"><Label>Chave de API {asaas && '(deixe vazio para manter)'}</Label>
                <Input type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="$aact_..." /></div>
              <div className="space-y-1"><Label>Ambiente</Label>
                <Select value={environment} onValueChange={setEnv}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="SANDBOX">Sandbox (teste)</SelectItem><SelectItem value="PRODUCTION">Produção</SelectItem></SelectContent>
                </Select></div>
              <div className="space-y-1"><Label>Conta onde o Asaas deposita</Label>
                <Select value={account} onValueChange={setAcc}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Não informar</SelectItem>
                    {(accounts.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={save.isPending} onClick={() => void submit()}>{asaas ? 'Salvar' : 'Cadastrar Asaas'}</Button>
              {asaas && <Button variant="outline" disabled={test.isPending} onClick={() => void doTest()}>{test.isPending ? 'Testando...' : 'Testar conexão'}</Button>}
              {asaas && <Button variant="outline" onClick={() => void toggleActive()}>{asaas.isActive ? 'Desativar' : 'Ativar'}</Button>}
            </div>
            {oldAccounts.length > 0 && (
              <div className="rounded-md border border-dashed p-3 space-y-1">
                <p className="font-medium">Contas do CNPJ anterior</p>
                <p className="text-xs text-muted-foreground">Ficam guardadas só para receber os avisos de pagamento e cancelar as cobranças emitidas nelas. Não emitem cobranças novas. Mantenha o webhook delas ligado no Asaas até a última cobrança antiga ser paga ou cancelada.</p>
                {oldAccounts.map((g) => (
                  <p key={g.id} className="text-xs">{g.name} · {g.environment === 'PRODUCTION' ? 'produção' : 'sandbox'} · webhook {g.hasWebhookToken ? 'configurado' : <span className="text-red-700">sem token</span>}</p>
                ))}
              </div>
            )}
            {asaas && (
              <div className="rounded-md border p-3 space-y-2">
                <p className="font-medium">Baixa automática (webhook)</p>
                <p className="text-xs text-muted-foreground">No Asaas: Integrações → Webhooks → adicionar. Cole o endereço e o token abaixo e marque os eventos de cobrança (recebida, confirmada, vencida, removida, estornada).</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded bg-gray-100 p-2 text-xs">{apiPublicUrl(asaas.webhookPath)}</code>
                  <Button size="sm" variant="outline" onClick={() => copy(apiPublicUrl(asaas.webhookPath), 'Endereço')}><Copy className="h-4 w-4" /></Button>
                </div>
                {token ? (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 break-all rounded bg-amber-50 p-2 text-xs">{token}</code>
                    <Button size="sm" variant="outline" onClick={() => copy(token, 'Token')}><Copy className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <p className="text-xs">{asaas.hasWebhookToken ? 'Token já configurado (por segurança, não é mostrado de novo).' : <span className="text-red-700">Sem token: o sistema recusa os avisos do Asaas até você gerar um.</span>}</p>
                )}
                <Button size="sm" variant="outline" disabled={rotate.isPending} onClick={() => void doRotate()}>{asaas.hasWebhookToken ? 'Gerar novo token' : 'Gerar token'}</Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function BillingPage() {
  const [status, setStatus] = useState(ALL);
  const [kind, setKind] = useState(ALL);
  const [page, setPage] = useState(1);
  const gateways = useGateways();
  const charges = useCharges({ page, limit: 20, ...(status !== ALL && { status }), ...(kind !== ALL && { kind }) });
  const hasAsaas = (gateways.data ?? []).some((g) => g.provider === 'ASAAS' && g.isActive);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Boletos e PIX</h1>
        <p className="text-sm text-gray-500 mt-1">Para cobrar, abra a conta em Financeiro → A Receber e clique em &quot;Cobrar&quot;. A baixa é automática quando o pagador paga.</p>
      </div>

      <GatewayCard />
      {gateways.data && !hasAsaas && (
        <UnavailableNotice title="Emissão de boleto e PIX não disponível">
          Sem gateway Asaas ativo o sistema não emite cobranças. Registre os recebimentos manualmente em Financeiro → A Receber.
        </UnavailableNotice>
      )}

      <div className="flex flex-wrap gap-2">
        <Select value={kind} onValueChange={(v) => { setPage(1); setKind(v); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>Boleto e PIX</SelectItem><SelectItem value="BOLETO">Só boletos</SelectItem><SelectItem value="PIX">Só PIX</SelectItem></SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setPage(1); setStatus(v); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as situações</SelectItem>
            {Object.entries(CHARGE_STATUS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {charges.isLoading ? <Skeleton className="h-40 w-full" /> : charges.isError ? (
        <Card><ErrorState error={charges.error} onRetry={() => charges.refetch()} /></Card>
      ) : (charges.data?.items ?? []).length === 0 ? (
        <p className="text-center py-12 text-gray-400">Nenhuma cobrança com esses filtros.</p>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-3">
            {charges.data!.items.map((c) => (
              <div key={c.id} className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {c.contactName ?? 'Pagador não informado'}{c.description ? ` · ${c.description}` : ''}
                  {!c.gatewayBoletoId && ' · simulado antigo, sem validade bancária'}
                </p>
                <ChargeCard charge={c} compact />
              </div>
            ))}
          </div>
          {charges.data!.meta.pages > 1 && (
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Página {page} de {charges.data!.meta.pages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={page >= charges.data!.meta.pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
