'use client';
import { useEffect, useState } from 'react';
import { api, formatBRL, formatPercent } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

interface SimScenario {
  label: string;
  inflationRate: number;
  realReturn: number;
  fiNumber: number;
  fiProgress: number;
  monthsToFI: number;
  projectedDate: string;
}

interface RetirementData {
  plan: {
    id: string;
    desiredIncome: number;
    currentAge: number;
    targetAge: number;
    currentPatrimony: number;
    monthlyContribution: number;
    avgYield: number;
    notes?: string;
  } | null;
  simulation: {
    currentPatrimony: number;
    fiNumber: number;
    fiProgress: number;
    monthsToFI: number;
    scenarios: SimScenario[];
    passiveIncomeCapacity: number;
  } | null;
}

export default function AposentadoriaPage() {
  const [data, setData] = useState<RetirementData>({ plan: null, simulation: null });
  const [rebalance, setRebalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});

  const load = async () => {
    setLoading(true);
    try {
      const [plan, simulation, reb] = await Promise.all([
        api.retirement.get().catch(() => null),
        api.retirement.simulation().catch(() => null),
        api.retirement.rebalance().catch(() => null),
      ]);
      const result = { plan, simulation };
      setData(result);
      setRebalance(reb);
      if (plan) setForm({ ...plan });
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const body = {
        desiredMonthlyIncome: parseFloat(form.desiredMonthlyIncome),
        estimatedMonthlyExpenses: parseFloat(form.estimatedMonthlyExpenses),
        expectedIpca: parseFloat(form.expectedIpca || '4.5'),
        expectedCdi: parseFloat(form.expectedCdi || '10.5'),
        safeWithdrawalRate: parseFloat(form.safeWithdrawalRate || '4.0'),
        lifeExpectancy: parseInt(form.lifeExpectancy || '85'),
        targetFixedIncome: parseFloat(form.targetFixedIncome || '50'),
        targetFii: parseFloat(form.targetFii || '22.5'),
        targetStocks: parseFloat(form.targetStocks || '12.5'),
        targetReceivables: parseFloat(form.targetReceivables || '12.5'),
        targetLiquidity: parseFloat(form.targetLiquidity || '7.5'),
      };
      await api.retirement.save(body);
      setEditing(false);
      load();
    } catch (e: any) { alert(e.message); }
  };

  const sim = data.simulation as any;
  const plan = data.plan as any;

  const currentPatrimony = sim?.totalPatrimony || sim?.currentPatrimony || 0;
  const fiNumber = sim?.fiNumber || 0;
  const fiProgress = sim?.fiProgress || 0;
  const passiveIncome = sim?.currentPassiveIncome || sim?.passiveIncomeCapacity || 0;

  const projectionData = sim ? (() => {
    const points = [];
    // Retorno real mensal vindo do backend (CDI líquido deflacionado pelo IPCA);
    // a projeção fica em valores de hoje, coerente com o Número FI.
    const monthly = sim?.monthlyRealReturn ?? 0.002;
    let patrimony = currentPatrimony;
    const contribution = plan?.monthlyContribution || 0;
    for (let m = 0; m <= 120; m += 6) {
      points.push({ mes: m === 0 ? 'Hoje' : `+${m}m`, Patrimônio: Math.round(patrimony), FI: Math.round(fiNumber) });
      for (let i = 0; i < 6; i++) { patrimony = patrimony * (1 + monthly) + contribution; }
    }
    return points;
  })() : [];

  const scenarioColors = ['var(--positive)', 'var(--gold)', 'var(--negative)'];

  if (loading) return <p style={{ color: 'var(--muted)', padding: 40 }}>Carregando...</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Análise de Aposentadoria</h1>
          <p style={{ color: 'var(--muted)', margin: 0 }}>Simulação de independência financeira</p>
        </div>
        <button className="btn-gold" onClick={() => setEditing(true)}>
          {plan ? 'Editar Plano' : 'Configurar Plano'}
        </button>
      </div>

      {!plan && !editing && (
        <div className="alert-box" style={{ background: 'rgba(201,162,39,0.1)', borderColor: 'var(--gold)' }}>
          <strong>⚙️ Configure seu plano</strong> — Defina sua renda desejada e metas de aposentadoria para ver a simulação.
        </div>
      )}

      {sim && (
        <>
          <div className="kpi-grid" style={{ marginBottom: 24 }}>
            {[
              { label: 'Patrimônio p/ Retirada', value: formatBRL(currentPatrimony), sub: 'Financeiro + VP recebíveis' },
              { label: 'Número FI', value: formatBRL(fiNumber), sub: `${formatPercent(fiProgress)} atingido · TSR ${sim?.safeWithdrawalRate ?? 4}% a.a.` },
              { label: 'Renda Passiva Atual', value: formatBRL(passiveIncome) + '/mês', sub: sim?.monthlyRent ? `Aluguéis: ${formatBRL(sim.monthlyRent)}/mês` : undefined },
              { label: 'Taxa de Cobertura', value: formatPercent(sim?.coverageRate || 0), sub: 'Renda passiva / despesas' },
            ].map(k => (
              <div key={k.label} className="kpi-card">
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{k.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)', marginTop: 4 }}>{k.value}</div>
                {k.sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{k.sub}</div>}
              </div>
            ))}
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Progresso para Independência Financeira</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span>{formatBRL(currentPatrimony)}</span>
              <span style={{ color: 'var(--muted)' }}>Meta: {formatBRL(fiNumber)}</span>
            </div>
            <div style={{ background: 'var(--border)', borderRadius: 8, height: 20, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, fiProgress)}%`,
                background: `linear-gradient(90deg, var(--gold), #E8C547)`,
                height: '100%',
                borderRadius: 8,
                transition: 'width 0.5s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: 8,
                fontSize: 11,
                fontWeight: 700,
                color: '#0D1B2A',
              }}>
                {fiProgress > 15 ? formatPercent(fiProgress) : ''}
              </div>
            </div>
          </div>

          {rebalance?.rows && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
                <h3 style={{ marginTop: 0, fontSize: 15 }}>⚖️ Rebalanceamento — Alvo vs. Real</h3>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Base: {formatBRL(rebalance.total)} (financeiro + recebíveis)
                </span>
              </div>
              {!rebalance.targetSumOk && (
                <div style={{ fontSize: 12, color: '#F59E0B', marginBottom: 10 }}>
                  ⚠️ Suas metas somam {rebalance.targetSum}% — ajuste no plano para totalizar 100%.
                </div>
              )}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Classe', 'Meta', 'Atual', 'Desvio', 'Ação sugerida'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Classe' ? 'left' : 'right', padding: '6px 10px', fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rebalance.rows.map((r: any) => {
                    const outOfBand = Math.abs(r.deviation) > rebalance.rebalanceBand && r.target > 0;
                    const devColor = outOfBand ? (r.deviation > 0 ? '#F59E0B' : '#EF4444') : 'var(--muted)';
                    return (
                      <tr key={r.key} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600 }}>{r.label}</td>
                        <td style={{ padding: '8px 10px', fontSize: 13, textAlign: 'right', color: 'var(--muted)' }}>{r.target > 0 ? `${r.target}%` : '—'}</td>
                        <td style={{ padding: '8px 10px', fontSize: 13, textAlign: 'right', fontWeight: 600 }}>{r.actualPct}%</td>
                        <td style={{ padding: '8px 10px', fontSize: 13, textAlign: 'right', fontWeight: 700, color: devColor }}>
                          {r.target > 0 ? `${r.deviation > 0 ? '+' : ''}${r.deviation} p.p.` : '—'}
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: 13, textAlign: 'right' }}>
                          {r.target > 0 && outOfBand ? (
                            <span style={{ color: r.amountToMove > 0 ? 'var(--positive)' : 'var(--negative)', fontWeight: 600 }}>
                              {r.amountToMove > 0 ? 'Aportar ' : 'Reduzir '}{formatBRL(Math.abs(r.amountToMove))}
                            </span>
                          ) : r.target > 0 ? (
                            <span style={{ color: 'var(--muted)' }}>Dentro da banda</span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
                Banda de tolerância: ±{rebalance.rebalanceBand} p.p. — desvios menores não justificam movimentação (custos e impostos superam o ganho).
                Dica: rebalanceie preferencialmente com aportes novos, evitando vender e realizar IR.
              </div>
            </div>
          )}

          {sim?.scenarios && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            {sim.scenarios.map((s: any, i: number) => (
              <div key={s.name || i} className="card">
                <div style={{ fontSize: 12, color: scenarioColors[i], fontWeight: 600, marginBottom: 4 }}>{(s.name || s.label || '').toUpperCase()}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                  IPCA {s.ipcaScenario}% a.a.{s.realReturn != null ? ` · retorno real ${s.realReturn}% a.a.` : ''}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Sustentabilidade</div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>
                    {s.perpetual ? 'Perpétua (50+ anos)' : `${s.sustainabilityYears} anos`}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Renda Suportada</div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: scenarioColors[i] }}>{formatBRL(sim?.desiredIncome || plan?.desiredMonthlyIncome)}/mês</div>
                </div>
              </div>
            ))}
          </div>
          )}

          {projectionData.length > 0 && (
            <div className="card">
              <h3 style={{ marginTop: 0, fontSize: 15 }}>Projeção Patrimonial (10 anos)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={projectionData}>
                  <XAxis dataKey="mes" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} tickFormatter={v => `R$${(v / 1e6).toFixed(1)}M`} />
                  <Tooltip formatter={(v: any) => formatBRL(v)} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
                  <Legend />
                  <ReferenceLine y={fiNumber} stroke="var(--gold)" strokeDasharray="4 4" label={{ value: 'Meta FI', fill: 'var(--gold)', fontSize: 11 }} />
                  <Line type="monotone" dataKey="Patrimônio" stroke="var(--positive)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="FI" stroke="var(--gold)" strokeWidth={1} strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Configurar Plano de Aposentadoria</h2>
            <div className="form-grid">
              {[
                { key: 'desiredMonthlyIncome', label: 'Renda Mensal Desejada (R$)', type: 'number' },
                { key: 'estimatedMonthlyExpenses', label: 'Despesas Mensais Estimadas (R$)', type: 'number' },
                { key: 'expectedIpca', label: 'IPCA Esperado (% a.a.)', type: 'number' },
                { key: 'expectedCdi', label: 'CDI Esperado (% a.a.)', type: 'number' },
                { key: 'safeWithdrawalRate', label: 'Taxa Segura de Retirada (% a.a.)', type: 'number' },
                { key: 'lifeExpectancy', label: 'Expectativa de Vida (anos)', type: 'number' },
                { key: 'targetFixedIncome', label: 'Meta Renda Fixa (%)', type: 'number' },
                { key: 'targetFii', label: 'Meta FIIs (%)', type: 'number' },
                { key: 'targetStocks', label: 'Meta Ações (%)', type: 'number' },
                { key: 'targetReceivables', label: 'Meta Recebíveis (%)', type: 'number' },
                { key: 'targetLiquidity', label: 'Meta Liquidez/Caixa (%)', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type || 'text'} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(201,162,39,0.08)', border: '1px solid rgba(201,162,39,0.3)', borderRadius: 6, padding: 12, marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
              💡 O Número FI usa a Taxa Segura de Retirada sobre a <strong>lacuna de renda</strong> (renda desejada menos aluguéis, que são corrigidos por IGPM/IPCA). Recebíveis entram como patrimônio pelo valor presente — corrigidos pelo IPCA, mantêm valor real. Padrão de mercado: 3,5–4% a.a. para aposentadorias longas.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn-outline" onClick={() => setEditing(false)}>Cancelar</button>
              <button className="btn-gold" onClick={save}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
