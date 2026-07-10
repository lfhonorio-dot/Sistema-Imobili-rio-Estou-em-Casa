'use client';
import { useState } from 'react';
import { api, formatBRL, formatPercent, ASSET_TYPE_LABELS, CATEGORY_LABELS, MONTH_NAMES } from '@/lib/api';

interface ReportSection {
  title: string;
  description: string;
  icon: string;
  action: () => Promise<void>;
}

export default function RelatoriosPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [preview, setPreview] = useState<any | null>(null);

  const run = async (key: string, fn: () => Promise<any>) => {
    setLoading(key);
    try {
      const data = await fn();
      setPreview({ key, data });
    } catch (e: any) { alert(e.message); }
    setLoading(null);
  };

  const sections: { key: string; title: string; desc: string; icon: string; fn: () => Promise<any> }[] = [
    {
      key: 'patrimony',
      title: 'Resumo Patrimonial',
      desc: 'Visão consolidada de todos os ativos, imóveis e recebíveis com totais por categoria.',
      icon: '📊',
      fn: async () => {
        const dash = await api.dashboard.get();
        return dash;
      },
    },
    {
      key: 'assets',
      title: 'Carteira de Investimentos',
      desc: 'Lista completa de ativos com rentabilidade, vencimentos e alocação.',
      icon: '💼',
      fn: async () => {
        const [assets, summary] = await Promise.all([api.assets.list({}), api.assets.summary()]);
        return { assets, summary };
      },
    },
    {
      key: 'properties',
      title: 'Relatório de Imóveis',
      desc: 'Imóveis por classificação com avaliação, aluguel e yield.',
      icon: '🏠',
      fn: async () => {
        const [props, summary] = await Promise.all([api.properties.list({}), api.properties.summary()]);
        return { props, summary };
      },
    },
    {
      key: 'cashflow',
      title: 'Fluxo de Caixa Anual',
      desc: 'Evolução mensal de receitas e despesas nos últimos 12 meses.',
      icon: '💰',
      fn: async () => {
        return api.cashFlow.evolution();
      },
    },
    {
      key: 'retirement',
      title: 'Análise de Aposentadoria',
      desc: 'Progresso para independência financeira e cenários de simulação.',
      icon: '🎯',
      fn: async () => {
        const [plan, simulation] = await Promise.all([
          api.retirement.get().catch(() => null),
          api.retirement.simulation().catch(() => null),
        ]);
        return { plan, simulation };
      },
    },
    {
      key: 'receivables',
      title: 'Recebíveis Detalhado',
      desc: 'Carteiras de recebíveis com histórico de pagamentos e progresso.',
      icon: '📋',
      fn: async () => {
        return api.receivables.list();
      },
    },
  ];

  const renderPreview = () => {
    if (!preview) return null;
    const { key, data } = preview;

    if (key === 'patrimony') {
      return (
        <div>
          <h3>Resumo Patrimonial</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { l: 'Patrimônio Total', v: formatBRL(data.totalPatrimony) },
              { l: 'Financeiro', v: formatBRL(data.financialTotal) },
              { l: 'Recebíveis', v: formatBRL(data.receivablesTotal) },
              { l: 'Imóveis Renda', v: formatBRL(data.propertiesRent) },
              { l: 'Imóveis Uso Próprio', v: formatBRL(data.propertiesOwn) },
              { l: 'Imóveis A Comercializar', v: formatBRL(data.propertiesSale) },
            ].map(i => (
              <div key={i.l} style={{ background: 'var(--bg)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{i.l}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)' }}>{i.v}</div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Alocação por tipo</div>
            {Object.entries(data.byType || {}).map(([type, total]: any) => {
              const pct = data.totalPatrimony ? (Number(total) / Number(data.totalPatrimony)) * 100 : 0;
              return (
                <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span>{ASSET_TYPE_LABELS[type] || type}</span>
                  <span style={{ color: 'var(--gold)' }}>{formatBRL(total)} ({formatPercent(pct)})</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (key === 'assets') {
      const { assets, summary } = data;
      return (
        <div>
          <h3>Carteira de Investimentos</h3>
          <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--muted)' }}>
            Total: <strong style={{ color: 'var(--gold)' }}>{formatBRL(summary.total)}</strong> — {assets.length} ativos
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Nome', 'Tipo', 'Emissor', 'Aplicado', 'Atual', 'Rend.'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--muted)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets.map((a: any) => {
                const ret = a.currentValue && a.investedAmount ? ((a.currentValue - a.investedAmount) / a.investedAmount * 100) : 0;
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 8px' }}>{a.name}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--muted)' }}>{a.type}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--muted)' }}>{a.issuer || a.broker}</td>
                    <td style={{ padding: '6px 8px' }}>{formatBRL(a.investedAmount)}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--gold)' }}>{formatBRL(a.currentValue)}</td>
                    <td style={{ padding: '6px 8px', color: ret >= 0 ? 'var(--positive)' : 'var(--negative)' }}>{formatPercent(ret)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    if (key === 'cashflow') {
      return (
        <div>
          <h3>Fluxo de Caixa — Últimos 12 Meses</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Mês/Ano', 'Receitas', 'Despesas', 'Saldo'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--muted)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row: any) => (
                <tr key={`${row.year}-${row.month}`} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px' }}>{MONTH_NAMES[(row.month || 1) - 1]}/{row.year}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--positive)' }}>{formatBRL(row.totalReceitas)}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--negative)' }}>{formatBRL(row.totalDespesas)}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: row.saldo >= 0 ? 'var(--positive)' : 'var(--negative)' }}>{formatBRL(row.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (key === 'retirement') {
      const { plan, simulation: sim } = data;
      if (!plan) return <p style={{ color: 'var(--muted)' }}>Nenhum plano configurado.</p>;
      return (
        <div>
          <h3>Análise de Aposentadoria</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { l: 'Renda Desejada', v: formatBRL(plan.desiredMonthlyIncome) + '/mês' },
              { l: 'Patrimônio Atual', v: formatBRL(sim?.totalPatrimony || 0) },
              { l: 'Número FI', v: formatBRL(sim?.fiNumber || 0) },
              { l: 'Progresso FI', v: formatPercent(sim?.fiProgress || 0) },
            ].map(i => (
              <div key={i.l} style={{ background: 'var(--bg)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{i.l}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)' }}>{i.v}</div>
              </div>
            ))}
          </div>
          {sim?.scenarios && (
            <div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Cenários de sustentabilidade</div>
              {sim.scenarios.map((s: any) => (
                <div key={s.name || s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span style={{ textTransform: 'capitalize' }}>{s.name || s.label} (IPCA {s.ipcaScenario}%)</span>
                  <span>{s.perpetual ? '✅ Perpétua (50+ anos)' : `${s.sustainabilityYears} anos`}{s.realReturn != null ? ` · retorno real ${s.realReturn}% a.a.` : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (key === 'properties') {
      const props = data.props || [];
      return (
        <div>
          <h3>Relatório de Imóveis</h3>
          <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--muted)' }}>
            Total: <strong style={{ color: 'var(--gold)' }}>{formatBRL(data.summary?.total || 0)}</strong> — {props.length} imóveis · Aluguéis: {formatBRL(data.summary?.monthlyRent || 0)}/mês
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Nome', 'Classificação', 'Avaliação', 'Aluguel', 'Yield'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--muted)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.map((p: any) => {
                const yld = p.rentAmount && p.currentValuation ? (Number(p.rentAmount) / Number(p.currentValuation) * 100) : 0;
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 8px' }}>{p.name}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--muted)' }}>{p.classification}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--gold)' }}>{formatBRL(p.currentValuation)}</td>
                    <td style={{ padding: '6px 8px' }}>{p.rentAmount ? formatBRL(p.rentAmount) : '-'}</td>
                    <td style={{ padding: '6px 8px' }}>{yld ? formatPercent(yld) + '/mês' : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    if (key === 'receivables') {
      const portfolios = Array.isArray(data) ? data : [];
      return (
        <div>
          <h3>Recebíveis Detalhado</h3>
          <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--muted)' }}>
            {portfolios.length} carteiras · Valor presente total: <strong style={{ color: 'var(--gold)' }}>{formatBRL(portfolios.reduce((s: number, p: any) => s + Number(p.presentValue || 0), 0))}</strong>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Carteira', 'Valor Presente', 'A Receber Futuro', 'Recebido/mês', 'Prazo (meses)'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--muted)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {portfolios.map((p: any) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 8px' }}>{p.name}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--gold)' }}>{formatBRL(p.presentValue)}</td>
                  <td style={{ padding: '6px 8px' }}>{formatBRL(p.futureTotalReceivable)}</td>
                  <td style={{ padding: '6px 8px' }}>{formatBRL(p.monthlyReceivedAmount)}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--muted)' }}>{p.averageRemainingTerm || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div>
        <h3>Dados do Relatório</h3>
        <pre style={{ color: 'var(--muted)', fontSize: 11, overflow: 'auto', maxHeight: 400 }}>{JSON.stringify(data, null, 2)}</pre>
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Relatórios</h1>
          <p style={{ color: 'var(--muted)', margin: 0 }}>Análises e exportações do patrimônio</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {sections.map(s => (
          <div key={s.key} className="card" style={{ cursor: 'pointer' }} onClick={() => run(s.key, s.fn)}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>{s.icon}</div>
            <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{s.title}</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 16px' }}>{s.desc}</p>
            <button className="btn-gold" style={{ fontSize: 13, padding: '8px 16px' }} disabled={loading === s.key}>
              {loading === s.key ? 'Gerando...' : 'Gerar Relatório'}
            </button>
          </div>
        ))}
      </div>

      {preview && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div />
            <button className="btn-icon" onClick={() => setPreview(null)} style={{ fontSize: 18 }}>✕</button>
          </div>
          {renderPreview()}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button className="btn-outline" style={{ fontSize: 13 }} onClick={() => {
              const blob = new Blob([JSON.stringify(preview.data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `relatorio-${preview.key}-${new Date().toISOString().split('T')[0]}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}>
              ⬇ Exportar JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
