// Página inicial — Dashboard de venda (Fase 1).
// Indicadores do fluxo de venda, todos calculados no backend
// (GET /reports/sales-dashboard). O que ainda não existe aparece como
// "não disponível", nunca como número inventado.

'use client';

import Link from 'next/link';
import {
  UserPlus, CalendarDays, FileSignature, TrendingUp, BadgeDollarSign,
  ArrowDownCircle, ArrowUpCircle, Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/error-state';
import { useAuthStore } from '@/stores/auth.store';
import { useSalesDashboard } from '@/hooks/use-reports';

function brl(v: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v ?? 0));
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Saudação conforme a hora, com o primeiro nome quando houver. */
function greeting(name?: string | null) {
  const h = new Date().getHours();
  const base = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${base}, ${first}!` : `${base}!`;
}

interface Kpi {
  title: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: string;
  href?: string;
  unavailable?: boolean;
}

export default function DashboardPage() {
  const { user, currentWorkspace } = useAuthStore();
  const { data, isLoading, isError, error, refetch } = useSalesDashboard();

  const kpis: Kpi[] = data
    ? [
        {
          title: 'Leads novos',
          value: String(data.newLeads7d),
          hint: 'Negócios criados nos últimos 7 dias',
          icon: UserPlus,
          tone: 'text-green-600 bg-green-50',
          href: '/pipeline',
        },
        {
          title: 'Visitas da semana',
          value: String(data.visitsThisWeek.total),
          hint: `${plural(data.visitsThisWeek.done, 'realizada', 'realizadas')} (segunda a domingo)`,
          icon: CalendarDays,
          tone: 'text-blue-600 bg-blue-50',
          href: '/visits',
        },
        {
          title: 'Propostas em aberto',
          value: data.openProposals.available ? String(data.openProposals.count ?? 0) : 'Não disponível',
          hint: data.openProposals.available
            ? 'Aguardando resposta'
            : 'O cadastro de propostas ainda não existe no sistema',
          icon: FileSignature,
          tone: 'text-slate-500 bg-slate-100',
          unavailable: !data.openProposals.available,
        },
        {
          title: 'VGV em negociação',
          value: brl(data.vgvInNegotiation.amount),
          hint: `Soma do valor de ${plural(data.vgvInNegotiation.deals, 'negócio aberto', 'negócios abertos')}`,
          icon: TrendingUp,
          tone: 'text-purple-600 bg-purple-50',
          href: '/pipeline',
        },
        {
          title: 'Vendas do mês',
          value: brl(data.salesThisMonth.amount),
          hint: `${plural(data.salesThisMonth.count, 'contrato de venda ativo', 'contratos de venda ativos')} criados no mês`,
          icon: BadgeDollarSign,
          tone: 'text-emerald-600 bg-emerald-50',
          href: '/contracts',
        },
        {
          title: 'Comissões a receber',
          value: brl(data.commissionsReceivable.amount),
          hint: plural(data.commissionsReceivable.count, 'comissão pendente', 'comissões pendentes'),
          icon: ArrowDownCircle,
          tone: 'text-teal-600 bg-teal-50',
          href: '/commissions',
        },
        {
          title: 'Comissões a pagar',
          value: brl(data.commissionsPayable.amount),
          hint: plural(data.commissionsPayable.count, 'pagamento pendente', 'pagamentos pendentes'),
          icon: ArrowUpCircle,
          tone: 'text-amber-600 bg-amber-50',
          href: '/financial?tab=payable',
        },
        {
          title: 'Saldo projetado (30 dias)',
          value: brl(data.projectedBalance30d.amount),
          hint:
            data.projectedBalance30d.bankAccounts > 0
              ? `Saldo em conta ${brl(data.projectedBalance30d.bankBalance)} + a receber ${brl(data.projectedBalance30d.receivable)} − a pagar ${brl(data.projectedBalance30d.payable)}`
              : `Sem conta bancária cadastrada: a receber ${brl(data.projectedBalance30d.receivable)} − a pagar ${brl(data.projectedBalance30d.payable)}`,
          icon: Wallet,
          tone: data.projectedBalance30d.amount < 0 ? 'text-red-600 bg-red-50' : 'text-sky-600 bg-sky-50',
          href: '/financial?tab=cashflow',
        },
      ]
    : [];

  return (
    <div>
      <Header title="Dashboard" />

      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground">{greeting(user?.name)}</h2>
          {currentWorkspace?.workspace.name && (
            <p className="text-sm text-muted-foreground mt-1">{currentWorkspace.workspace.name}</p>
          )}
        </div>

        {isError ? (
          <Card>
            <ErrorState error={error} onRetry={() => refetch()} title="Não foi possível carregar os indicadores" />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {isLoading || !data
              ? Array.from({ length: 8 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6 space-y-3">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-7 w-24" />
                      <Skeleton className="h-3 w-40" />
                    </CardContent>
                  </Card>
                ))
              : kpis.map((kpi) => {
                  const body = (
                    <Card className={kpi.href ? 'transition-shadow hover:shadow-md h-full' : 'h-full'}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                        <div className={`rounded-lg p-2 ${kpi.tone}`}>
                          <kpi.icon className="h-4 w-4" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className={kpi.unavailable ? 'text-base font-medium text-muted-foreground' : 'text-2xl font-bold'}>
                          {kpi.value}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{kpi.hint}</p>
                      </CardContent>
                    </Card>
                  );
                  return kpi.href ? (
                    <Link key={kpi.title} href={kpi.href} className="block">
                      {body}
                    </Link>
                  ) : (
                    <div key={kpi.title}>{body}</div>
                  );
                })}
          </div>
        )}
      </div>
    </div>
  );
}
