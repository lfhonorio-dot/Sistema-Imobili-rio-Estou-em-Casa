// Componente de cartão de negócio para o kanban
'use client';

import { Flame, Snowflake, Tag, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Deal } from '@/hooks/use-pipelines';

interface DealCardProps {
  deal: Deal;
  className?: string;
  onClick?: () => void;
  isDragging?: boolean;
}

// Formata valor monetário em BRL
function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function DealCard({ deal, className, onClick, isDragging }: DealCardProps) {
  const daysSinceActivity = deal.lastActivityAt
    ? Math.floor((Date.now() - new Date(deal.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div
      className={cn(
        'bg-white border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow',
        isDragging && 'opacity-50 shadow-lg rotate-1',
        className,
      )}
      onClick={onClick}
    >
      {/* Indicadores quente/frio */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium line-clamp-2 flex-1">{deal.title}</h4>
        <div className="flex items-center gap-1 shrink-0">
          {deal.isHot && (
            <span title="Ativo (menos de 3 dias)">
              <Flame className="w-4 h-4 text-orange-500" />
            </span>
          )}
          {deal.isCold && !deal.isHot && (
            <span title="Frio (mais de 7 dias)">
              <Snowflake className="w-4 h-4 text-blue-400" />
            </span>
          )}
        </div>
      </div>

      {/* Contato */}
      {deal.contact && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <User className="w-3 h-3 shrink-0" />
          <span className="truncate">{deal.contact.name}</span>
        </div>
      )}

      {/* Valor */}
      {deal.value != null && (
        <div className="text-sm font-semibold text-primary mb-2">
          {formatCurrency(deal.value)}
        </div>
      )}

      {/* Tags */}
      {deal.tags && deal.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {deal.tags.slice(0, 3).map(({ tag }) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
            >
              <Tag className="w-2.5 h-2.5" />
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Dias sem atividade */}
      {daysSinceActivity !== null && (
        <div className={cn(
          'text-xs mt-1',
          daysSinceActivity > 7 ? 'text-blue-400' : daysSinceActivity < 3 ? 'text-orange-500' : 'text-muted-foreground',
        )}>
          {daysSinceActivity === 0
            ? 'Atividade hoje'
            : `${daysSinceActivity}d sem atividade`}
        </div>
      )}
    </div>
  );
}
