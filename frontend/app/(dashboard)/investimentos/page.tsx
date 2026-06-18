'use client';
import { useEffect, useState } from 'react';
import { api, formatBRL, formatDate, ASSET_TYPE_LABELS, ASSET_TYPE_COLORS } from '@/lib/api';

const TABS = ['TODOS', 'RENDA_FIXA', 'FII', 'ACAO', 'PREVIDENCIA', 'COE', 'CAIXA'];
const INDEXERS = ['IPCA', 'CDI', 'SELIC', 'PREFIXADO', 'IGPM', 'OUTRO'];
const LIQUIDITIES = ['D0', 'D1', 'NO_VENCIMENTO', 'ILIQUIDO'];

function getReturn(a: any) {
  const inv = Number(a.investedAmount), cur = Number(a.currentValue);
  if (!inv) return 0;
  return ((cur - inv) / inv) * 100;
}

export default function InvestimentosPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [tab, setTab] = useState('TODOS');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editAsset, setEditAsset] = useState<any>(null);

  const load = () => {
    setLoading(true);
    const params: any = {};
    if (tab !== 'TODOS') params.type = tab;
    if (search) params.search = search;
    Promise.all([api.assets.list(params), api.assets.summary()])
      .then(([a, s]) => { setAssets(a); setSummary(s); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tab, search]);

  const del = async (id: string) => {
    if (!confirm('Confirmar exclusão do ativo?')) return;
    await api.assets.delete(id).catch(console.error);
    load();
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Carteira de Investimentos</h1>
          <p className="page-subtitle">Total financeiro: {formatBRL(summary.total || 0)}</p>
        </div>
        <button className="btn-gold" onClick={() => { setEditAsset(null); setShowModal(true); }}>+ Novo Ativo</button>
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: '0.625rem', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: 4 }}>
        {Object.entries(summary.byType || {}).map(([type, val]: any) => (
          <div key={type} onClick={() => setTab(type)} style={{ background: tab === type ? 'rgba(201,162,39,0.12)' : '#112236', border: `1px solid ${tab === type ? '#C9A227' : '#1E3A5F'}`, borderRadius: 10, padding: '0.5rem 1rem', minWidth: 130, cursor: 'pointer', flexShrink: 0 }}>
            <div style={{ color: ASSET_TYPE_COLORS[type], fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{ASSET_TYPE_LABELS[type]}</div>
            <div style={{ color: '#F1F5F9', fontWeight: 700, fontSize: '0.875rem' }}>{formatBRL(val)}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`tab ${tab === t ? 'active' : ''}`}>
            {t === 'TODOS' ? 'Todos' : ASSET_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, ticker, emissor..." style={{ maxWidth: 340 }} />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8' }}>Carregando...</div> : (
          <table>
            <thead>
              <tr>
                <th>Nome / Ticker</th>
                <th>Tipo</th>
                <th>Emissor / Broker</th>
                <th style={{ textAlign: 'right' }}>Aplicado</th>
                <th style={{ textAlign: 'right' }}>Atual</th>
                <th style={{ textAlign: 'right' }}>Rentab.</th>
                <th>Indexador / DY</th>
                <th>Vencimento</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a: any) => {
                const ret = getReturn(a);
                return (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#F1F5F9' }}>{a.ticker || a.name}</div>
                      {a.ticker && <div style={{ color: '#94A3B8', fontSize: '0.72rem' }}>{a.name}</div>}
                    </td>
                    <td>
                      <span className="badge" style={{ background: ASSET_TYPE_COLORS[a.type] + '22', color: ASSET_TYPE_COLORS[a.type] }}>
                        {ASSET_TYPE_LABELS[a.type]}
                      </span>
                    </td>
                    <td style={{ color: '#94A3B8', fontSize: '0.8rem' }}>{a.issuer || a.broker || '-'}</td>
                    <td style={{ textAlign: 'right', color: '#94A3B8' }}>{formatBRL(a.investedAmount)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatBRL(a.currentValue)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: ret >= 0 ? '#22C55E' : '#EF4444' }}>
                      {ret >= 0 ? '+' : ''}{ret.toFixed(2)}%
                    </td>
                    <td style={{ color: '#94A3B8', fontSize: '0.8rem' }}>
                      {a.indexer ? `${a.indexer}${a.rate ? `+${Number(a.rate).toFixed(2)}%` : ''}` : a.monthlyDY ? `DY ${Number(a.monthlyDY).toFixed(2)}%` : '-'}
                    </td>
                    <td style={{ color: '#94A3B8', fontSize: '0.8rem' }}>{formatDate(a.maturityDate)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-icon" onClick={() => { setEditAsset(a); setShowModal(true); }}>✏️</button>
                        <button className="btn-danger" onClick={() => del(a.id)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {assets.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: '#94A3B8', padding: '3rem' }}>Nenhum ativo encontrado</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <AssetModal asset={editAsset} onClose={() => setShowModal(false)} onSave={load} />}
    </>
  );
}

function AssetModal({ asset, onClose, onSave }: { asset: any; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState<any>(asset
    ? { ...asset, applicationDate: asset.applicationDate?.slice(0, 10), maturityDate: asset.maturityDate?.slice(0, 10) }
    : { type: 'RENDA_FIXA', name: '', investedAmount: '', currentValue: '', isIRExempt: false, capitalProtected: false });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const data = { ...form, investedAmount: Number(form.investedAmount), currentValue: Number(form.currentValue) };
      if (asset?.id) await api.assets.update(asset.id, data);
      else await api.assets.create(data);
      onSave(); onClose();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{asset ? 'Editar Ativo' : 'Novo Ativo'}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1 }}>×</button>
        </div>
        <div className="form-grid">
          <div className="span-2">
            <label>Tipo de Ativo</label>
            <select value={form.type} onChange={e => set('type', e.target.value)}>
              {Object.entries(ASSET_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="span-2">
            <label>Nome</label>
            <input value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder="Nome do ativo" />
          </div>
          {(form.type === 'FII' || form.type === 'ACAO') && (
            <div>
              <label>Ticker</label>
              <input value={form.ticker || ''} onChange={e => set('ticker', e.target.value)} placeholder="ex: MXRF11" />
            </div>
          )}
          <div>
            <label>Emissor</label>
            <input value={form.issuer || ''} onChange={e => set('issuer', e.target.value)} placeholder="Banco/Empresa" />
          </div>
          <div>
            <label>Corretora / Custodiante</label>
            <input value={form.broker || ''} onChange={e => set('broker', e.target.value)} placeholder="ex: EQI" />
          </div>
          <div>
            <label>Valor Aplicado (R$)</label>
            <input type="number" step="0.01" value={form.investedAmount || ''} onChange={e => set('investedAmount', e.target.value)} />
          </div>
          <div>
            <label>Valor Atual (R$)</label>
            <input type="number" step="0.01" value={form.currentValue || ''} onChange={e => set('currentValue', e.target.value)} />
          </div>
          {(form.type === 'FII' || form.type === 'ACAO') && (
            <>
              <div>
                <label>Quantidade de Cotas/Ações</label>
                <input type="number" step="1" value={form.quantity || ''} onChange={e => set('quantity', e.target.value)} />
              </div>
              <div>
                <label>DY Mensal (%)</label>
                <input type="number" step="0.01" value={form.monthlyDY || ''} onChange={e => set('monthlyDY', e.target.value)} />
              </div>
            </>
          )}
          {form.type === 'RENDA_FIXA' && (
            <>
              <div>
                <label>Indexador</label>
                <select value={form.indexer || ''} onChange={e => set('indexer', e.target.value)}>
                  <option value="">Selecione</option>
                  {INDEXERS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label>Taxa (%) — ex: 5.5 para IPCA+5,5%</label>
                <input type="number" step="0.01" value={form.rate || ''} onChange={e => set('rate', e.target.value)} />
              </div>
              <div>
                <label>Liquidez</label>
                <select value={form.liquidity || ''} onChange={e => set('liquidity', e.target.value)}>
                  <option value="">Selecione</option>
                  {LIQUIDITIES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label>Número do Contrato</label>
                <input value={form.contractNumber || ''} onChange={e => set('contractNumber', e.target.value)} />
              </div>
              <div>
                <label>Data de Aplicação</label>
                <input type="date" value={form.applicationDate || ''} onChange={e => set('applicationDate', e.target.value)} />
              </div>
              <div>
                <label>Data de Vencimento</label>
                <input type="date" value={form.maturityDate || ''} onChange={e => set('maturityDate', e.target.value)} />
              </div>
              <div className="span-2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="irExempt" checked={form.isIRExempt || false} onChange={e => set('isIRExempt', e.target.checked)} style={{ width: 'auto' }} />
                <label htmlFor="irExempt" style={{ marginBottom: 0, cursor: 'pointer' }}>Isento de IR (LCA / LCI / CRI / CRA)</label>
              </div>
            </>
          )}
          {form.type === 'PREVIDENCIA' && (
            <>
              <div>
                <label>Seguradora</label>
                <input value={form.insurerName || ''} onChange={e => set('insurerName', e.target.value)} />
              </div>
              <div>
                <label>Tipo</label>
                <select value={form.planType || ''} onChange={e => set('planType', e.target.value)}>
                  <option value="">Selecione</option>
                  <option value="PGBL">PGBL</option>
                  <option value="VGBL">VGBL</option>
                </select>
              </div>
              <div>
                <label>Regime Tributário</label>
                <select value={form.taxRegime || ''} onChange={e => set('taxRegime', e.target.value)}>
                  <option value="">Selecione</option>
                  <option value="Progressivo">Progressivo</option>
                  <option value="Regressivo">Regressivo</option>
                </select>
              </div>
              <div>
                <label>Contribuição Mensal (R$)</label>
                <input type="number" value={form.monthlyContribution || ''} onChange={e => set('monthlyContribution', e.target.value)} />
              </div>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <button className="btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn-gold" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  );
}
