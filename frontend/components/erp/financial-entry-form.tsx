// Formulário de lançamento financeiro manual (conta a pagar / a receber)
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateEntry, type CreateFinancialEntryInput } from '@/hooks/use-financial';
import { useContracts } from '@/hooks/use-contracts';
import { useProperties } from '@/hooks/use-properties';
import { useContacts } from '@/hooks/use-contacts';

const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'RENT', label: 'Aluguel' },
  { value: 'SALE', label: 'Venda' },
  { value: 'ADMINISTRATION', label: 'Administração' },
  { value: 'COMMISSION', label: 'Comissão' },
  { value: 'MAINTENANCE', label: 'Manutenção' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'OTHER', label: 'Outro' },
];

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
  onSuccess?: (type: 'RECEIVABLE' | 'PAYABLE') => void;
  onCancel?: () => void;
}

export function FinancialEntryForm({ defaultType = 'PAYABLE', onSuccess, onCancel }: FinancialEntryFormProps) {
  const createEntry = useCreateEntry();

  const { data: contractsData } = useContracts({ limit: 500 });
  const { data: propertiesData } = useProperties({ limit: 500 });
  const { data: contactsData } = useContacts({ limit: 500 });

  const contracts = contractsData?.items ?? [];
  const properties = propertiesData?.items ?? [];
  const contacts = contactsData?.items ?? [];

  const [form, setForm] = useState({
    type: defaultType as string,
    category: 'OTHER',
    description: '',
    amount: '',
    dueDate: todayISO(),
    months: '1',
    contractId: NONE,
    propertyId: NONE,
    contactId: NONE,
    notes: '',
  });

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
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    };

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
          <Select value={form.type} onValueChange={(v) => setField('type', v)}>
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
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

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

        <div className="space-y-1">
          <Label>Repetir (meses)</Label>
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
        Repetir 1 cria um lançamento único. Acima disso, gera uma parcela por mês a partir do vencimento.
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
        <Button onClick={() => void handleSubmit()} disabled={createEntry.isPending}>
          {createEntry.isPending ? 'Salvando...' : 'Salvar lançamento'}
        </Button>
      </div>
    </div>
  );
}
