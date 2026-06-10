// Componente de feed/timeline de atividades
'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ActivityItem } from './activity-item';
import { useCreateActivity } from '@/hooks/use-activities';
import type { Activity } from '@/hooks/use-activities';
import { toast } from 'sonner';

interface ActivityFeedProps {
  activities: Activity[];
  contactId?: string;
  dealId?: string;
  isLoading?: boolean;
}

export function ActivityFeed({ activities, contactId, dealId, isLoading }: ActivityFeedProps) {
  const [noteContent, setNoteContent] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const createActivity = useCreateActivity();

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;

    try {
      await createActivity.mutateAsync({
        type: 'NOTE',
        content: noteContent.trim(),
        contactId,
        dealId,
      });
      setNoteContent('');
      setShowNoteInput(false);
      toast.success('Nota adicionada');
    } catch {
      toast.error('Erro ao adicionar nota');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Timeline</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowNoteInput(!showNoteInput)}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Nota
        </Button>
      </div>

      {/* Campo de nova nota */}
      {showNoteInput && (
        <div className="space-y-2 p-3 border rounded-md bg-muted/20">
          <Textarea
            placeholder="Escreva uma nota..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            className="resize-none"
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowNoteInput(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => void handleAddNote()}
              disabled={createActivity.isPending}
            >
              Salvar
            </Button>
          </div>
        </div>
      )}

      {/* Lista de atividades */}
      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : activities.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma atividade ainda
        </div>
      ) : (
        <div className="divide-y">
          {activities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))}
        </div>
      )}
    </div>
  );
}
