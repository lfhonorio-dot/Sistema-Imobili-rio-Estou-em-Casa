// Formulário de lançamento financeiro manual (conta a pagar / a receber)
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateEntry, type CreateFinancialEntryInput, type FinancialEntry } from '@/hooks/use-financial';
import { useCategories, useCostCenters, useUpdateEntry } from '@/hooks/use-finance';
import { useSuppliers } from '@/hooks/use-suppliers';
import { getApiErrorMessage } from '@/lib/api-error';
import { useContracts } from '@/hooks/use-contracts';
import { useProperties } from '@/hooks/use-properties';
import { useContacts } from '@/hooks/use-contacts';

// O Select do Radix não aceita SelectItem com value vazio: usamos um sentinela
// para representar "sem vínculo" e traduzimos para undefined no envio.
const NONE = 'NONE';

function todayISO() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}

// Aceita "1.234,56" e "1234.56"
function parseAmount(value: string) {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

interface FinancialEntryFormProps {
  defaultType?: 'RECEIVABLE' | 'PAYABLE';
  /** Fase 5: quando informado, o formulário edita este lançamento */
  entry?: FinancialEntry | null;
  onSuccess?: (type: 'RECEIVABLE' | 'PAYABLE') => void;
  onCancel?: () => void;
}

export function FinancialEntryForm({ defaultType = 'PAYABLE', entry, onSuccess, onCancel }: FinancialEntryFormProps) {
  const createEntry = useCreateEntry();
  const updateEntry = useUpdateEntry();
  const editing = !!entry;

  const { data: contractsData } = useContracts({ limit: 500 });
  const { data: propertiesData } = useProperties({ limit: 500 });
  const { data: contactsData } = useContacts({ limit: 500 });
  const suppliersQuery = useSuppliers();
  const suppliers = suppliersQuery.data?.items ?? [];

  const contracts = contractsData?.items ?? [];
  const properties = propertiesData?.items ?? [];
  const contacts = contactsData?.items ?? [];

  const [form, setForm] = useState({
    type: (entry?.type ?? defaultType) as string,
    category: entry?.category ?? 'OTHER',
    description: entry?.description ?? '',
    amount: entry ? String(Number(entry.amount)).replace('.', ',') : '',
    dueDate: entry ? entry.dueDate.slice(0, 10) : todayISO(),
    months: '1',
    contractId: entry?.contractId ?? NONE,
    propertyId: entry?.propertyId ?? NONE,
    contactId: entry?.contactId ?? NONE,
    supplierId: entry?.supplierId ?? NONE,
    costCenterId: entry?.costCenterId ?? NONE,
    notes: entry?.notes ?? '',
  });
  // Fase 5: plano de categorias e centros de custo configuráveis
  const categoriesQuery = useCategories(form.type);
  const costCentersQuery = useCostCenters();
  const categories = categoriesQuery.data ?? [];
  const costCenters = costCentersQuery.data ?? [];

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const isPayable = form.type === 'PAYABLE';
  const amountNumber = parseAmount(form.amount);
  const monthsNumber = Math.trunc(Number(form.months) || 1);

  async function handleSubmit() {
    if (!form.description.trim()) {
      toast.error('Informe a descrição do lançamento.');
      return;
    }
    if (amountNumber <= 0) {
      toast.error('Informe um valor maior que zero.');
      return;
    }
    if (!form.dueDate) {
      toast.error('Informe a data de vencimento.');
      return;
    }
    if (monthsNumber < 1 || monthsNumber > 60) {
      toast.error('A repetição deve ficar entre 1 e 60 meses.');
      return;
    }

    const entryType: 'RECEIVABLE' | 'PAYABLE' = form.type === 'PAYABLE' ? 'PAYABLE' : 'RECEIVABLE';

    const payload: CreateFinancialEntryInput = {
      type: entryType,
      category: form.category,
      description: form.description.trim(),
      amount: amountNumber,
      dueDate: form.dueDate,
      months: monthsNumber,
      ...(form.contractId !== NONE ? { contractId: form.contractId } : {}),
      ...(form.propertyId !== NONE ? { propertyId: form.propertyId } : {}),
      ...(form.contactId !== NONE ? { contactId: form.contactId } : {}),
      ...(isPayable && form.supplierId !== NONE ? { supplierId: form.supplierId } : {}),
      ...(form.costCenterId !== NONE ? { costCenterId: form.costCenterId } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    };

    if (editing && entry) {
      const { months: _m, ...rest } = payload;
      try {
        await updateEntry.mutateAsync({ id: entry.id, ...rest, dueDate: `${form.dueDate}T12:00:00` });
        toast.success('Lançamento atualizado.');
        onSuccess?.(entryType);
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Erro ao salvar o lançamento.'));
      }
      return;
    }

    try {
      const created = await createEntry.mutateAsync(payload);
      toast.success(
        created.length > 1
          ? `${created.length} lançamentos criados.`
          : 'Lançamento criado.',
      );
      onSuccess?.(entryType);
    } catch (err) {
      // O hook já extrai a mensagem do backend (inclusive em falha parcial).
      toast.error(err instanceof Error ? err.message : 'Erro ao criar lançamento.');
    }
  }

  return (
    <div className="space-y-4">
      {/* Tipo e categoria */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Tipo</Label>
          <Select value={form.type} disabled={editing} onValueChange={(v) => { setField('type', v); setField('category', 'OTHER'); }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PAYABLE">Conta a pagar</SelectItem>
              <SelectItem value="RECEIVABLE">Conta a receber</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Categoria</Label>
          <Select value={form.category} onValueChange={(v) => setField('category', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
              {editing && entry && !categories.some((c) => c.code === entry.category) && (
                <SelectItem value={entry.category}>{entry.category}</SelectItem>
              )}
            </SelectContent>
          </Select>
          {categoriesQuery.isError && <p className="text-xs text-red-600">Categorias: {getApiErrorMessage(categoriesQuery.error)}</p>}
        </div>
      </div>

      {/* Centro de custo (Fase 5) */}
      <div className="space-y-1">
        <Label>Centro de custo (opcional)</Label>
        <Select value={form.costCenterId} onValueChange={(v) => setField('costCenterId', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Nenhum</SelectItem>
            {costCenters.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {costCentersQuery.isError && <p className="text-xs text-red-600">Centros de custo: {getApiErrorMessage(costCentersQuery.error)}</p>}
      </div>

      {/* Fornecedor / favorecido (Fase 2) — só para contas a pagar */}
      {isPayable && (
        <div className="space-y-1">
          <Label>Fornecedor / favorecido</Label>
          <Select value={form.supplierId} onValueChange={(v) => setField('supplierId', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nenhum</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {suppliersQuery.isError ? (
            <p className="text-xs text-red-600">Não foi possível carregar os fornecedores: {getApiErrorMessage(suppliersQuery.error)}</p>
          ) : suppliers.length === 0 && !suppliersQuery.isLoading ? (
            <p className="text-xs text-muted-foreground">Nenhum fornecedor cadastrado. Cadastre em Financeiro → Fornecedores.</p>
          ) : null}
        </div>
      )}

      {/* Descrição */}
      <div className="space-y-1">
        <Label>Descrição</Label>
        <Input
          value={form.description}
          onChange={(e) => setField('description', e.target.value)}
          placeholder={isPayable ? 'Ex.: IPTU do escritório, repasse ao proprietário' : 'Ex.: Taxa de administração'}
        />
      </div>

      {/* Valor, vencimento e repetição */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label>Valor (R$)</Label>
          <Input
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => setField('amount', e.target.value)}
            placeholder="0,00"
          />
        </div>

        <div className="space-y-1">
          <Label>Vencimento</Label>
          <Input
            type="date"
            value={form.dueDate}
            onChange={(e) => setField('dueDate', e.target.value)}
          />
        </div>

        <div className={`space-y-1 ${editing ? 'invisible' : ''}`}>
          <Label>Parcelar em (meses)</Label>
          <Input
            type="number"
            min={1}
            max={60}
            value={form.months}
            onChange={(e) => setField('months', e.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        {editing ? 'Contas com boleto/PIX emitido: para mudar valor ou vencimento, use "Reemitir" na cobrança.' : 'Parcelar em 1 cria um lançamento único. Acima disso, gera uma parcela por mês a partir do vencimento. Para despesas fixas todo mês, use Configurações → Recorrências.'}
      </p>

      {/* Vínculos opcionais */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Contrato (opcional)</Label>
          <Select value={form.contractId} onValueChange={(v) => setField('contractId', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Nenhum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nenhum</SelectItem>
              {contracts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.code ?? c.id.slice(0, 8)} — {c.property?.code ?? c.property?.street ?? 'sem imóvel'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Imóvel (opcional)</Label>
          <Select value={form.propertyId} onValueChange={(v) => setField('propertyId', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Nenhum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nenhum</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.code} — {p.street ?? 'sem endereço'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            {isPayable ? 'Favorecido (opcional)' : 'Pagador (opcional)'}
          </Label>
          <Select value={form.contactId} onValueChange={(v) => setField('contactId', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Nenhum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nenhum</SelectItem>
              {contacts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Observações */}
      <div className="space-y-1">
        <Label>Observações (opcional)</Label>
        <Textarea
          rows={2}
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={createEntry.isPending}>
            Cancelar
          </Button>
        )}
        <Button onClick={() => void handleSubmit()} disabled={createEntry.isPending || updateEntry.isPending}>
          {createEntry.isPending || updateEntry.isPending ? 'Salvando...' : editing ? 'Salvar alterações' : 'Salvar lançamento'}
        </Button>
      </div>
    </div>
  );
}
