// Componente de item de atividade individual na timeline
'use client';

import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  StickyNote,
  CheckSquare,
  Phone,
  Home,
  Calendar,
  Mail,
  MessageCircle,
  ArrowRight,
  Edit,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Activity } from '@/hooks/use-activities';

const ACTIVITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  NOTE: StickyNote,
  TASK: CheckSquare,
  CALL: Phone,
  VISIT: Home,
  MEETING: Calendar,
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  STAGE_CHANGE: ArrowRight,
  FIELD_CHANGE: Edit,
};

const ACTIVITY_LABELS: Record<string, string> = {
  NOTE: 'Nota',
  TASK: 'Tarefa',
  CALL: 'Ligação',
  VISIT: 'Visita',
  MEETING: 'Reunião',
  EMAIL: 'E-mail',
  WHATSAPP: 'WhatsApp',
  STAGE_CHANGE: 'Mudança de Etapa',
  FIELD_CHANGE: 'Campo Alterado',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'text-gray-500',
  MEDIUM: 'text-blue-500',
  HIGH: 'text-orange-500',
  URGENT: 'text-red-500',
};

interface ActivityItemProps {
  activity: Activity;
  className?: string;
}

export function ActivityItem({ activity, className }: ActivityItemProps) {
  const Icon = ACTIVITY_ICONS[activity.type] ?? StickyNote;
  const label = ACTIVITY_LABELS[activity.type] ?? activity.type;
  const isDone = !!activity.doneAt;

  return (
    <div className={cn('flex gap-3 py-3', className)}>
      {/* Ícone da atividade */}
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
        isDone ? 'bg-green-100 text-green-600' : 'bg-primary/10 text-primary',
      )}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {activity.priority && (
            <span className={cn('text-xs', PRIORITY_COLORS[activity.priority])}>
              {activity.priority}
            </span>
          )}
        </div>

        {activity.title && (
          <p className="text-sm font-medium mt-0.5">{activity.title}</p>
        )}

        {activity.content && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{activity.content}</p>
        )}

        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true, locale: ptBR })}
          </span>
          {activity.dueAt && !isDone && (
            <span className="text-xs text-orange-500">
              Prazo: {new Date(activity.dueAt).toLocaleDateString('pt-BR')}
            </span>
          )}
          {isDone && (
            <span className="text-xs text-green-600">Concluída</span>
          )}
        </div>
      </div>
    </div>
  );
}
