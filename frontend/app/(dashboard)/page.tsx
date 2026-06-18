'use client';
import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { api, formatBRL, ASSET_TYPE_LABELS, ASSET_TYPE_COLORS, MONTH_NAMES } from '@/lib/api';

function KPICard({ title, value, sub, color = '#F1F5F9' }: { title: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{title}</div>
      <div className="kpi-value" style={{ color }}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

const CT = { background: '#112236', border: '1px solid #1E3A5F', borderRadius: 8, color: '#F1F5F9', fontSize: '0.8rem' };

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.dashboard.get(), api.dashboard.alerts()])
      .then(([d, a]) => { setData(d); setAlerts(a); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: '5rem', color: '#94A3B8', fontSize: '0.875rem' }}>Carregando dashboard...</div>;
  if (!data) return <div style={{ textAlign: 'center', padding: '5rem', color: '#EF4444' }}>Erro ao carregar dados. Verifique se o backend está rodando.</div>;

  const pieData = [
    ...Object.entries(data.byType || {}).map(([type, value]: any) => ({
      name: ASSET_TYPE_LABELS[type] || type, value, color: ASSET_TYPE_COLORS[type] || '#888',
    })),
    ...(data.receivablesTotal > 0 ? [{ name: 'Recebíveis', value: data.receivablesTotal, color: '#C9A227' }] : []),
  ];

  const evolutionData = (data.evolution || []).map((s: any) => ({
    name: `${MONTH_NAMES[(s.month || 1) - 1]}/${String(s.year || 2024).slice(2)}`,
    'Patrimônio': Number(s.totalPatrimony) || 0,
    'Renda Passiva': Number(s.monthlyPassiveIncome) || 0,
  }));

  const allocationTarget: Record<string, number> = { RENDA_FIXA: 50, FII: 22.5, ACAO: 12.5, RECEBIVEIS: 12.5, CAIXA: 7.5 };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Visão consolidada do patrimônio —{' '}
            {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button className="btn-outline" onClick={() => api.snapshots.create().catch(console.error)}>
          📸 Salvar Snapshot
        </button>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <KPICard title="Patrimônio Total" value={formatBRL(data.totalPatrimony)} color="#C9A227" />
        <KPICard title="Renda Passiva Mensal" value={formatBRL(data.monthlyPassiveIncome)} color="#22C55E"
          sub={`Cobertura: ${data.monthlyPassiveIncome && data.totalPatrimony ? ((data.monthlyPassiveIncome / (data.totalPatrimony * 0.006)) * 100).toFixed(0) + '%' : '-'}`} />
        <KPICard title="Aluguéis Mensais" value={formatBRL(data.monthlyRent)} sub="Renda de imóveis" />
        <KPICard title="Recebíveis Mensais" value={formatBRL(data.monthlyReceivables)} sub="Carteiras de loteamento" />
        <KPICard title="Rendimentos FIIs" value={formatBRL(data.monthlyFIIIncome)} sub="Distribuições mensais" />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="section-title">⚠️ Alertas</div>
          {alerts.map((a: any, i: number) => (
            <div key={i} className={`alert-box ${a.severity === 'warning' ? 'alert-warning' : 'alert-info'}`}>
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <div className="card">
          <div className="section-title">Alocação por Classe de Ativo</div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} dataKey="value" paddingAngle={2}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v: any) => formatBRL(v)} contentStyle={CT} />
              <Legend wrapperStyle={{ color: '#94A3B8', fontSize: '0.72rem' }} formatter={v => v} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="section-title">Evolução Patrimonial (12 meses)</div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={evolutionData} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
              <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={v => `${(v / 1_000_000).toFixed(1)}M`} />
              <Tooltip formatter={(v: any) => formatBRL(v)} contentStyle={CT} />
              <Bar dataKey="Patrimônio" fill="#C9A227" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
        {/* Renda passiva evolution */}
        <div className="card">
          <div className="section-title">Renda Passiva Mensal</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={evolutionData} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
              <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => formatBRL(v)} contentStyle={CT} />
              <Line type="monotone" dataKey="Renda Passiva" stroke="#22C55E" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Allocation target vs actual */}
        <div className="card">
          <div className="section-title">Alocação Alvo vs Real</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {Object.entries(allocationTarget).map(([type, target]) => {
              const actual = data.allocationActual?.[type] || 0;
              return (
                <div key={type}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>{ASSET_TYPE_LABELS[type]}</span>
                    <span style={{ fontSize: '0.75rem' }}>
                      <span style={{ color: ASSET_TYPE_COLORS[type] }}>{actual.toFixed(1)}%</span>
                      <span style={{ color: '#4a6fa5' }}> / meta {target}%</span>
                    </span>
                  </div>
                  <div style={{ background: '#1E3A5F', borderRadius: 3, height: 7, position: 'relative', overflow: 'visible' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(actual, 100)}%`, background: ASSET_TYPE_COLORS[type], borderRadius: 3 }} />
                    <div style={{ position: 'absolute', left: `${Math.min(target, 100)}%`, top: -3, bottom: -3, width: 2, background: '#94A3B8', borderRadius: 1 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Patrimony breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        <div className="kpi-card">
          <div className="kpi-label" style={{ color: '#22C55E' }}>🟢 Imóveis para Renda</div>
          <div className="kpi-value positive">{formatBRL(data.propertiesRent)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label" style={{ color: '#3B82F6' }}>🔵 Imóveis Uso Próprio</div>
          <div className="kpi-value">{formatBRL(data.propertiesOwn)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label" style={{ color: '#F59E0B' }}>🟡 Imóveis a Comercializar</div>
          <div className="kpi-value warning-text">{formatBRL(data.propertiesSale)}</div>
        </div>
      </div>
    </>
  );
}
