// Página de Tarefas e Calendário
'use client';

import { useState } from 'react';
import { CheckSquare, Calendar, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TaskForm } from '@/components/crm/task-form';
import { ActivityItem } from '@/components/crm/activity-item';
import { useActivities, useTodayActivities, useCalendarActivities, useMarkActivityDone } from '@/hooks/use-activities';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PRIORITY_BADGE_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-600',
  HIGH: 'bg-orange-100 text-orange-600',
  URGENT: 'bg-red-100 text-red-600',
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

export default function TasksPage() {
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const markDone = useMarkActivityDone();

  const { data: todayActivities = [] } = useTodayActivities();
  const { data: weekActivities } = useActivities({
    done: 'false',
    type: 'TASK',
    limit: 50,
  });
  const { data: calendarData } = useCalendarActivities(
    calendarDate.getFullYear(),
    calendarDate.getMonth() + 1,
  );

  const weekTasks = weekActivities?.items ?? [];
  const calendarByDay = calendarData?.byDay ?? {};

  const handleMarkDone = async (id: string) => {
    try {
      await markDone.mutateAsync(id);
      toast.success('Tarefa concluída');
    } catch {
      toast.error('Erro ao marcar tarefa');
    }
  };

  // Gera grade do calendário
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tarefas</h1>
          <p className="text-sm text-muted-foreground">
            {todayActivities.length} tarefas para hoje
          </p>
        </div>
        <Button onClick={() => setShowNewTaskModal(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Nova Tarefa
        </Button>
      </div>

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">
            <CheckSquare className="w-4 h-4 mr-1.5" />
            Hoje ({todayActivities.length})
          </TabsTrigger>
          <TabsTrigger value="week">Esta Semana</TabsTrigger>
          <TabsTrigger value="calendar">
            <Calendar className="w-4 h-4 mr-1.5" />
            Calendário
          </TabsTrigger>
        </TabsList>

        {/* Hoje */}
        <TabsContent value="today" className="mt-4">
          {todayActivities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma tarefa para hoje!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <button
                    className="mt-1 w-4 h-4 rounded border-2 border-primary hover:bg-primary/20 transition-colors shrink-0"
                    onClick={() => void handleMarkDone(activity.id)}
                    title="Marcar como concluída"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{activity.title || activity.type}</p>
                      {activity.priority && (
                        <span className={cn('text-xs px-1.5 py-0.5 rounded-full', PRIORITY_BADGE_COLORS[activity.priority])}>
                          {PRIORITY_LABELS[activity.priority]}
                        </span>
                      )}
                    </div>
                    {activity.content && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{activity.content}</p>
                    )}
                    <div className="flex gap-2 mt-1">
                      {activity.contact && (
                        <span className="text-xs text-blue-600">{activity.contact.name}</span>
                      )}
                      {activity.deal && (
                        <span className="text-xs text-purple-600">{activity.deal.title}</span>
                      )}
                      {activity.dueAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(activity.dueAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Esta semana */}
        <TabsContent value="week" className="mt-4">
          {weekTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma tarefa pendente esta semana
            </div>
          ) : (
            <div className="divide-y border rounded-lg overflow-hidden">
              {weekTasks.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} className="px-4" />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Calendário */}
        <TabsContent value="calendar" className="mt-4">
          <div className="border rounded-lg overflow-hidden">
            {/* Cabeçalho do calendário */}
            <div className="flex items-center justify-between p-4 border-b">
              <button
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setCalendarDate(new Date(year, month - 1, 1))}
              >
                ← Anterior
              </button>
              <h2 className="font-semibold">
                {new Date(year, month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setCalendarDate(new Date(year, month + 1, 1))}
              >
                Próximo →
              </button>
            </div>

            {/* Grade do calendário */}
            <div className="p-4">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {/* Células vazias para alinhar o primeiro dia */}
                {Array(firstDay).fill(null).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}

                {/* Dias do mês */}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                  const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayActivities = calendarByDay[dateKey] ?? [];
                  const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

                  return (
                    <div
                      key={day}
                      className={cn(
                        'aspect-square rounded-md p-1 text-xs flex flex-col',
                        isToday ? 'border-2 border-primary' : 'border border-border',
                        dayActivities.length > 0 && 'bg-primary/5',
                      )}
                    >
                      <span className={cn('font-medium', isToday && 'text-primary')}>
                        {day}
                      </span>
                      {dayActivities.length > 0 && (
                        <Badge variant="secondary" className="text-xs px-1 h-4 mt-auto self-start">
                          {dayActivities.length}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal nova tarefa */}
      <Dialog open={showNewTaskModal} onOpenChange={setShowNewTaskModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <TaskForm
            onSuccess={() => setShowNewTaskModal(false)}
            onCancel={() => setShowNewTaskModal(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
