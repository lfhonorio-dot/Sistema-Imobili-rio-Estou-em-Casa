// Linha de tabela para lançamento financeiro
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import type { FinancialEntry } from '@/hooks/use-financial';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: 'Pendente', icon: <Clock className="w-3.5 h-3.5" />, variant: 'secondary' },
  PAID: { label: 'Pago', icon: <CheckCircle className="w-3.5 h-3.5" />, variant: 'default' },
  OVERDUE: { label: 'Atrasado', icon: <AlertTriangle className="w-3.5 h-3.5" />, variant: 'destructive' },
  CANCELLED: { label: 'Cancelado', icon: null, variant: 'outline' },
  EXEMPT: { label: 'Isento', icon: null, variant: 'outline' },
};

const CATEGORY_LABELS: Record<string, string> = {
  RENT: 'Aluguel',
  SALE: 'Venda',
  ADMINISTRATION: 'Administração',
  COMMISSION: 'Comissão',
  MAINTENANCE: 'Manutenção',
  MARKETING: 'Marketing',
  OTHER: 'Outro',
};

interface FinancialEntryRowProps {
  entry: FinancialEntry;
  onPay?: (id: string) => void;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function FinancialEntryRow({ entry, onPay }: FinancialEntryRowProps) {
  const statusConfig = STATUS_CONFIG[entry.status] ?? { label: entry.status, icon: null, variant: 'outline' as const };
  const isOverdue = entry.status === 'PENDING' && new Date(entry.dueDate) < new Date();

  return (
    <tr className="border-b last:border-0 hover:bg-gray-50/50">
      <td className="py-3 px-4 text-sm">
        <div>
          <p className="font-medium">{entry.description}</p>
          <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[entry.category] ?? entry.category}</p>
        </div>
      </td>
      <td className="py-3 px-4 text-sm text-muted-foreground">
        {format(new Date(entry.dueDate), 'dd/MM/yyyy', { locale: ptBR })}
        {isOverdue && <span className="ml-1 text-red-500 text-xs">(atrasado)</span>}
      </td>
      <td className="py-3 px-4 text-sm font-semibold">
        {formatCurrency(Number(entry.amount))}
      </td>
      <td className="py-3 px-4">
        <Badge variant={statusConfig.variant} className="flex items-center gap-1 w-fit">
          {statusConfig.icon}
          {statusConfig.label}
        </Badge>
      </td>
      <td className="py-3 px-4 text-sm">
        {entry.status === 'PENDING' && onPay && (
          <Button size="sm" variant="outline" onClick={() => onPay(entry.id)}>
            Receber
          </Button>
        )}
      </td>
    </tr>
  );
}
