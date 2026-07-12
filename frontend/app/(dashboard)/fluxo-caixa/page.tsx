'use client';
import { useEffect, useState } from 'react';
import { api, formatBRL, MONTH_NAMES, CATEGORY_LABELS } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const CATEGORIES_RECEITA = ['SALARIO', 'PRO_LABORE', 'ALUGUEL', 'DIVIDENDO', 'RENDIMENTO_FII', 'RENDIMENTO_RENDA_FIXA', 'RECEBIVEIS_LOTEAMENTO', 'APOSENTADORIA', 'VENDA_IMOVEL', 'JUROS_RECEBIDOS', 'RESTITUICAO_IMPOSTO', 'OUTRAS_RECEITAS'];
const CATEGORIES_DESPESA = ['CUSTO_VIDA', 'ALIMENTACAO', 'TRANSPORTE', 'COMBUSTIVEL', 'ENERGIA', 'AGUA', 'TELEFONE_INTERNET', 'CONDOMINIO', 'IPTU', 'SEGURO', 'MANUTENCAO_IMOVEL', 'PLANO_SAUDE', 'SAUDE', 'FARMACIA', 'EDUCACAO', 'LAZER', 'VIAGENS', 'VESTUARIO', 'IMPOSTOS_ESCRITORIO', 'IR_DARF', 'TARIFAS_BANCARIAS', 'FUNCIONARIOS', 'ASSINATURAS', 'DOACOES', 'APORTE_INVESTIMENTO', 'OUTRAS_DESPESAS'];

interface Entry {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'RECEITA' | 'DESPESA';
  category: string;
  notes?: string;
}

interface Summary {
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
  byCategory: Record<string, number>;
}

export default function FluxoCaixaPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [evolution, setEvolution] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Entry | null | 'new'>(null);
  const [form, setForm] = useState<any>({});
  const [tab, setTab] = useState<'all' | 'receitas' | 'despesas'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const [ents, summ, evo] = await Promise.all([
        api.cashFlow.list(year, month),
        api.cashFlow.summary(year, month),
        api.cashFlow.evolution(),
      ]);
      setEntries(ents);
      setSummary(summ);
      setEvolution(evo.map((e: any) => ({
        name: `${MONTH_NAMES[e.month - 1].slice(0, 3)}/${e.year}`,
        Receitas: e.totalReceitas,
        Despesas: e.totalDespesas,
        Saldo: e.saldo,
      })));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [year, month]);

  const openNew = () => {
    setForm({ date: `${year}-${String(month).padStart(2, '0')}-01`, description: '', amount: '', type: 'RECEITA', category: 'OUTRAS_RECEITAS', notes: '' });
    setModal('new');
  };

  const save = async () => {
    try {
      const toISO = (d: string) => d ? new Date(d).toISOString() : null;
      const body = { ...form, amount: parseFloat(form.amount), date: toISO(form.date) };
      if (modal === 'new') await api.cashFlow.create(body);
      else await api.cashFlow.update((modal as Entry).id, body);
      setModal(null);
      load();
    } catch (e: any) { alert(e.message); }
  };

  const del = async (id: string) => {
    if (!confirm('Excluir lançamento?')) return;
    await api.cashFlow.delete(id);
    load();
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (list: Entry[]) => {
    setSelected(prev => prev.size === list.length ? new Set() : new Set(list.map(e => e.id)));
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Excluir ${selected.size} lançamento(s) selecionado(s)? Essa ação não pode ser desfeita.`)) return;
    try {
      await api.cashFlow.bulkDelete(Array.from(selected));
      setSelected(new Set());
      load();
    } catch (e: any) { alert(e.message); }
  };

  const filtered = entries.filter(e => tab === 'all' || (tab === 'receitas' ? e.type === 'RECEITA' : e.type === 'DESPESA'));

  const catData = summary ? Object.entries(summary.byCategory)
    .map(([cat, val]) => ({ name: CATEGORY_LABELS[cat] || cat, value: Math.abs(Number(val)) }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8) : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Fluxo de Caixa</h1>
          <p style={{ color: 'var(--muted)', margin: 0 }}>Controle de receitas e despesas pessoais</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)' }}>
            {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)' }}>
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn-gold" onClick={openNew}>+ Lançamento</button>
        </div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Receitas', value: formatBRL(summary?.totalReceitas || 0), color: 'var(--positive)' },
          { label: 'Total Despesas', value: formatBRL(summary?.totalDespesas || 0), color: 'var(--negative)' },
          { label: 'Saldo do Mês', value: formatBRL(summary?.saldo || 0), color: (summary?.saldo || 0) >= 0 ? 'var(--positive)' : 'var(--negative)' },
          { label: 'Lançamentos', value: entries.length.toString(), color: 'var(--gold)' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color, marginTop: 4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: 14, color: 'var(--muted)' }}>Evolução 12 Meses</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={evolution.slice(-12)}>
              <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => formatBRL(v)} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
              <Legend />
              <Bar dataKey="Receitas" fill="var(--positive)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Despesas" fill="var(--negative)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: 14, color: 'var(--muted)' }}>Gastos por Categoria</h3>
          {catData.length === 0 ? (
            <p style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 60 }}>Sem dados</p>
          ) : catData.map((d, i) => {
            const max = catData[0].value;
            return (
              <div key={d.name} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span>{d.name}</span>
                  <span style={{ color: 'var(--muted)' }}>{formatBRL(d.value)}</span>
                </div>
                <div style={{ background: 'var(--border)', borderRadius: 3, height: 6 }}>
                  <div style={{ width: `${(d.value / max) * 100}%`, background: i === 0 ? 'var(--gold)' : 'var(--muted)', borderRadius: 3, height: 6 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="tabs">
            {[['all', 'Todos'], ['receitas', 'Receitas'], ['despesas', 'Despesas']].map(([v, l]) => (
              <button key={v} className={`tab${tab === v ? ' active' : ''}`} onClick={() => setTab(v as any)}>{l}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {selected.size > 0 && (
              <button className="btn-danger" style={{ fontSize: 13, padding: '6px 14px' }} onClick={bulkDelete}>
                🗑️ Excluir {selected.size} selecionado(s)
              </button>
            )}
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{filtered.length} lançamentos</span>
          </div>
        </div>

        {loading ? <p style={{ color: 'var(--muted)' }}>Carregando...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '8px 12px', width: 30 }}>
                  <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length}
                    onChange={() => toggleSelectAll(filtered)} title="Selecionar todos" />
                </th>
                {['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} style={{ borderBottom: '1px solid var(--border)', background: selected.has(e.id) ? 'rgba(201,162,39,0.06)' : 'transparent' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleSelect(e.id)} />
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 13 }}>{new Date(e.date).toLocaleDateString('pt-BR')}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13 }}>{e.description}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--muted)' }}>{CATEGORY_LABELS[e.category] || e.category}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span className="badge" style={{ background: e.type === 'RECEITA' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: e.type === 'RECEITA' ? 'var(--positive)' : 'var(--negative)' }}>
                      {e.type === 'RECEITA' ? 'Receita' : 'Despesa'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: e.type === 'RECEITA' ? 'var(--positive)' : 'var(--negative)' }}>
                    {e.type === 'DESPESA' ? '- ' : ''}{formatBRL(e.amount)}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-icon" onClick={() => { setForm({ ...e, date: e.date?.split('T')[0], amount: e.amount }); setModal(e); }}>✏️</button>
                      <button className="btn-icon" onClick={() => del(e.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nenhum lançamento encontrado</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>{modal === 'new' ? 'Novo Lançamento' : 'Editar Lançamento'}</h2>
            <div className="form-grid">
              <div className="span-2">
                <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Descrição</label>
                <input type="text" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })}
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Data</label>
                <input type="date" value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })}
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Valor (R$)</label>
                <input type="number" value={form.amount || ''} onChange={e => setForm({ ...form, amount: e.target.value })}
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Tipo</label>
                <select value={form.type || 'RECEITA'} onChange={e => setForm({ ...form, type: e.target.value, category: e.target.value === 'RECEITA' ? 'OUTRAS_RECEITAS' : 'OUTRAS_DESPESAS' })}
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)' }}>
                  <option value="RECEITA">Receita</option>
                  <option value="DESPESA">Despesa</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Categoria</label>
                <select value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })}
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)' }}>
                  {(form.type === 'RECEITA' ? CATEGORIES_RECEITA : CATEGORIES_DESPESA).map(c => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
                  ))}
                </select>
              </div>
              <div className="span-2">
                <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Observações</label>
                <input type="text" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })}
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn-outline" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-gold" onClick={save}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
