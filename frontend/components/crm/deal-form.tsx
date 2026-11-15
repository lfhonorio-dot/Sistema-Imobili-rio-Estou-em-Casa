// Formulário de criação de negócio
'use client';
import { getApiErrorMessage } from '@/lib/api-error';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateDeal } from '@/hooks/use-deals';
import { usePipelines } from '@/hooks/use-pipelines';
import { useContacts } from '@/hooks/use-contacts';
import { useProperties } from '@/hooks/use-properties';
import { toast } from 'sonner';
import { useState } from 'react';

const dealSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  contactId: z.string().min(1, 'Contato é obrigatório'),
  pipelineId: z.string().min(1, 'Pipeline é obrigatório'),
  value: z.number().optional(),
  origin: z.string().optional(),
  propertyId: z.string().optional(),
});

type DealFormValues = z.infer<typeof dealSchema>;

interface DealFormProps {
  defaultPipelineId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function DealForm({ defaultPipelineId, onSuccess, onCancel }: DealFormProps) {
  const createDeal = useCreateDeal();
  const { data: pipelines = [] } = usePipelines();
  const [contactSearch, setContactSearch] = useState('');
  const { data: contactsResult } = useContacts({ search: contactSearch, limit: 10 });
  const { data: propertiesResult } = useProperties({ limit: 500 });
  const contacts = contactsResult?.items ?? [];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DealFormValues>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      pipelineId: defaultPipelineId ?? '',
      origin: 'MANUAL',
    },
  });

  const onSubmit = async (data: DealFormValues) => {
    try {
      const { propertyId, ...rest } = data;
      // valor vazio vira NaN no input numérico: não envia
      const value = Number.isFinite(rest.value) ? rest.value : undefined;
      await createDeal.mutateAsync({ ...rest, value, ...(propertyId ? { propertyIds: [propertyId] } : {}) });
      toast.success('Negócio criado com sucesso');
      onSuccess?.();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao criar negócio'));
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="title">Título *</Label>
        <Input id="title" {...register('title')} placeholder="Ex: Apartamento 2 quartos" />
        {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
      </div>

      {/* Busca de contato */}
      <div className="space-y-1">
        <Label>Contato *</Label>
        <Input
          placeholder="Buscar contato..."
          value={contactSearch}
          onChange={(e) => setContactSearch(e.target.value)}
        />
        {contacts.length > 0 && contactSearch && (
          <div className="border rounded-md overflow-hidden max-h-40 overflow-y-auto">
            {contacts.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${
                  watch('contactId') === c.id ? 'bg-accent' : ''
                }`}
                onClick={() => {
                  setValue('contactId', c.id);
                  setContactSearch(c.name);
                }}
              >
                {c.name} {c.email ? `(${c.email})` : ''}
              </button>
            ))}
          </div>
        )}
        {errors.contactId && <p className="text-xs text-red-500">{errors.contactId.message}</p>}
      </div>

      {/* Pipeline */}
      <div className="space-y-1">
        <Label>Pipeline *</Label>
        <Select value={watch('pipelineId')} onValueChange={(v) => setValue('pipelineId', v)}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o pipeline" />
          </SelectTrigger>
          <SelectContent>
            {pipelines.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.pipelineId && <p className="text-xs text-red-500">{errors.pipelineId.message}</p>}
      </div>

      {/* Valor */}
      <div className="space-y-1">
        <Label htmlFor="value">Valor (R$)</Label>
        <Input
          id="value"
          type="number"
          step="0.01"
          min="0"
          {...register('value', { valueAsNumber: true })}
          placeholder="0,00"
        />
      </div>

      {/* Imóvel de interesse (Fase 3) */}
      <div className="space-y-1">
        <Label htmlFor="propertyId">Imóvel de interesse</Label>
        <select id="propertyId" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" {...register('propertyId')}>
          <option value="">Nenhum (definir depois)</option>
          {((propertiesResult?.items ?? []) as Array<{ id: string; code: string; street?: string | null; status: string }>)
            .filter((p) => p.status !== 'SOLD')
            .map((p) => <option key={p.id} value={p.id}>{p.code}{p.street ? ' — ' + p.street : ''}</option>)}
        </select>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Criando...' : 'Criar Negócio'}
        </Button>
      </div>
    </form>
  );
}
