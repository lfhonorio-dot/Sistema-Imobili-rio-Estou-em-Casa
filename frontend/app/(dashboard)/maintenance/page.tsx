// Página de ordens de manutenção
'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { MaintenanceStatusBadge, MaintenancePriorityLabel } from '@/components/erp/maintenance-status-badge';
import { useMaintenanceOrders, useChangeMaintenanceStatus } from '@/hooks/use-maintenance';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TYPE_LABELS: Record<string, string> = {
  ELECTRICAL: 'Elétrica', PLUMBING: 'Hidráulica', STRUCTURAL: 'Estrutural',
  PAINTING: 'Pintura', LOCKSMITH: 'Serralheria', OTHER: 'Outro',
};

const REQUESTED_BY_LABELS: Record<string, string> = {
  OWNER: 'Proprietário', TENANT: 'Inquilino', BROKER: 'Corretor', AGENCY: 'Imobiliária',
};

export default function MaintenancePage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useMaintenanceOrders({
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    type: typeFilter || undefined,
    page,
    limit: 20,
  });

  const changeStatus = useChangeMaintenanceStatus();
  const orders = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Manutenção</h1>
        <p className="text-muted-foreground text-sm">
          {meta ? `${meta.total} ordens` : 'Carregando...'}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="OPEN">Aberta</SelectItem>
            <SelectItem value="IN_PROGRESS">Em andamento</SelectItem>
            <SelectItem value="AWAITING_QUOTE">Aguardando orçamento</SelectItem>
            <SelectItem value="COMPLETED">Concluída</SelectItem>
            <SelectItem value="CANCELLED">Cancelada</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="URGENT">Urgente</SelectItem>
            <SelectItem value="HIGH">Alta</SelectItem>
            <SelectItem value="MEDIUM">Média</SelectItem>
            <SelectItem value="LOW">Baixa</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="ELECTRICAL">Elétrica</SelectItem>
            <SelectItem value="PLUMBING">Hidráulica</SelectItem>
            <SelectItem value="STRUCTURAL">Estrutural</SelectItem>
            <SelectItem value="PAINTING">Pintura</SelectItem>
            <SelectItem value="LOCKSMITH">Serralheria</SelectItem>
            <SelectItem value="OTHER">Outro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhuma ordem encontrada</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Imóvel</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Título</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Tipo</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Prioridade</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Solicitante</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Data</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t hover:bg-gray-50/50">
                  <td className="py-3 px-4 text-sm">
                    <p>{order.property?.street ?? order.propertyId}</p>
                    <p className="text-xs text-muted-foreground">{order.property?.city}</p>
                  </td>
                  <td className="py-3 px-4 text-sm font-medium">{order.title}</td>
                  <td className="py-3 px-4 text-sm">
                    <Badge variant="outline" className="text-xs">
                      {TYPE_LABELS[order.type] ?? order.type}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <MaintenancePriorityLabel priority={order.priority} />
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {REQUESTED_BY_LABELS[order.requestedBy] ?? order.requestedBy}
                  </td>
                  <td className="py-3 px-4">
                    <MaintenanceStatusBadge status={order.status} />
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {format(new Date(order.createdAt), 'dd/MM/yy', { locale: ptBR })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação */}
      {meta && meta.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Página {meta.page} de {meta.pages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
}
