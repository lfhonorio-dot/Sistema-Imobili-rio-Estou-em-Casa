// Card resumido de contrato
'use client';

import Link from 'next/link';
import { Calendar, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Contract } from '@/hooks/use-contracts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TYPE_LABELS: Record<string, string> = {
  SALE: 'Venda',
  RENTAL_RESIDENTIAL: 'Locação Residencial',
  RENTAL_COMMERCIAL: 'Locação Comercial',
  BROKERAGE: 'Intermediação',
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFT: { label: 'Rascunho', variant: 'outline' },
  ACTIVE: { label: 'Ativo', variant: 'default' },
  TERMINATED: { label: 'Encerrado', variant: 'secondary' },
  RESCINDED: { label: 'Rescindido', variant: 'destructive' },
};

interface ContractCardProps {
  contract: Contract;
}

function formatCurrency(value: number | null | undefined) {
  if (!value) return null;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function ContractCard({ contract }: ContractCardProps) {
  const statusConfig = STATUS_CONFIG[contract.status] ?? { label: contract.status, variant: 'outline' as const };

  return (
    <Link href={`/contracts/${contract.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <Badge variant="secondary" className="text-xs mb-1">
                {TYPE_LABELS[contract.type] ?? contract.type}
              </Badge>
              <p className="font-medium text-sm">
                {contract.property?.street
                  ? `${contract.property.street}${contract.property.number ? `, ${contract.property.number}` : ''}`
                  : 'Imóvel não identificado'}
              </p>
              <p className="text-xs text-muted-foreground">
                {[contract.property?.neighborhood, contract.property?.city].filter(Boolean).join(' • ')}
              </p>
            </div>
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
          </div>

          <div className="space-y-1 text-sm text-muted-foreground">
            {contract.owner && (
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>Prop: {contract.owner.name}</span>
              </div>
            )}
            {contract.tenant && (
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>Loc: {contract.tenant.name}</span>
              </div>
            )}
            {contract.startDate && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {format(new Date(contract.startDate), 'dd/MM/yyyy', { locale: ptBR })}
                  {contract.endDate && ` → ${format(new Date(contract.endDate), 'dd/MM/yyyy', { locale: ptBR })}`}
                </span>
              </div>
            )}
          </div>

          {(contract.rentalValue || contract.saleValue) && (
            <p className="mt-2 font-semibold text-sm">
              {formatCurrency(contract.rentalValue ?? contract.saleValue)}
              {contract.rentalValue && '/mês'}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
