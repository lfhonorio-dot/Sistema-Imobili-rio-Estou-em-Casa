// Formulário de criação de tarefa/atividade
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateActivity } from '@/hooks/use-activities';
import { toast } from 'sonner';

const taskSchema = z.object({
  type: z.enum(['NOTE', 'TASK', 'CALL', 'VISIT', 'MEETING', 'EMAIL', 'WHATSAPP']),
  title: z.string().optional(),
  content: z.string().optional(),
  dueAt: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskFormProps {
  contactId?: string;
  dealId?: string;
  defaultType?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function TaskForm({ contactId, dealId, defaultType = 'TASK', onSuccess, onCancel }: TaskFormProps) {
  const createActivity = useCreateActivity();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<TaskFormValues>({
    defaultValues: {
      type: defaultType as TaskFormValues['type'],
      priority: 'MEDIUM',
    },
  });

  const onSubmit = async (data: TaskFormValues) => {
    try {
      await createActivity.mutateAsync({
        ...data,
        contactId,
        dealId,
      });
      toast.success('Atividade criada');
      onSuccess?.();
    } catch {
      toast.error('Erro ao criar atividade');
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
      {/* Tipo */}
      <div className="space-y-1">
        <Label>Tipo</Label>
        <Select value={watch('type')} onValueChange={(v) => setValue('type', v as TaskFormValues['type'])}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TASK">Tarefa</SelectItem>
            <SelectItem value="NOTE">Nota</SelectItem>
            <SelectItem value="CALL">Ligação</SelectItem>
            <SelectItem value="VISIT">Visita</SelectItem>
            <SelectItem value="MEETING">Reunião</SelectItem>
            <SelectItem value="EMAIL">E-mail</SelectItem>
            <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Título */}
      <div className="space-y-1">
        <Label htmlFor="title">Título</Label>
        <Input id="title" {...register('title')} placeholder="Título da atividade" />
      </div>

      {/* Conteúdo */}
      <div className="space-y-1">
        <Label htmlFor="content">Descrição</Label>
        <Textarea
          id="content"
          {...register('content')}
          placeholder="Detalhes da atividade..."
          rows={3}
          className="resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Prazo */}
        <div className="space-y-1">
          <Label htmlFor="dueAt">Prazo</Label>
          <Input id="dueAt" type="datetime-local" {...register('dueAt')} />
        </div>

        {/* Prioridade */}
        <div className="space-y-1">
          <Label>Prioridade</Label>
          <Select
            value={watch('priority')}
            onValueChange={(v) => setValue('priority', v as TaskFormValues['priority'])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Baixa</SelectItem>
              <SelectItem value="MEDIUM">Média</SelectItem>
              <SelectItem value="HIGH">Alta</SelectItem>
              <SelectItem value="URGENT">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando...' : 'Criar Atividade'}
        </Button>
      </div>
    </form>
  );
}
