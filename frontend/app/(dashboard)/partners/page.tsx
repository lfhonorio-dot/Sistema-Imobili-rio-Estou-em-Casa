// Gestão de Corretores Parceiros (recebedores de split) — dados bancários/PIX e KYC
'use client';

import { useState } from 'react';
import { Handshake, X, CheckCircle2, Clock, AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useRecipients,
  useCreateRecipient,
  useUpdateRecipient,
  useDeleteRecipient,
  useSubmitKyc,
  type SplitRecipient,
  type RecipientInput,
} from '@/hooks/use-split';

const KYC_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  APPROVED: { label: 'Habilitado', variant: 'default', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  PENDING: { label: 'Pendente', variant: 'secondary', icon: <Clock className="w-3.5 h-3.5" /> },
  SUBMITTED: { label: 'Em análise', variant: 'secondary', icon: <Clock className="w-3.5 h-3.5" /> },
  REJECTED: { label: 'Recusado', variant: 'destructive', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
};

const EMPTY: RecipientInput = {
  name: '', document: '', documentType: 'CPF', email: '', phone: '',
  pixKey: '', pixKeyType: 'CPF', bankCode: '', agency: '', accountNumber: '', accountType: 'CHECKING',
};

export default function PartnersPage() {
  const { data: recipients, isLoading } = useRecipients();
  const createRecipient = useCreateRecipient();
  const updateRecipient = useUpdateRecipient();
  const deleteRecipient = useDeleteRecipient();
  const submitKyc = useSubmitKyc();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SplitRecipient | null>(null);
  const [form, setForm] = useState<RecipientInput>(EMPTY);

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  }
  function openEdit(r: SplitRecipient) {
    setEditing(r);
    setForm({
      name: r.name, document: r.document, documentType: r.documentType,
      email: r.email ?? '', phone: r.phone ?? '',
      pixKey: r.pixKey ?? '', pixKeyType: r.pixKeyType ?? 'CPF',
      bankCode: r.bankCode ?? '', agency: r.agency ?? '', accountNumber: r.accountNumber ?? '',
      accountType: r.accountType ?? 'CHECKING',
    });
    setModalOpen(true);
  }
  function setField(k: keyof RecipientInput, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function save() {
    if (!form.name || !form.document) {
      toast.error('Nome e documento (CPF/CNPJ) são obrigatórios.');
      return;
    }
    try {
      if (editing) {
        await updateRecipient.mutateAsync({ id: editing.id, ...form });
        toast.success('Recebedor atualizado.');
      } else {
        await createRecipient.mutateAsync(form);
        toast.success('Corretor parceiro cadastrado.');
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao salvar.';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    }
  }

  async function approveKyc(r: SplitRecipient) {
    try {
      await submitKyc.mutateAsync(r.id);
      toast.success('Recebedor habilitado para repasses (KYC aprovado).');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao habilitar.';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    }
  }

  async function remove(r: SplitRecipient) {
    if (!confirm(`Remover o recebedor ${r.name}?`)) return;
    try {
      await deleteRecipient.mutateAsync(r.id);
      toast.success('Recebedor removido.');
    } catch {
      toast.error('Erro ao remover.');
    }
  }

  const list = recipients ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Handshake className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold">Corretores Parceiros</h1>
        </div>
        <Button onClick={openNew}>+ Novo Parceiro</Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Cadastre os dados bancários/PIX dos corretores parceiros e habilite-os (KYC) para que os
        repasses de comissão possam ser pagos automaticamente via gateway.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum recebedor cadastrado. Eles também são criados automaticamente quando você define
          repasses num contrato — aqui você completa os dados bancários e habilita.
        </p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Nome</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Documento</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Recebimento</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const badge = KYC_BADGE[r.kycStatus] ?? { label: r.kycStatus, variant: 'outline' as const, icon: null };
                const recebimento = r.pixKey
                  ? `PIX (${r.pixKeyType})`
                  : r.bankCode
                    ? `Banco ${r.bankCode} · Ag ${r.agency ?? '-'} · Cc ${r.accountNumber ?? '-'}`
                    : '— não informado —';
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50/50">
                    <td className="py-3 px-4 text-sm font-medium">{r.name}</td>
                    <td className="py-3 px-4 text-sm">{r.documentType}: {r.document}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{recebimento}</td>
                    <td className="py-3 px-4">
                      <Badge variant={badge.variant} className="flex items-center gap-1 w-fit">
                        {badge.icon}{badge.label}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex gap-2 justify-end">
                        {r.kycStatus !== 'APPROVED' && (
                          <Button size="sm" variant="outline" onClick={() => approveKyc(r)} disabled={submitKyc.isPending}>
                            Habilitar
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Editar</Button>
                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => remove(r)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de cadastro/edição */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl my-8" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editing ? 'Editar Parceiro' : 'Novo Corretor Parceiro'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Nome *</Label>
                  <Input value={form.name} onChange={(e) => setField('name', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={form.documentType} onValueChange={(v) => setField('documentType', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CPF">CPF</SelectItem>
                      <SelectItem value="CNPJ">CNPJ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{form.documentType} *</Label>
                <Input value={form.document} onChange={(e) => setField('document', e.target.value)} placeholder="Somente números" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input value={form.email} onChange={(e) => setField('email', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
                </div>
              </div>

              <div className="rounded-lg bg-gray-50 p-3 space-y-3">
                <p className="text-xs font-medium text-gray-600">Recebimento via PIX (recomendado)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo da chave</Label>
                    <Select value={form.pixKeyType} onValueChange={(v) => setField('pixKeyType', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CPF">CPF</SelectItem>
                        <SelectItem value="CNPJ">CNPJ</SelectItem>
                        <SelectItem value="EMAIL">E-mail</SelectItem>
                        <SelectItem value="PHONE">Telefone</SelectItem>
                        <SelectItem value="RANDOM">Aleatória</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">Chave PIX</Label>
                    <Input value={form.pixKey} onChange={(e) => setField('pixKey', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-gray-50 p-3 space-y-3">
                <p className="text-xs font-medium text-gray-600">Ou conta bancária</p>
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Banco</Label>
                    <Input value={form.bankCode} onChange={(e) => setField('bankCode', e.target.value)} placeholder="001" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Agência</Label>
                    <Input value={form.agency} onChange={(e) => setField('agency', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Conta</Label>
                    <Input value={form.accountNumber} onChange={(e) => setField('accountNumber', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={form.accountType} onValueChange={(v) => setField('accountType', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CHECKING">Corrente</SelectItem>
                        <SelectItem value="SAVINGS">Poupança</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Informe ao menos uma chave PIX ou os dados bancários para poder habilitar (KYC) o recebedor.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                <Button onClick={save} disabled={createRecipient.isPending || updateRecipient.isPending}>
                  {createRecipient.isPending || updateRecipient.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
