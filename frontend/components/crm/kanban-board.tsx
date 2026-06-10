// Kanban board completo com drag-and-drop usando @dnd-kit
'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragStartEvent,
} from '@dnd-kit/core';
import { useRouter } from 'next/navigation';
import { KanbanColumn } from './kanban-column';
import { useMoveStage } from '@/hooks/use-deals';
import type { Pipeline, Deal } from '@/hooks/use-pipelines';
import { toast } from 'sonner';

interface KanbanBoardProps {
  pipeline: Pipeline;
  deals: Deal[];
}

export function KanbanBoard({ pipeline, deals }: KanbanBoardProps) {
  const router = useRouter();
  const moveStage = useMoveStage();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localDeals, setLocalDeals] = useState<Deal[]>(deals);

  // Atualiza quando deals muda externamente
  if (JSON.stringify(deals.map(d => d.id)) !== JSON.stringify(localDeals.map(d => d.id))) {
    setLocalDeals(deals);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const dealId = String(active.id);
    const targetStageId = String(over.id);

    // Verifica se o destino é um estágio válido
    const targetStage = pipeline.stages.find((s) => s.id === targetStageId);
    if (!targetStage) return;

    const deal = localDeals.find((d) => d.id === dealId);
    if (!deal || deal.stageId === targetStageId) return;

    // Se o estágio é de perda, não permite drag direto — exige motivo
    if (targetStage.isLost) {
      toast.error('Para marcar como perdido, use o botão "Mover Etapa" no negócio');
      return;
    }

    // Atualização otimista
    setLocalDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stageId: targetStageId } : d)),
    );

    try {
      await moveStage.mutateAsync({ dealId, stageId: targetStageId });
      toast.success('Negócio movido com sucesso');
    } catch {
      // Reverte
      setLocalDeals(deals);
      toast.error('Erro ao mover negócio');
    }
  }, [localDeals, pipeline.stages, moveStage, deals]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const dealId = String(active.id);
    const overId = String(over.id);

    // Verifica se estamos sobre um estágio
    const overStage = pipeline.stages.find((s) => s.id === overId);
    if (overStage) return;

    // Verifica se estamos sobre outro card
    const overDeal = localDeals.find((d) => d.id === overId);
    if (!overDeal) return;

    const activeDeal = localDeals.find((d) => d.id === dealId);
    if (!activeDeal || activeDeal.stageId === overDeal.stageId) return;

    setLocalDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stageId: overDeal.stageId } : d)),
    );
  }, [localDeals, pipeline.stages]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={(e) => void handleDragEnd(e)}
      onDragOver={handleDragOver}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {pipeline.stages
          .sort((a, b) => a.order - b.order)
          .map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              deals={localDeals.filter((d) => d.stageId === stage.id)}
              onDealClick={(deal) => router.push(`/deals/${deal.id}`)}
            />
          ))}
      </div>
    </DndContext>
  );
}
