// Badge de status de imóvel com cores por status
import { Badge } from '@/components/ui/badge';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  AVAILABLE: { label: 'Disponível', variant: 'default' },
  RESERVED: { label: 'Reservado', variant: 'secondary' },
  RENTED: { label: 'Alugado', variant: 'secondary' },
  SOLD: { label: 'Vendido', variant: 'outline' },
  MAINTENANCE: { label: 'Manutenção', variant: 'destructive' },
  INACTIVE: { label: 'Inativo', variant: 'outline' },
};

interface PropertyStatusBadgeProps {
  status: string;
}

export function PropertyStatusBadge({ status }: PropertyStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: 'outline' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
