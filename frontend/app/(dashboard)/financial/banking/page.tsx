'use client';
// Bancário (Fase 5): contas com saldo inicial, importação de extrato (OFX,
// CSV ou Excel), conciliação ligada às contas a pagar/receber (gera a baixa
// de verdade) e razão bancário com saldo acumulado.

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Upload, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ErrorState } from '@/components/common/error-state';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  brl, dmy, parseMoney, useBankAccounts, useBankingActions, useBankTransactions, useLedger, useReconcileSuggestions,
  useSaveBankAccount, type BankAccount, type BankTx,
} from '@/hooks/use-finance';

const fileToBase64 = (f: File) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1] ?? '');
  r.onerror = () => rej(new Error('Não foi possível ler o arquivo.'));
  r.readAsDataURL(f);
});

function AccountDialog({ account, open, onClose }: { account: BankAccount | null; open: boolean; onClose: () => void }) {
  const save = useSaveBankAccount();
  const [f, setF] = useState({ name: '', bankName: '', agency: '', accountNumber: '', openingBalance: '', openingDate: '', isDefault: false });
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const key = account?.id ?? 'new';
  if (open && loadedFor !== key) {
    setLoadedFor(key);
    setF({
      name: account?.name ?? '', bankName: account?.bankName ?? '', agency: account?.agency ?? '', accountNumber: account?.accountNumber ?? '',
      openingBalance: account ? String(Number(account.openingBalance)).replace('.', ',') : '',
      openingDate: account?.openingDate?.slice(0, 10) ?? '', isDefault: account?.isDefault ?? false,
    });
  }
  const close = () => { setLoadedFor(null); onClose(); };
  const submit = async () => {
    if (!f.name.trim()) return toast.error('Informe o nome da conta.');
    const ob = f.openingBalance ? parseMoney(f.openingBalance) : 0;
    if (Number.isNaN(ob)) return toast.error('Saldo inicial inválido.');
    try {
      await save.mutateAsync({
        ...(account && { id: account.id }), name: f.name.trim(), bankName: f.bankName || undefined, agency: f.agency || undefined,
        accountNumber: f.accountNumber || undefined, openingBalance: ob, openingDate: f.openingDate || undefined, isDefault: f.isDefault,
      });
      toast.success('Conta salva.');
      close();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{account ? 'Editar conta' : 'Nova conta bancária'}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="space-y-1"><Label>Nome</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Itaú PJ, Conta Asaas" /></div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1"><Label>Banco</Label><Input value={f.bankName} onChange={(e) => setF({ ...f, bankName: e.target.value })} /></div>
            <div className="space-y-1"><Label>Agência</Label><Input value={f.agency} onChange={(e) => setF({ ...f, agency: e.target.value })} /></div>
            <div className="space-y-1"><Label>Conta</Label><Input value={f.accountNumber} onChange={(e) => setF({ ...f, accountNumber: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Saldo inicial (R$)</Label><Input inputMode="decimal" value={f.openingBalance} onChange={(e) => setF({ ...f, openingBalance: e.target.value })} placeholder="0,00" /></div>
            <div className="space-y-1"><Label>Na data</Label><Input type="date" value={f.openingDate} onChange={(e) => setF({ ...f, openingDate: e.target.value })} /></div>
          </div>
          <p className="text-xs text-muted-foreground">Use o saldo do extrato no início do dia escolhido. Movimentos anteriores a essa data não entram no saldo.</p>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.isDefault} onChange={(e) => setF({ ...f, isDefault: e.target.checked })} />Conta padrão</label>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={close}>Voltar</Button><Button disabled={save.isPending} onClick={() => void submit()}>Salvar</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReconcileDialog({ tx, onClose }: { tx: BankTx | null; onClose: () => void }) {
  const s = useReconcileSuggestions(tx?.id);
  const { reconcile } = useBankingActions();
  const [notes, setNotes] = useState('');
  if (!tx) return null;
  const go = async (dto: { financialEntryId?: string; paymentId?: string; notes?: string }) => {
    try {
      await reconcile.mutateAsync({ bankTransactionId: tx.id, ...dto });
      toast.success(dto.financialEntryId ? 'Conciliado: a baixa da conta foi registrada.' : 'Conciliado.');
      setNotes('');
      onClose();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
  };
  const credit = Number(tx.amount) >= 0;
  return (
    <Dialog open={!!tx} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Conciliar {credit ? 'entrada' : 'saída'} de {brl(Math.abs(Number(tx.amount)))}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{dmy(tx.date)} · {tx.description}</p>
        {s.isLoading ? <Skeleton className="h-24 w-full" /> : s.isError ? <ErrorState error={s.error} onRetry={() => s.refetch()} compact /> : (
          <div className="space-y-3 text-sm">
            {s.data!.payments.length > 0 && (
              <div>
                <p className="font-medium mb-1">Baixas já registradas com este valor (ex.: boleto pago)</p>
                {s.data!.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between border rounded p-2 mb-1">
                    <span>{p.entryDescription} · {dmy(p.paidAt)} · {brl(p.total)}</span>
                    <Button size="sm" disabled={reconcile.isPending} onClick={() => void go({ paymentId: p.id })}>Ligar</Button>
                  </div>
                ))}
              </div>
            )}
            <div>
              <p className="font-medium mb-1">Contas {credit ? 'a receber' : 'a pagar'} em aberto</p>
              {s.data!.entries.length === 0 ? <p className="text-muted-foreground">Nenhuma conta em aberto compatível.</p> : s.data!.entries.map((e) => (
                <div key={e.id} className="flex items-center justify-between border rounded p-2 mb-1">
                  <span>{e.description} · vence {dmy(e.dueDate)} · em aberto {brl(e.openAmount)}</span>
                  <Button size="sm" variant="outline" disabled={reconcile.isPending} onClick={() => void go({ financialEntryId: e.id })}>Baixar com este</Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Se o extrato for menor que o saldo, a baixa é parcial; se for maior, a diferença entra como juros.</p>
            </div>
            <div className="border-t pt-3 space-y-1">
              <p className="font-medium">Sem conta vinculada (ex.: tarifa, rendimento)</p>
              <div className="flex gap-2"><Input placeholder="Observação obrigatória" value={notes} onChange={(e) => setNotes(e.target.value)} />
                <Button variant="outline" disabled={!notes.trim() || reconcile.isPending} onClick={() => void go({ notes })}>Conciliar</Button></div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AccountView({ account }: { account: BankAccount }) {
  const [filter, setFilter] = useState('false');
  const [page, setPage] = useState(1);
  const txs = useBankTransactions({ bankAccountId: account.id, reconciled: filter === 'ALL' ? undefined : filter, page, limit: 30 });
  const { importStatement, unreconcile, auto } = useBankingActions();
  const [reconciling, setReconciling] = useState<BankTx | null>(null);
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const ledger = useLedger(account.id, from, to);

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      const r = await importStatement.mutateAsync({ bankAccountId: account.id, fileName: file.name, content: await fileToBase64(file) });
      toast.success(`Extrato ${r.format}: ${r.imported} lançamento(s) novo(s)${r.duplicates ? `, ${r.duplicates} já existiam` : ''}.`);
    } catch (err) { toast.error(getApiErrorMessage(err)); }
  };
  const doAuto = async () => {
    try { const r = await auto.mutateAsync(account.id); toast.success(`Conciliação automática: ${r.matched} de ${r.total} movimentos.`); }
    catch (err) { toast.error(getApiErrorMessage(err)); }
  };
  const doUnrec = async (id: string) => {
    if (!confirm('Desfazer a conciliação? Se a baixa foi criada pela conciliação, ela será estornada.')) return;
    try { await unreconcile.mutateAsync(id); toast.success('Conciliação desfeita.'); } catch (err) { toast.error(getApiErrorMessage(err)); }
  };

  return (
    <Tabs defaultValue="tx">
      <TabsList><TabsTrigger value="tx">Extrato e conciliação</TabsTrigger><TabsTrigger value="ledger">Razão bancário</TabsTrigger></TabsList>
      <TabsContent value="tx" className="mt-3 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={filter} onValueChange={(v) => { setPage(1); setFilter(v); }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="false">A conciliar</SelectItem><SelectItem value="true">Conciliados</SelectItem><SelectItem value="ALL">Todos</SelectItem></SelectContent>
          </Select>
          <label className="inline-flex">
            <input type="file" className="hidden" accept=".ofx,.csv,.txt,.xlsx" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
            <span className="inline-flex items-center rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"><Upload className="h-4 w-4 mr-1" />{importStatement.isPending ? 'Importando...' : 'Importar extrato (OFX, CSV, Excel)'}</span>
          </label>
          <Button variant="outline" disabled={auto.isPending} onClick={() => void doAuto()}><Wand2 className="h-4 w-4 mr-1" />Conciliar automaticamente</Button>
        </div>
        <p className="text-xs text-muted-foreground">CSV/Excel: colunas &quot;Data&quot;, &quot;Descrição&quot; e &quot;Valor&quot; (negativo = saída) ou &quot;Crédito&quot;/&quot;Débito&quot;. Reimportar o mesmo arquivo não duplica.</p>
        {txs.isLoading ? <Skeleton className="h-32 w-full" /> : txs.isError ? <ErrorState error={txs.error} onRetry={() => txs.refetch()} /> : (txs.data?.items ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">Nenhum movimento {filter === 'false' ? 'a conciliar' : ''}.</p>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-muted-foreground"><tr>
                <th className="text-left px-3 py-2">Data</th><th className="text-left px-3 py-2">Descrição</th>
                <th className="text-right px-3 py-2">Valor</th><th className="text-left px-3 py-2">Conciliação</th><th />
              </tr></thead>
              <tbody className="divide-y">
                {txs.data!.items.map((t) => (
                  <tr key={t.id}>
                    <td className="px-3 py-2 whitespace-nowrap">{dmy(t.date)}</td>
                    <td className="px-3 py-2">{t.description}<span className="ml-1 text-xs text-muted-foreground">{t.importSource}</span></td>
                    <td className={`px-3 py-2 text-right font-medium ${Number(t.amount) >= 0 ? 'text-green-700' : 'text-red-700'}`}>{brl(t.amount)}</td>
                    <td className="px-3 py-2 text-xs">{t.reconciled ? <span className="text-green-700">✓ {t.entry?.description ?? 'sem conta vinculada'}</span> : <span className="text-muted-foreground">Pendente</span>}</td>
                    <td className="px-3 py-2 text-right">
                      {t.reconciled
                        ? <Button size="sm" variant="ghost" onClick={() => void doUnrec(t.id)}>Desfazer</Button>
                        : <Button size="sm" variant="outline" onClick={() => setReconciling(t)}>Conciliar</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(txs.data?.meta.pages ?? 0) > 1 && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= txs.data!.meta.pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        )}
        <ReconcileDialog tx={reconciling} onClose={() => setReconciling(null)} />
      </TabsContent>
      <TabsContent value="ledger" className="mt-3 space-y-3">
        <div className="flex gap-2 items-end">
          <div className="space-y-1"><Label className="text-xs">De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        {ledger.isLoading ? <Skeleton className="h-32 w-full" /> : ledger.isError ? <ErrorState error={ledger.error} onRetry={() => ledger.refetch()} /> : ledger.data && (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-muted-foreground"><tr>
                <th className="text-left px-3 py-2">Data</th><th className="text-left px-3 py-2">Histórico</th>
                <th className="text-right px-3 py-2">Valor</th><th className="text-right px-3 py-2">Saldo</th>
              </tr></thead>
              <tbody className="divide-y">
                <tr className="bg-gray-50"><td className="px-3 py-2" colSpan={3}>Saldo anterior ({dmy(ledger.data.from)})</td><td className="px-3 py-2 text-right font-semibold">{brl(ledger.data.openingBalance)}</td></tr>
                {ledger.data.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 whitespace-nowrap">{dmy(r.date)}</td>
                    <td className="px-3 py-2">{r.description}{r.reconciled ? '' : <span className="ml-1 text-xs text-amber-700">(a conciliar)</span>}</td>
                    <td className={`px-3 py-2 text-right ${r.amount >= 0 ? 'text-green-700' : 'text-red-700'}`}>{brl(r.amount)}</td>
                    <td className="px-3 py-2 text-right">{brl(r.balance)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold"><td className="px-3 py-2" colSpan={2}>Saldo final · entradas {brl(ledger.data.credits)} · saídas {brl(ledger.data.debits)}</td><td /><td className="px-3 py-2 text-right">{brl(ledger.data.closingBalance)}</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

export default function BankingPage() {
  const accounts = useBankAccounts();
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const list = accounts.data ?? [];
  const current = list.find((a) => a.id === selected) ?? list[0];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bancário</h1>
          <p className="text-sm text-gray-500 mt-1">Contas, extrato, conciliação e razão bancário</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" />Nova conta</Button>
      </div>
      {accounts.isLoading ? <Skeleton className="h-24 w-full" /> : accounts.isError ? (
        <Card><ErrorState error={accounts.error} onRetry={() => accounts.refetch()} /></Card>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma conta bancária. Cadastre a primeira com o saldo inicial.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {list.map((a) => (
              <button key={a.id} type="button" onClick={() => setSelected(a.id)}
                className={`text-left p-4 rounded-lg border-2 ${current?.id === a.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <div className="flex justify-between">
                  <p className="font-semibold">{a.name}</p>
                  {a.isDefault && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Padrão</span>}
                </div>
                {a.bankName && <p className="text-xs text-gray-500">{a.bankName} {a.agency ? `· ag ${a.agency}` : ''} {a.accountNumber ? `· cc ${a.accountNumber}` : ''}</p>}
                <p className="mt-2 text-lg font-bold">{brl(a.currentBalance)}</p>
                <p className="text-xs text-gray-500">{a.pendingReconciliation} movimento(s) a conciliar</p>
              </button>
            ))}
          </div>
          {current && (
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-between">
                <CardTitle className="text-base">{current.name}</CardTitle>
                <Button size="sm" variant="outline" onClick={() => { setEditing(current); setDialogOpen(true); }}>Editar conta / saldo inicial</Button>
              </CardHeader>
              <CardContent><AccountView key={current.id} account={current} /></CardContent>
            </Card>
          )}
        </>
      )}
      <AccountDialog account={editing} open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
