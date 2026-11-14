'use client';

// Fornecedores / favorecidos (Fase 2) — usados nas contas a pagar.

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { useSuppliers, SUPPLIER_CATEGORIES, type Supplier } from '@/hooks/use-suppliers';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorState } from '@/components/common/error-state';

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring';

const EMPTY = {
  name: '', personType: 'PJ', document: '', email: '', phone: '', category: '', pixKeyType: '', pixKey: '',
  bankCode: '', agency: '', accountNumber: '', notes: '',
};

function formatDoc(doc: string | null, type: string) {
  if (!doc) return '—';
  if (type === 'PF' && doc.length === 11) return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (doc.length === 14) return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return doc;
}

export default function SuppliersPage() {
  const qc = useQueryClient();
  const list = useSuppliers();
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(EMPTY);
  const [search, setSearch] = useState('');
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? undefined : v]));
      return editing ? api.patch(`/suppliers/${editing.id}`, body) : api.post('/suppliers', body);
    },
    onSuccess: () => {
      toast.success(editing ? 'Fornecedor atualizado' : 'Fornecedor cadastrado');
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível salvar o fornecedor.')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/suppliers/${id}`),
    onSuccess: () => {
      toast.success('Fornecedor removido');
      void qc.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, String((s as unknown as Record<string, unknown>)[k] ?? '')])));
    setOpen(true);
  };

  const items = (list.data?.items ?? []).filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.document ?? '').includes(search.replace(/\D/g, '') || '¬'),
  );

  return (
    <div>
      <Header title="Fornecedores" />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Input className="max-w-xs" placeholder="Buscar por nome ou CPF/CNPJ" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo fornecedor</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {list.isLoading ? (
              <p className="p-6 text-center text-muted-foreground">Carregando…</p>
            ) : list.isError ? (
              <ErrorState error={list.error} onRetry={() => list.refetch()} />
            ) : items.length === 0 ? (
              <p className="p-6 text-center text-muted-foreground">
                {search ? 'Nenhum fornecedor encontrado para a busca.' : 'Nenhum fornecedor cadastrado ainda.'}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Nome</th>
                    <th className="px-4 py-3 font-medium">CPF/CNPJ</th>
                    <th className="px-4 py-3 font-medium">Categoria</th>
                    <th className="px-4 py-3 font-medium">Contato</th>
                    <th className="px-4 py-3 font-medium">PIX</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3">{formatDoc(s.document, s.personType)}</td>
                      <td className="px-4 py-3">{s.category ? SUPPLIER_CATEGORIES[s.category] ?? s.category : '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{[s.phone, s.email].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.pixKey ?? '—'}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" className="text-red-600" disabled={remove.isPending}
                          onClick={() => { if (confirm(`Remover o fornecedor ${s.name}? As contas já lançadas continuam no histórico.`)) remove.mutate(s.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar fornecedor' : 'Novo fornecedor'}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2"><Label>Nome / razão social *</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
            <div className="space-y-1"><Label>Tipo</Label>
              <select className={selectClass} value={form.personType} onChange={(e) => set('personType', e.target.value)}>
                <option value="PJ">Pessoa jurídica</option><option value="PF">Pessoa física</option>
              </select></div>
            <div className="space-y-1"><Label>{form.personType === 'PF' ? 'CPF' : 'CNPJ'}</Label>
              <Input value={form.document} onChange={(e) => set('document', e.target.value)} /></div>
            <div className="space-y-1"><Label>Categoria</Label>
              <select className={selectClass} value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">—</option>
                {Object.entries(SUPPLIER_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div className="space-y-1"><Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
            <div className="space-y-1"><Label>Tipo de chave PIX</Label>
              <select className={selectClass} value={form.pixKeyType} onChange={(e) => set('pixKeyType', e.target.value)}>
                <option value="">—</option><option value="CPF">CPF</option><option value="CNPJ">CNPJ</option>
                <option value="EMAIL">E-mail</option><option value="PHONE">Telefone</option><option value="RANDOM">Aleatória</option>
              </select></div>
            <div className="space-y-1"><Label>Chave PIX</Label>
              <Input value={form.pixKey} onChange={(e) => set('pixKey', e.target.value)} /></div>
            <div className="space-y-1"><Label>Banco</Label>
              <Input value={form.bankCode} onChange={(e) => set('bankCode', e.target.value)} placeholder="001" /></div>
            <div className="space-y-1"><Label>Agência / Conta</Label>
              <div className="flex gap-2">
                <Input value={form.agency} onChange={(e) => set('agency', e.target.value)} placeholder="0001" />
                <Input value={form.accountNumber} onChange={(e) => set('accountNumber', e.target.value)} placeholder="12345-6" />
              </div></div>
            <div className="space-y-1 sm:col-span-2"><Label>Observações</Label>
              <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
