// Kanban board completo com drag-and-drop usando @dnd-kit
'use client';
import { getApiErrorMessage } from '@/lib/api-error';

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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LOST_REASONS } from '@/lib/funnel';

interface KanbanBoardProps {
  pipeline: Pipeline;
  deals: Deal[];
}

export function KanbanBoard({ pipeline, deals }: KanbanBoardProps) {
  const router = useRouter();
  const moveStage = useMoveStage();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localDeals, setLocalDeals] = useState<Deal[]>(deals);
  const [pendingLost, setPendingLost] = useState<{ dealId: string; stageId: string; title: string } | null>(null);
  const [lostReason, setLostReason] = useState('');
  const [lostNote, setLostNote] = useState('');

  const confirmLost = async () => {
    if (!pendingLost || !lostReason) return;
    try {
      await moveStage.mutateAsync({ dealId: pendingLost.dealId, stageId: pendingLost.stageId, lostReason, lostNote: lostNote || undefined });
      toast.success('Negócio marcado como perdido');
      setPendingLost(null);
      setLostReason('');
      setLostNote('');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao mover negócio'));
    }
  };

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

    // Perdido exige motivo: abre a janela antes de mover (Fase 3)
    if (targetStage.isLost) {
      setPendingLost({ dealId, stageId: targetStageId, title: deal.title });
      return;
    }

    // Atualização otimista
    setLocalDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stageId: targetStageId } : d)),
    );

    try {
      const result = await moveStage.mutateAsync({ dealId, stageId: targetStageId });
      if (result.nextStep?.url) {
        toast.success('Negócio ganho! Abrindo o contrato de venda já preenchido.');
        router.push(result.nextStep.url);
        return;
      }
      toast.success('Negócio movido com sucesso');
    } catch (err) {
      // Reverte
      setLocalDeals(deals);
      toast.error(getApiErrorMessage(err, 'Erro ao mover negócio'));
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

      <Dialog open={!!pendingLost} onOpenChange={(o) => !o && setPendingLost(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcar como perdido</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{pendingLost?.title}</p>
          <div className="space-y-1">
            <Label>Motivo da perda *</Label>
            <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={lostReason} onChange={(e) => setLostReason(e.target.value)}>
              <option value="">Selecione…</option>
              {Object.entries(LOST_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Observação</Label>
            <Textarea rows={3} value={lostNote} onChange={(e) => setLostNote(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPendingLost(null)}>Cancelar</Button>
            <Button onClick={() => void confirmLost()} disabled={!lostReason || moveStage.isPending}>Marcar como perdido</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}
