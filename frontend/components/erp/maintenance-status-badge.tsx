// Badge de status de manutenção com cores
import { Badge } from '@/components/ui/badge';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  OPEN: { label: 'Aberta', variant: 'destructive' },
  IN_PROGRESS: { label: 'Em andamento', variant: 'default' },
  AWAITING_QUOTE: { label: 'Aguardando orçamento', variant: 'secondary' },
  COMPLETED: { label: 'Concluída', variant: 'outline' },
  CANCELLED: { label: 'Cancelada', variant: 'outline' },
};

const PRIORITY_CONFIG: Record<string, string> = {
  URGENT: 'text-red-600 font-bold',
  HIGH: 'text-orange-600 font-semibold',
  MEDIUM: 'text-yellow-600',
  LOW: 'text-gray-500',
};

interface MaintenanceStatusBadgeProps {
  status: string;
}

interface MaintenancePriorityProps {
  priority: string;
}

export function MaintenanceStatusBadge({ status }: MaintenanceStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: 'outline' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function MaintenancePriorityLabel({ priority }: MaintenancePriorityProps) {
  const PRIORITY_LABELS: Record<string, string> = {
    URGENT: 'Urgente',
    HIGH: 'Alta',
    MEDIUM: 'Média',
    LOW: 'Baixa',
  };
  const className = PRIORITY_CONFIG[priority] ?? '';
  return <span className={className}>{PRIORITY_LABELS[priority] ?? priority}</span>;
}
