'use client';
import { useEffect, useState } from 'react';
import { api, formatBRL, formatDate } from '@/lib/api';

const PT = { APARTAMENTO:'Apartamento',CASA:'Casa',SITIO:'Sítio',SALA_COMERCIAL:'Sala Comercial',GALPAO:'Galpão',TERRENO:'Terreno',LOTE:'Lote',RURAL:'Rural' };
const CL = [{ v:'',l:'Todos',c:'#94A3B8' },{ v:'PARA_RENDA',l:'🟢 Para Renda',c:'#22C55E' },{ v:'USO_PROPRIO',l:'🔵 Uso Próprio',c:'#3B82F6' },{ v:'A_COMERCIALIZAR',l:'🟡 A Comercializar',c:'#F59E0B' }];

export default function ImoveisPage() {
  const [props, setProps] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  const load = () => {
    setLoading(true);
    const params: any = {};
    if (filter) params.classification = filter;
    Promise.all([api.properties.list(params), api.properties.summary()])
      .then(([p, s]) => { setProps(p); setSummary(s); })
      .catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const del = async (id: string) => {
    if (!confirm('Confirmar exclusão do imóvel?')) return;
    await api.properties.delete(id).catch(console.error); load();
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Imóveis</h1>
          <p className="page-subtitle">Patrimônio total: {formatBRL(summary.total || 0)}</p>
        </div>
        <button className="btn-gold" onClick={() => { setEdit(null); setShowModal(true); }}>+ Novo Imóvel</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="kpi-card">
          <div className="kpi-label" style={{ color: '#22C55E' }}>🟢 Para Renda</div>
          <div className="kpi-value positive">{formatBRL(summary.byClass?.PARA_RENDA || 0)}</div>
          <div className="kpi-sub">Aluguel mensal: {formatBRL(summary.monthlyRent || 0)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label" style={{ color: '#3B82F6' }}>🔵 Uso Próprio</div>
          <div className="kpi-value">{formatBRL(summary.byClass?.USO_PROPRIO || 0)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label" style={{ color: '#F59E0B' }}>🟡 A Comercializar</div>
          <div className="kpi-value warning-text">{formatBRL(summary.byClass?.A_COMERCIALIZAR || 0)}</div>
        </div>
      </div>

      <div className="tabs">
        {CL.map(c => (
          <button key={c.v} onClick={() => setFilter(c.v)} className={`tab ${filter === c.v ? 'active' : ''}`}>{c.l}</button>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? <div style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8' }}>Carregando...</div> : (
          <table>
            <thead>
              <tr>
                <th>Imóvel</th><th>Tipo</th><th>Classificação</th>
                <th style={{ textAlign: 'right' }}>Avaliação</th>
                <th style={{ textAlign: 'right' }}>Aluguel/mês</th>
                <th>Yield Mensal</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {props.map((p: any) => {
                const cl = CL.find(c => c.v === p.classification);
                const yld = p.rentAmount && p.currentValuation ? ((Number(p.rentAmount) / Number(p.currentValuation)) * 100).toFixed(3) : null;
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#F1F5F9' }}>{p.name}</div>
                      {p.tenantName && <div style={{ color: '#94A3B8', fontSize: '0.72rem' }}>{p.tenantName}</div>}
                      {p.notes && <div style={{ color: '#4a6fa5', fontSize: '0.7rem', marginTop: 2 }}>{p.notes}</div>}
                    </td>
                    <td style={{ color: '#94A3B8', fontSize: '0.8rem' }}>{(PT as any)[p.propertyType] || p.propertyType}</td>
                    <td><span style={{ color: cl?.c }}>{cl?.l || p.classification}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatBRL(p.currentValuation)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {p.rentAmount ? <span className="positive">{formatBRL(p.rentAmount)}</span> : <span className="muted">-</span>}
                    </td>
                    <td>{yld ? <span className="positive">{yld}% a.m.</span> : <span className="muted">-</span>}</td>
                    <td>
                      {p.classification === 'PARA_RENDA' && (
                        <span className="badge" style={{ background: p.rentStatus === 'ALUGADO' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: p.rentStatus === 'ALUGADO' ? '#22C55E' : '#EF4444' }}>
                          {p.rentStatus === 'ALUGADO' ? 'Alugado' : 'Vago'}
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-icon" onClick={() => { setEdit(p); setShowModal(true); }}>✏️</button>
                        <button className="btn-danger" onClick={() => del(p.id)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {props.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94A3B8', padding: '3rem' }}>Nenhum imóvel cadastrado</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      {showModal && <PropModal p={edit} onClose={() => setShowModal(false)} onSave={load} />}
    </>
  );
}

function PropModal({ p, onClose, onSave }: any) {
  const [form, setForm] = useState<any>(p ? { ...p, lastValuationDate: p.lastValuationDate?.slice(0,10), contractEndDate: p.contractEndDate?.slice(0,10) } : { classification: 'PARA_RENDA', propertyType: 'APARTAMENTO', currentValuation: '', name: '', rentStatus: 'ALUGADO' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const data = { ...form, currentValuation: Number(form.currentValuation), rentAmount: form.rentAmount ? Number(form.rentAmount) : null };
      if (p?.id) await api.properties.update(p.id, data);
      else await api.properties.create(data);
      onSave(); onClose();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{p ? 'Editar Imóvel' : 'Novo Imóvel'}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
        </div>
        <div className="form-grid">
          <div className="span-2"><label>Nome / Identificação</label><input value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder="ex: Apto Hisa" /></div>
          <div><label>Classificação</label>
            <select value={form.classification} onChange={e => set('classification', e.target.value)}>
              <option value="PARA_RENDA">Para Renda</option>
              <option value="USO_PROPRIO">Uso Próprio</option>
              <option value="A_COMERCIALIZAR">A Comercializar</option>
            </select>
          </div>
          <div><label>Tipo</label>
            <select value={form.propertyType} onChange={e => set('propertyType', e.target.value)}>
              {Object.entries(PT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div><label>Avaliação (R$)</label><input type="number" value={form.currentValuation || ''} onChange={e => set('currentValuation', e.target.value)} /></div>
          <div><label>Data da Avaliação</label><input type="date" value={form.lastValuationDate || ''} onChange={e => set('lastValuationDate', e.target.value)} /></div>
          {form.classification === 'PARA_RENDA' && (
            <>
              <div><label>Aluguel Mensal (R$)</label><input type="number" value={form.rentAmount || ''} onChange={e => set('rentAmount', e.target.value)} /></div>
              <div><label>Status</label>
                <select value={form.rentStatus || 'VAGO'} onChange={e => set('rentStatus', e.target.value)}>
                  <option value="ALUGADO">Alugado</option>
                  <option value="VAGO">Vago</option>
                </select>
              </div>
              <div><label>Inquilino</label><input value={form.tenantName || ''} onChange={e => set('tenantName', e.target.value)} /></div>
              <div><label>Índice de Reajuste</label>
                <select value={form.adjustmentIndex || ''} onChange={e => set('adjustmentIndex', e.target.value)}>
                  <option value="">Selecione</option>
                  <option value="IGPM">IGP-M</option>
                  <option value="IPCA">IPCA</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </div>
              <div><label>Fim do Contrato</label><input type="date" value={form.contractEndDate || ''} onChange={e => set('contractEndDate', e.target.value)} /></div>
            </>
          )}
          <div className="span-2"><label>Observações</label><textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <button className="btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn-gold" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  );
}
