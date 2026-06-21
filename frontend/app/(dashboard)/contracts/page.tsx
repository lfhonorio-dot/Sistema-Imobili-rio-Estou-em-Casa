// Página de listagem de contratos
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus } from 'lucide-react';
import { useContracts } from '@/hooks/use-contracts';
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

function formatCurrency(value: number | null | undefined) {
  if (!value) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
}

export default function ContractsPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useContracts({
    search: search || undefined,
    type: typeFilter || undefined,
    status: statusFilter || undefined,
    page,
    limit: 20,
  });

  const contracts = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contratos</h1>
          <p className="text-muted-foreground text-sm">
            {meta ? `${meta.total} contratos` : 'Carregando...'}
          </p>
        </div>
        <Button asChild>
          <Link href="/contracts/new">
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Contrato
          </Link>
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por endereço ou parte..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="SALE">Venda</SelectItem>
            <SelectItem value="RENTAL_RESIDENTIAL">Locação Residencial</SelectItem>
            <SelectItem value="RENTAL_COMMERCIAL">Locação Comercial</SelectItem>
            <SelectItem value="BROKERAGE">Intermediação</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="DRAFT">Rascunho</SelectItem>
            <SelectItem value="ACTIVE">Ativo</SelectItem>
            <SelectItem value="TERMINATED">Encerrado</SelectItem>
            <SelectItem value="RESCINDED">Rescindido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : contracts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum contrato encontrado</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Imóvel</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Tipo</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Partes</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Período</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Valor</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const statusConfig = STATUS_CONFIG[c.status] ?? { label: c.status, variant: 'outline' as const };
                return (
                  <tr key={c.id} className="border-t hover:bg-gray-50/50">
                    <td className="py-3 px-4 text-sm">
                      <Link href={`/contracts/${c.id}`} className="text-primary hover:underline">
                        {c.property?.street
                          ? `${c.property.street}${c.property.number ? `, ${c.property.number}` : ''}`
                          : c.property?.code ?? '-'}
                      </Link>
                      <p className="text-xs text-muted-foreground">{c.property?.city}</p>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary" className="text-xs">
                        {TYPE_LABELS[c.type] ?? c.type}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <div className="space-y-0.5">
                        {c.owner && <p className="text-xs">Prop: {c.owner.name}</p>}
                        {c.tenant && <p className="text-xs">Loc: {c.tenant.name}</p>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {c.startDate && format(new Date(c.startDate), 'dd/MM/yy', { locale: ptBR })}
                      {c.endDate && ` → ${format(new Date(c.endDate), 'dd/MM/yy', { locale: ptBR })}`}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium">
                      {formatCurrency(c.rentalValue ?? c.saleValue)}
                      {c.rentalValue && <span className="text-xs text-muted-foreground">/mês</span>}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação */}
      {meta && meta.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Página {meta.page} de {meta.pages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
