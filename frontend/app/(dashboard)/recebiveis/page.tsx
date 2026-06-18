'use client';
import { useEffect, useState } from 'react';
import { api, formatBRL, formatPercent, MONTH_NAMES } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Portfolio {
  id: string;
  name: string;
  developer: string;
  totalValue: number;
  receivedToDate: number;
  monthlyExpected: number;
  startDate: string;
  endDate: string;
  notes?: string;
  monthlyHistory: { year: number; month: number; expected: number; received: number }[];
}

export default function ReceiveisPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Portfolio | null | 'new'>(null);
  const [histModal, setHistModal] = useState<Portfolio | null>(null);
  const [form, setForm] = useState<any>({});
  const [histForm, setHistForm] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, expected: '', received: '' });

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.receivables.list();
      setPortfolios(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm({ name: '', developer: '', totalValue: '', receivedToDate: '', monthlyExpected: '', startDate: '', endDate: '', notes: '' });
    setModal('new');
  };

  const openEdit = (p: Portfolio) => {
    setForm({
      ...p,
      totalValue: p.totalValue,
      receivedToDate: p.receivedToDate,
      monthlyExpected: p.monthlyExpected,
      startDate: p.startDate?.split('T')[0],
      endDate: p.endDate?.split('T')[0],
    });
    setModal(p);
  };

  const save = async () => {
    try {
      const body = {
        ...form,
        totalValue: parseFloat(form.totalValue),
        receivedToDate: parseFloat(form.receivedToDate),
        monthlyExpected: parseFloat(form.monthlyExpected),
      };
      if (modal === 'new') await api.receivables.create(body);
      else await api.receivables.update((modal as Portfolio).id, body);
      setModal(null);
      load();
    } catch (e: any) { alert(e.message); }
  };

  const del = async (id: string) => {
    if (!confirm('Excluir carteira?')) return;
    await api.receivables.delete(id);
    load();
  };

  const addHistory = async () => {
    if (!histModal) return;
    try {
      await api.receivables.addHistory(histModal.id, {
        year: parseInt(histForm.year as any),
        month: parseInt(histForm.month as any),
        expected: parseFloat(histForm.expected),
        received: parseFloat(histForm.received),
      });
      load();
      setHistModal(null);
    } catch (e: any) { alert(e.message); }
  };

  const chartData = (p: Portfolio) => {
    const hist = [...(p.monthlyHistory || [])].sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month)).slice(-6);
    return hist.map(h => ({
      name: `${MONTH_NAMES[h.month - 1].slice(0, 3)}/${h.year}`,
      Previsto: Number(h.expected),
      Realizado: Number(h.received),
    }));
  };

  const totalExpected = portfolios.reduce((s, p) => s + Number(p.monthlyExpected), 0);
  const totalReceived = portfolios.reduce((s, p) => s + Number(p.receivedToDate), 0);
  const totalValue = portfolios.reduce((s, p) => s + Number(p.totalValue), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Recebíveis</h1>
          <p style={{ color: 'var(--muted)', margin: 0 }}>Carteiras de recebíveis imobiliários</p>
        </div>
        <button className="btn-gold" onClick={openNew}>+ Nova Carteira</button>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        {[
          { label: 'Valor Total', value: formatBRL(totalValue) },
          { label: 'Recebido Acumulado', value: formatBRL(totalReceived) },
          { label: 'Previsão Mensal', value: formatBRL(totalExpected) },
          { label: 'Carteiras Ativas', value: portfolios.length.toString() },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)', marginTop: 4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Carregando...</p>
      ) : portfolios.map(p => {
        const progress = p.totalValue > 0 ? (p.receivedToDate / p.totalValue) * 100 : 0;
        const data = chartData(p);
        return (
          <div key={p.id} className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>{p.name}</h2>
                <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>{p.developer}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-outline" style={{ fontSize: 13, padding: '6px 12px' }}
                  onClick={() => { setHistModal(p); setHistForm({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, expected: String(p.monthlyExpected), received: '' }); }}>
                  + Histórico
                </button>
                <button className="btn-outline" style={{ fontSize: 13, padding: '6px 12px' }} onClick={() => openEdit(p)}>Editar</button>
                <button className="btn-danger" style={{ fontSize: 13, padding: '6px 12px' }} onClick={() => del(p.id)}>Excluir</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
              <div><div style={{ color: 'var(--muted)', fontSize: 12 }}>Valor Total</div><div style={{ fontWeight: 600 }}>{formatBRL(p.totalValue)}</div></div>
              <div><div style={{ color: 'var(--muted)', fontSize: 12 }}>Recebido</div><div style={{ fontWeight: 600, color: 'var(--positive)' }}>{formatBRL(p.receivedToDate)}</div></div>
              <div><div style={{ color: 'var(--muted)', fontSize: 12 }}>A Receber</div><div style={{ fontWeight: 600, color: 'var(--gold)' }}>{formatBRL(Math.max(0, p.totalValue - p.receivedToDate))}</div></div>
              <div><div style={{ color: 'var(--muted)', fontSize: 12 }}>Previsão/mês</div><div style={{ fontWeight: 600 }}>{formatBRL(p.monthlyExpected)}</div></div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
                <span>Progresso de recebimento</span>
                <span>{formatPercent(progress)}</span>
              </div>
              <div style={{ background: 'var(--border)', borderRadius: 4, height: 8 }}>
                <div style={{ width: `${Math.min(100, progress)}%`, background: 'var(--gold)', borderRadius: 4, height: 8, transition: 'width 0.3s' }} />
              </div>
            </div>

            {data.length > 0 && (
              <div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Últimos 6 meses — Previsto vs Realizado</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data}>
                    <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => formatBRL(v)} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
                    <Legend />
                    <Bar dataKey="Previsto" fill="#4B6CB7" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Realizado" fill="var(--gold)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );
      })}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>{modal === 'new' ? 'Nova Carteira' : 'Editar Carteira'}</h2>
            <div className="form-grid">
              {[
                { key: 'name', label: 'Nome da Carteira', span: 2 },
                { key: 'developer', label: 'Incorporadora/Emissora', span: 2 },
                { key: 'totalValue', label: 'Valor Total (R$)', type: 'number' },
                { key: 'receivedToDate', label: 'Recebido Acumulado (R$)', type: 'number' },
                { key: 'monthlyExpected', label: 'Previsão Mensal (R$)', type: 'number' },
                { key: 'startDate', label: 'Início', type: 'date' },
                { key: 'endDate', label: 'Previsão de Término', type: 'date' },
                { key: 'notes', label: 'Observações', span: 2 },
              ].map(f => (
                <div key={f.key} className={f.span === 2 ? 'span-2' : ''}>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type || 'text'} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn-outline" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-gold" onClick={save}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {histModal && (
        <div className="modal-overlay" onClick={() => setHistModal(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Adicionar Histórico — {histModal.name}</h2>
            <div className="form-grid">
              {[
                { key: 'year', label: 'Ano', type: 'number' },
                { key: 'month', label: 'Mês (1-12)', type: 'number' },
                { key: 'expected', label: 'Previsto (R$)', type: 'number' },
                { key: 'received', label: 'Realizado (R$)', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type} value={(histForm as any)[f.key] || ''} onChange={e => setHistForm({ ...histForm, [f.key]: e.target.value })}
                    style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn-outline" onClick={() => setHistModal(null)}>Cancelar</button>
              <button className="btn-gold" onClick={addHistory}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
