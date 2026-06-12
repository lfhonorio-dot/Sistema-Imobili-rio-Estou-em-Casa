'use client';
import { useEffect, useState } from 'react';
import { useReports } from '@/hooks/use-reports';

interface Dashboard {
  totalContacts: number;
  totalDeals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  totalProperties: number;
  activeContracts: number;
  totalRevenue: number;
  overdueCount: number;
  automationRuns: number;
}

interface FunnelStage {
  stageId: string;
  stageName: string;
  stageOrder: number;
  dealCount: number;
  totalValue: number;
}

interface DealPerf {
  month: string;
  won: number;
  lost: number;
  total: number;
}

interface PropertyStatusItem {
  status: string;
  count: number;
}

export default function ReportsPage() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') ?? '' : '';
  const workspaceId = typeof window !== 'undefined' ? localStorage.getItem('workspaceId') ?? '' : '';
  const { getDashboard, getCrmFunnel, getDealPerformance, getPropertyStatus } = useReports(token, workspaceId);

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [dealPerf, setDealPerf] = useState<DealPerf[]>([]);
  const [propStatus, setPropStatus] = useState<PropertyStatusItem[]>([]);

  useEffect(() => {
    getDashboard().then(d => d && setDashboard(d));
    getCrmFunnel().then(d => d && setFunnel(d));
    getDealPerformance().then(d => d && setDealPerf(d));
    getPropertyStatus().then(d => d && setPropStatus(d));
  }, []);

  const fmt = (n: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">Relatórios e Analytics</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Contatos', value: dashboard?.totalContacts ?? '-' },
          { label: 'Negócios Abertos', value: dashboard?.openDeals ?? '-' },
          { label: 'Negócios Ganhos', value: dashboard?.wonDeals ?? '-' },
          { label: 'Receita Total', value: dashboard ? fmt(dashboard.totalRevenue) : '-' },
          { label: 'Imóveis Ativos', value: dashboard?.totalProperties ?? '-' },
          { label: 'Automações Exec.', value: dashboard?.automationRuns ?? '-' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-lg border p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className="text-xl font-semibold truncate">{String(card.value)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CRM Funnel */}
        <div className="bg-white rounded-lg border shadow-sm p-4">
          <h2 className="font-semibold mb-3">Funil CRM por Estágio</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2">Estágio</th>
                <th className="pb-2 text-right">Negócios</th>
                <th className="pb-2 text-right">Valor Total</th>
              </tr>
            </thead>
            <tbody>
              {funnel.length === 0 ? (
                <tr><td colSpan={3} className="py-4 text-center text-gray-400">Nenhum dado</td></tr>
              ) : funnel.map(s => (
                <tr key={s.stageId} className="border-b last:border-0">
                  <td className="py-2">{s.stageName}</td>
                  <td className="py-2 text-right">{s.dealCount}</td>
                  <td className="py-2 text-right">{fmt(s.totalValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Property Status */}
        <div className="bg-white rounded-lg border shadow-sm p-4">
          <h2 className="font-semibold mb-3">Status dos Imóveis</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Quantidade</th>
              </tr>
            </thead>
            <tbody>
              {propStatus.length === 0 ? (
                <tr><td colSpan={2} className="py-4 text-center text-gray-400">Nenhum dado</td></tr>
              ) : propStatus.map(s => (
                <tr key={s.status} className="border-b last:border-0">
                  <td className="py-2">{s.status}</td>
                  <td className="py-2 text-right">{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deal Performance */}
      <div className="bg-white rounded-lg border shadow-sm p-4">
        <h2 className="font-semibold mb-3">Performance de Negócios por Mês</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-2">Mês</th>
              <th className="pb-2 text-right">Total</th>
              <th className="pb-2 text-right">Ganhos</th>
              <th className="pb-2 text-right">Perdidos</th>
            </tr>
          </thead>
          <tbody>
            {dealPerf.length === 0 ? (
              <tr><td colSpan={4} className="py-4 text-center text-gray-400">Nenhum dado</td></tr>
            ) : dealPerf.map(d => (
              <tr key={d.month} className="border-b last:border-0">
                <td className="py-2">{d.month}</td>
                <td className="py-2 text-right">{d.total}</td>
                <td className="py-2 text-right text-green-600">{d.won}</td>
                <td className="py-2 text-right text-red-500">{d.lost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
