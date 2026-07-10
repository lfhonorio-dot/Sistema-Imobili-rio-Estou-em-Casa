'use client';
import { useEffect, useRef, useState } from 'react';
import { api, formatBRL, CATEGORY_LABELS } from '@/lib/api';

const SOURCES = [
  { value: 'BRADESCO', label: 'Bradesco' },
  { value: 'ITAU', label: 'Itaú' },
  { value: 'SANTANDER', label: 'Santander' },
  { value: 'BB', label: 'Banco do Brasil' },
  { value: 'CAIXA', label: 'Caixa' },
  { value: 'XP', label: 'XP Investimentos' },
  { value: 'BTG', label: 'BTG' },
  { value: 'OUTRO', label: 'Outro / Outro banco' },
];

interface ParsedEntry {
  date: string;
  description: string;
  amount: number;
  type: 'RECEITA' | 'DESPESA';
  category: string;
  selected: boolean;
}

interface ImportLog {
  id: string;
  createdAt: string;
  format: string;
  source: string;
  totalEntries: number;
  importedEntries: number;
  status: string;
}

export default function ImportacaoPage() {
  const [dragging, setDragging] = useState(false);
  const [source, setSource] = useState('OUTRO');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [logId, setLogId] = useState<string | null>(null);
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [importing, setImporting] = useState(false);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const fileRef = useRef<HTMLInputElement>(null);

  const loadLogs = async () => {
    try {
      const data = await api.import.logs();
      setLogs(data);
    } catch {}
  };

  useEffect(() => { loadLogs(); }, []);

  const handleFile = (f: File) => {
    setFile(f);
    setStep('upload');
    setEntries([]);
    setLogId(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const result = await api.import.upload(file, source);
      if (result.error) { alert('Erro: ' + result.error); setUploading(false); return; }
      setLogId(result.logId);
      const parsed = (result.entries || []).map((e: any) => {
        // Backend devolve entryType (CREDITO/DEBITO); a tela usa type (RECEITA/DESPESA)
        const type = e.type || (e.entryType === 'CREDITO' ? 'RECEITA' : 'DESPESA');
        const category = e.category || (type === 'RECEITA' ? 'OUTRAS_RECEITAS' : 'OUTRAS_DESPESAS');
        return { ...e, type, category, selected: true };
      });
      setEntries(parsed);
      if (parsed.length === 0) {
        alert('Nenhuma transação foi reconhecida no arquivo. Verifique se a planilha tem colunas de Data, Descrição e Valor.');
      }
      setStep('preview');
    } catch (e: any) { alert('Erro ao processar arquivo: ' + e.message); }
    setUploading(false);
  };

  const confirmImport = async () => {
    if (!logId) return;
    setImporting(true);
    try {
      const selected = entries.filter(e => e.selected);
      await api.import.confirm(logId, selected);
      setStep('done');
      loadLogs();
    } catch (e: any) { alert(e.message); }
    setImporting(false);
  };

  const toggleAll = (val: boolean) => setEntries(entries.map(e => ({ ...e, selected: val })));
  const toggleOne = (i: number) => setEntries(entries.map((e, idx) => idx === i ? { ...e, selected: !e.selected } : e));
  const setCategory = (i: number, cat: string) => setEntries(entries.map((e, idx) => idx === i ? { ...e, category: cat } : e));

  const CATEGORIES_RECEITA = ['SALARIO', 'ALUGUEL', 'DIVIDENDO', 'RENDIMENTO_FII', 'RENDIMENTO_RENDA_FIXA', 'RECEBIVEIS_LOTEAMENTO', 'APOSENTADORIA', 'OUTRAS_RECEITAS'];
  const CATEGORIES_DESPESA = ['IPTU', 'CONDOMINIO', 'SEGURO', 'MANUTENCAO_IMOVEL', 'IMPOSTOS_ESCRITORIO', 'IR_DARF', 'CUSTO_VIDA', 'PLANO_SAUDE', 'OUTRAS_DESPESAS'];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Importação de Extratos</h1>
          <p style={{ color: 'var(--muted)', margin: 0 }}>OFX, CSV e Excel (todas as abas) de bancos e corretoras</p>
        </div>
      </div>

      {step === 'upload' && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>Upload de Arquivo</h3>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>Banco / Corretora</label>
            <select value={source} onChange={e => setSource(e.target.value)}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', minWidth: 200 }}>
              {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? 'var(--gold)' : 'var(--border)'}`,
              borderRadius: 12,
              padding: 48,
              textAlign: 'center',
              cursor: 'pointer',
              background: dragging ? 'rgba(201,162,39,0.05)' : 'transparent',
              transition: 'all 0.2s',
            }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {file ? file.name : 'Arraste o arquivo aqui ou clique para selecionar'}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Formatos suportados: OFX, CSV, Excel (.xlsx/.xls)</div>
            <input ref={fileRef} type="file" accept=".ofx,.csv,.xlsx,.xls" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} style={{ display: 'none' }} />
          </div>

          {file && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn-gold" onClick={upload} disabled={uploading}>
                {uploading ? 'Processando...' : 'Processar Arquivo'}
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'preview' && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0 }}>Pré-visualização — {entries.length} transações encontradas</h3>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                {entries.filter(e => e.selected).length} selecionadas para importar
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-outline" style={{ fontSize: 13 }} onClick={() => setStep('upload')}>← Voltar</button>
              <button className="btn-outline" style={{ fontSize: 13 }} onClick={() => toggleAll(true)}>Selecionar Todas</button>
              <button className="btn-outline" style={{ fontSize: 13 }} onClick={() => toggleAll(false)}>Desselecionar</button>
              <button className="btn-gold" onClick={confirmImport} disabled={importing || entries.filter(e => e.selected).length === 0}>
                {importing ? 'Importando...' : `Importar ${entries.filter(e => e.selected).length}`}
              </button>
            </div>
          </div>

          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--card)' }}>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['', 'Data', 'Descrição', 'Tipo', 'Valor', 'Categoria'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', opacity: e.selected ? 1 : 0.4 }}>
                    <td style={{ padding: '8px 12px' }}>
                      <input type="checkbox" checked={e.selected} onChange={() => toggleOne(i)} />
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 13, whiteSpace: 'nowrap' }}>
                      {new Date(e.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 13, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.description}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span className="badge" style={{ background: e.type === 'RECEITA' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: e.type === 'RECEITA' ? 'var(--positive)' : 'var(--negative)' }}>
                        {e.type === 'RECEITA' ? 'Receita' : 'Despesa'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, color: e.type === 'RECEITA' ? 'var(--positive)' : 'var(--negative)', whiteSpace: 'nowrap' }}>
                      {e.type === 'DESPESA' ? '- ' : ''}{formatBRL(Math.abs(e.amount))}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <select value={e.category} onChange={ev => setCategory(i, ev.target.value)}
                        style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 8px', color: 'var(--text)', fontSize: 12 }}>
                        {(e.type === 'RECEITA' ? CATEGORIES_RECEITA : CATEGORIES_DESPESA).map(c => (
                          <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="alert-box" style={{ background: 'rgba(34,197,94,0.1)', borderColor: 'var(--positive)', marginBottom: 24 }}>
          <strong>✅ Importação concluída!</strong> As transações foram adicionadas ao Fluxo de Caixa.
          <button className="btn-outline" style={{ marginLeft: 16, fontSize: 13 }} onClick={() => { setStep('upload'); setFile(null); setEntries([]); }}>Nova Importação</button>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Histórico de Importações</h3>
        {logs.length === 0 ? (
          <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 24 }}>Nenhuma importação realizada</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Data', 'Formato', 'Origem', 'Total', 'Importados', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontSize: 13 }}>{new Date(l.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13 }}><span className="badge">{l.format}</span></td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--muted)' }}>{SOURCES.find(s => s.value === l.source)?.label || l.source}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13 }}>{l.totalEntries}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--positive)' }}>{l.importedEntries}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span className="badge" style={{ background: l.status === 'COMPLETED' ? 'rgba(34,197,94,0.15)' : 'rgba(201,162,39,0.15)', color: l.status === 'COMPLETED' ? 'var(--positive)' : 'var(--gold)' }}>
                      {l.status === 'COMPLETED' ? 'Concluído' : l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
