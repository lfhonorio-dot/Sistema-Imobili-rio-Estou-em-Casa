// Coluna do kanban com suporte a drag-and-drop
'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DealCard } from './deal-card';
import { cn } from '@/lib/utils';
import type { PipelineStage, Deal } from '@/hooks/use-pipelines';

// Componente de card arrastável
interface SortableDealCardProps {
  deal: Deal;
  onClick?: () => void;
}

function SortableDealCard({ deal, onClick }: SortableDealCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <DealCard deal={deal} onClick={onClick} isDragging={isDragging} />
    </div>
  );
}

interface KanbanColumnProps {
  stage: PipelineStage;
  deals: Deal[];
  onDealClick?: (deal: Deal) => void;
}

// Formata valor total em BRL
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(value);
}

export function KanbanColumn({ stage, deals, onDealClick }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: stage.id });

  const totalValue = deals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

  return (
    <div className="flex flex-col min-w-[280px] max-w-[280px] bg-muted/30 rounded-lg">
      {/* Cabeçalho da coluna */}
      <div
        className="p-3 border-b-2 rounded-t-lg"
        style={{ borderBottomColor: stage.color }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: stage.color }}
            />
            <h3 className="text-sm font-semibold">{stage.name}</h3>
          </div>
          <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
            {deals.length}
          </span>
        </div>
        {totalValue > 0 && (
          <p className="text-xs text-muted-foreground mt-1 pl-4">
            {formatCurrency(totalValue)}
          </p>
        )}
      </div>

      {/* Cards arrastáveis */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 p-2 space-y-2 overflow-y-auto min-h-[100px] max-h-[calc(100vh-280px)]',
        )}
      >
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map((deal) => (
            <SortableDealCard
              key={deal.id}
              deal={deal}
              onClick={() => onDealClick?.(deal)}
            />
          ))}
        </SortableContext>

        {deals.length === 0 && (
          <div className="flex items-center justify-center h-16 text-xs text-muted-foreground border-2 border-dashed rounded-md">
            Arraste aqui
          </div>
        )}
      </div>
    </div>
  );
}
