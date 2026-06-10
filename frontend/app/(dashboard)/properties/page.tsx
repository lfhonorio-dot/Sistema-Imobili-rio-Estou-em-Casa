// Página de listagem de imóveis com grid/lista, filtros e busca
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PropertyCard } from '@/components/erp/property-card';
import { PropertyStatusBadge } from '@/components/erp/property-status-badge';
import { useProperties } from '@/hooks/use-properties';
import { Badge } from '@/components/ui/badge';

export default function PropertiesPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useProperties({
    search: search || undefined,
    type: typeFilter || undefined,
    status: statusFilter || undefined,
    purpose: purposeFilter || undefined,
    page,
    limit: 24,
  });

  const properties = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Imóveis</h1>
          <p className="text-muted-foreground text-sm">
            {meta ? `${meta.total} imóveis` : 'Carregando...'}
          </p>
        </div>
        <Button asChild>
          <Link href="/properties/new">
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Imóvel
          </Link>
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por endereço, bairro, cidade..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>

        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="APARTMENT">Apartamento</SelectItem>
            <SelectItem value="HOUSE">Casa</SelectItem>
            <SelectItem value="COMMERCIAL">Comercial</SelectItem>
            <SelectItem value="LAND">Terreno</SelectItem>
            <SelectItem value="WAREHOUSE">Galpão</SelectItem>
            <SelectItem value="LAUNCH">Lançamento</SelectItem>
            <SelectItem value="RURAL">Rural</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="AVAILABLE">Disponível</SelectItem>
            <SelectItem value="RESERVED">Reservado</SelectItem>
            <SelectItem value="RENTED">Alugado</SelectItem>
            <SelectItem value="SOLD">Vendido</SelectItem>
            <SelectItem value="MAINTENANCE">Manutenção</SelectItem>
            <SelectItem value="INACTIVE">Inativo</SelectItem>
          </SelectContent>
        </Select>

        <Select value={purposeFilter} onValueChange={(v) => { setPurposeFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Finalidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="SALE">Venda</SelectItem>
            <SelectItem value="RENTAL">Aluguel</SelectItem>
            <SelectItem value="SALE_RENTAL">Venda/Aluguel</SelectItem>
          </SelectContent>
        </Select>

        {/* Toggle grid/lista */}
        <div className="flex border rounded-md overflow-hidden">
          <button
            className={`p-2 ${view === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-gray-50'}`}
            onClick={() => setView('grid')}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            className={`p-2 ${view === 'list' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-gray-50'}`}
            onClick={() => setView('list')}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando imóveis...</div>
      ) : properties.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Nenhum imóvel encontrado</p>
          <Button className="mt-4" asChild>
            <Link href="/properties/new">Cadastrar primeiro imóvel</Link>
          </Button>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {properties.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Imóvel</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Endereço</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Valor</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr key={p.id} className="border-t hover:bg-gray-50/50">
                  <td className="py-3 px-4">
                    <p className="text-sm font-medium">{p.code}</p>
                    <p className="text-xs text-muted-foreground">{p.type}</p>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {p.street ? `${p.street}${p.number ? `, ${p.number}` : ''}` : '-'}
                    <p className="text-xs text-muted-foreground">{p.city}</p>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {p.salePrice
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(p.salePrice))
                      : p.rentalPrice
                      ? `${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(p.rentalPrice))}/mês`
                      : '-'}
                  </td>
                  <td className="py-3 px-4">
                    <PropertyStatusBadge status={p.status} />
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
          <p className="text-sm text-muted-foreground">
            Página {meta.page} de {meta.pages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
