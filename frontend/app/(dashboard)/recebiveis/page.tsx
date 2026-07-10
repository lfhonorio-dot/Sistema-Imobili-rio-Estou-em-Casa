'use client';
import { useEffect, useState } from 'react';
import { api, formatBRL, formatPercent, MONTH_NAMES } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Portfolio {
  id: string;
  name: string;
  developmentName?: string;
  presentValue: number;
  futureTotalReceivable: number;
  averageRemainingTerm?: number;
  impliedMonthlyRate?: number;
  monthlyReceivedAmount: number;
  expectedMonthlyAmount?: number;
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
    setForm({ name: '', developmentName: '', presentValue: '', futureTotalReceivable: '', monthlyReceivedAmount: '', expectedMonthlyAmount: '', averageRemainingTerm: '', impliedMonthlyRate: '' });
    setModal('new');
  };

  const openEdit = (p: Portfolio) => {
    setForm({ ...p, impliedMonthlyRate: p.impliedMonthlyRate ? (Number(p.impliedMonthlyRate) * 100).toFixed(4) : '' });
    setModal(p);
  };

  const save = async () => {
    try {
      const body = {
        ...form,
        presentValue: parseFloat(form.presentValue),
        futureTotalReceivable: parseFloat(form.futureTotalReceivable),
        monthlyReceivedAmount: parseFloat(form.monthlyReceivedAmount || '0'),
        expectedMonthlyAmount: form.expectedMonthlyAmount ? parseFloat(form.expectedMonthlyAmount) : undefined,
        averageRemainingTerm: form.averageRemainingTerm ? parseInt(form.averageRemainingTerm) : undefined,
        impliedMonthlyRate: form.impliedMonthlyRate ? parseFloat(form.impliedMonthlyRate) / 100 : undefined,
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

  const delHistory = async (year: number, month: number) => {
    if (!histModal) return;
    if (!confirm(`Excluir o lançamento de ${MONTH_NAMES[month - 1]}/${year}?`)) return;
    try {
      await api.receivables.deleteHistory(histModal.id, year, month);
      const data = await api.receivables.list();
      setPortfolios(data);
      // mantém o modal aberto, apontando para a carteira atualizada
      setHistModal(data.find((p: Portfolio) => p.id === histModal.id) || null);
    } catch (e: any) { alert(e.message); }
  };

  const chartData = (p: Portfolio) => {
    const hist = [...(p.monthlyHistory || [])].sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month)).slice(-6);
    return hist.map((h: any) => ({
      name: `${MONTH_NAMES[h.month - 1].slice(0, 3)}/${h.year}`,
      Previsto: Number(h.expectedAmount ?? h.expected ?? 0),
      Realizado: Number(h.receivedAmount ?? h.received ?? 0),
    }));
  };

  const totalPresent = portfolios.reduce((s, p) => s + Number(p.presentValue), 0);
  const totalFuture = portfolios.reduce((s, p) => s + Number(p.futureTotalReceivable), 0);
  const totalMonthly = portfolios.reduce((s, p) => s + Number(p.monthlyReceivedAmount), 0);

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
          { label: 'Valor Presente Total', value: formatBRL(totalPresent) },
          { label: 'Recebível Futuro Total', value: formatBRL(totalFuture) },
          { label: 'Recebido/mês (atual)', value: formatBRL(totalMonthly) },
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
        const progress = p.futureTotalReceivable > 0 ? (p.presentValue / p.futureTotalReceivable) * 100 : 0;
        const data = chartData(p);
        return (
          <div key={p.id} className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>{p.name}</h2>
                {p.developmentName && <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>{p.developmentName}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-outline" style={{ fontSize: 13, padding: '6px 12px' }}
                  onClick={() => { setHistModal(p); setHistForm({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, expected: String(p.expectedMonthlyAmount || p.monthlyReceivedAmount), received: '' }); }}>
                  + Histórico
                </button>
                <button className="btn-outline" style={{ fontSize: 13, padding: '6px 12px' }} onClick={() => openEdit(p)}>Editar</button>
                <button className="btn-danger" style={{ fontSize: 13, padding: '6px 12px' }} onClick={() => del(p.id)}>Excluir</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
              <div><div style={{ color: 'var(--muted)', fontSize: 12 }}>Valor Presente</div><div style={{ fontWeight: 600, color: 'var(--gold)' }}>{formatBRL(p.presentValue)}</div></div>
              <div><div style={{ color: 'var(--muted)', fontSize: 12 }}>Recebível Futuro</div><div style={{ fontWeight: 600 }}>{formatBRL(p.futureTotalReceivable)}</div></div>
              <div><div style={{ color: 'var(--muted)', fontSize: 12 }}>Recebido/mês</div><div style={{ fontWeight: 600, color: 'var(--positive)' }}>{formatBRL(p.monthlyReceivedAmount)}</div></div>
              <div><div style={{ color: 'var(--muted)', fontSize: 12 }}>Taxa Mensal</div><div style={{ fontWeight: 600 }}>{p.impliedMonthlyRate ? formatPercent(Number(p.impliedMonthlyRate) * 100) : '-'}</div></div>
            </div>

            {p.averageRemainingTerm && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
                  <span>Prazo restante médio: {p.averageRemainingTerm} meses</span>
                  <span>{formatPercent(Math.min(100, 100 - (p.averageRemainingTerm / 240 * 100)))} concluído (est.)</span>
                </div>
                <div style={{ background: 'var(--border)', borderRadius: 4, height: 8 }}>
                  <div style={{ width: `${Math.min(100, progress)}%`, background: 'var(--gold)', borderRadius: 4, height: 8, transition: 'width 0.3s' }} />
                </div>
              </div>
            )}

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
                { key: 'developmentName', label: 'Empreendimento', span: 2 },
                { key: 'presentValue', label: 'Valor Presente (R$)', type: 'number' },
                { key: 'futureTotalReceivable', label: 'Total a Receber Futuro (R$)', type: 'number' },
                { key: 'monthlyReceivedAmount', label: 'Recebido/mês Atual (R$)', type: 'number' },
                { key: 'expectedMonthlyAmount', label: 'Previsto/mês (R$)', type: 'number' },
                { key: 'averageRemainingTerm', label: 'Prazo Restante Médio (meses)', type: 'number' },
                { key: 'impliedMonthlyRate', label: 'Taxa Mensal Implícita (%)', type: 'number' },
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

            {histModal.monthlyHistory && histModal.monthlyHistory.length > 0 && (
              <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Lançamentos existentes</div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {[...histModal.monthlyHistory]
                    .sort((a, b) => b.year * 100 + b.month - (a.year * 100 + a.month))
                    .map((h: any) => (
                      <div key={`${h.year}-${h.month}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                        <span>{MONTH_NAMES[h.month - 1]}/{h.year}</span>
                        <span style={{ color: 'var(--muted)' }}>{formatBRL(h.receivedAmount ?? h.received ?? 0)}</span>
                        <button onClick={() => delHistory(h.year, h.month)} title="Excluir"
                          style={{ background: 'transparent', border: 'none', color: 'var(--negative)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>🗑️</button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
