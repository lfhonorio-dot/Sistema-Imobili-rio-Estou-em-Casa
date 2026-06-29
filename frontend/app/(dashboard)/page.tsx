// Página inicial do dashboard

'use client';

import { Users, Home, FileText, DollarSign } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth.store';
import { useDashboardKpis } from '@/hooks/use-reports';
import { formatDateTime } from '@/lib/utils';

function brl(v: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v ?? 0));
}

export default function DashboardPage() {
  const { user, currentWorkspace } = useAuthStore();
  const { data: kpis } = useDashboardKpis();

  const metricsCards = [
    {
      title: 'Contatos',
      value: kpis ? String(kpis.totalContacts) : '—',
      icon: Users,
      color: 'text-green-500',
      bg: 'bg-green-50',
      hint: kpis ? `${kpis.openDeals} negócios abertos` : 'Carregando...',
    },
    {
      title: 'Imóveis',
      value: kpis ? String(kpis.totalProperties) : '—',
      icon: Home,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
      hint: kpis ? 'Total cadastrado' : 'Carregando...',
    },
    {
      title: 'Contratos Ativos',
      value: kpis ? String(kpis.activeContracts) : '—',
      icon: FileText,
      color: 'text-purple-500',
      bg: 'bg-purple-50',
      hint: kpis && kpis.overdueCount > 0 ? `${kpis.overdueCount} em atraso` : (kpis ? 'Em dia' : 'Carregando...'),
    },
    {
      title: 'Receita Recebida',
      value: kpis ? brl(kpis.totalRevenue) : '—',
      icon: DollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      hint: kpis ? 'Lançamentos pagos' : 'Carregando...',
    },
  ];

  return (
    <div>
      <Header title="Dashboard" />

      <div className="p-6">
        {/* Boas-vindas */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground">
            Bem-vindo, {user?.name?.split(' ')[0]}!
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {currentWorkspace?.workspace.name} •{' '}
            {user?.lastLoginAt
              ? `Último acesso: ${formatDateTime(user.lastLoginAt)}`
              : 'Primeiro acesso'}
          </p>
        </div>

        {/* Cards de métricas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          {metricsCards.map((card) => (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <div className={`rounded-lg p-2 ${card.bg}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {card.hint}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Informações do workspace */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Seu Workspace</CardTitle>
              <CardDescription>Informações da sua imobiliária</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Nome</span>
                <span className="font-medium">{currentWorkspace?.workspace.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Slug</span>
                <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                  {currentWorkspace?.workspace.slug}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Seu papel</span>
                <span className="font-medium">{currentWorkspace?.role.name}</span>
              </div>
              {currentWorkspace?.isOwner && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tipo</span>
                  <span className="text-blue-600 font-medium">Proprietário</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estágio 1 Concluído</CardTitle>
              <CardDescription>Fundação, Segurança e LGPD</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                'Autenticação JWT com refresh tokens',
                'Autenticação de dois fatores (2FA)',
                'Criptografia AES-256-GCM',
                'Módulo LGPD completo',
                'Logs de auditoria',
                'Rate limiting e headers de segurança',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
