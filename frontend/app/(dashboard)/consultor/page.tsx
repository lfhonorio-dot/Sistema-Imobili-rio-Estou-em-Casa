'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '../../../lib/api';

interface AnalysisItem {
  title: string;
  description: string;
  impact?: string;
}

interface AgentResponse {
  risks: AnalysisItem[];
  inefficiencies: AnalysisItem[];
  opportunities: AnalysisItem[];
  needsMoreData: AnalysisItem[];
}

interface Analysis {
  id: string;
  generatedAt: string;
  modelUsed: string;
  tokensUsed: number;
  inputTokens: number;
  outputTokens: number;
  agentResponse: AgentResponse;
}

interface Usage {
  totalAnalyses: number;
  totalConversations: number;
  totalTokens: number;
  estimatedCostUSD: string;
  lastAnalysis: string | null;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function Section({
  title,
  emoji,
  items,
  color,
  defaultOpen,
}: {
  title: string;
  emoji: string;
  items: AnalysisItem[];
  color: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  if (!items || items.length === 0) return null;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          background: 'var(--card)',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text)',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 15 }}>
          {emoji} {title} <span style={{ color, marginLeft: 6, fontSize: 13 }}>{items.length}</span>
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px', background: 'var(--card)' }}>
          {items.map((item, i) => (
            <div key={i} style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 4, color }}>{item.title}</div>
              <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>{item.description}</div>
              {item.impact && (
                <div style={{ fontSize: 13, marginTop: 6, color: 'var(--text)', fontStyle: 'italic' }}>
                  Impacto: {item.impact}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ConsultorPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [kb, setKb] = useState<{fileName: string, contentLength: number, updatedAt: string} | null>(null);
  const [kbLoading, setKbLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  async function loadData() {
    setInitialLoading(true);
    try {
      const [list, usageData] = await Promise.all([
        api.advisor.list(),
        api.advisor.usage(),
      ]);
      setAnalyses(list || []);
      setUsage(usageData);
      if (list && list.length > 0) {
        setSelectedAnalysis(list[0]);
      }
    } catch (e: any) {
      if (!e.message?.includes('ANTHROPIC_API_KEY')) {
        setError(e.message);
      }
    } finally {
      setInitialLoading(false);
    }
    api.advisor.getKnowledgeBase().then(setKb).catch(() => {});
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.advisor.analyze();
      setSelectedAnalysis(result);
      setAnalyses(prev => [result, ...prev]);
      setChatMessages([]);
      const usageData = await api.advisor.usage();
      setUsage(usageData);
    } catch (e: any) {
      setError(e.message || 'Erro ao gerar análise');
    } finally {
      setLoading(false);
    }
  }

  async function handleChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const question = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: question }]);
    setChatLoading(true);

    try {
      let result: any;
      if (selectedAnalysis) {
        result = await api.advisor.chat(selectedAnalysis.id, question);
      } else {
        result = await api.advisor.quickChat(question);
      }
      setChatMessages(prev => [...prev, { role: 'assistant', content: result.response }]);
    } catch (e: any) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Erro: ${e.message}` }]);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleKbUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setKbLoading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001'}/api/advisor/knowledge-base/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      const result = await res.json();
      setKb({ fileName: result.fileName, contentLength: result.content?.length || 0, updatedAt: result.updatedAt });
      alert('Base de conhecimento carregada com sucesso!');
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    } finally {
      setKbLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleKbDelete() {
    if (!confirm('Remover a base de conhecimento?')) return;
    try {
      await api.advisor.deleteKnowledgeBase();
      setKb(null);
    } catch (e: any) { alert(e.message); }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function formatTokens(n: number) {
    return n.toLocaleString('pt-BR');
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>🧠 Consultor Patrimonial IA</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            Análise crítica do seu patrimônio por um agente especializado • Modelo: claude-opus-5
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              background: 'var(--gold)',
              color: '#000',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontWeight: 700,
              fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '⏳ Analisando...' : '⚡ Gerar Nova Análise'}
          </button>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            ~$0.06–0.15 por análise completa
          </span>
        </div>
      </div>

      {/* Usage Stats */}
      {usage && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12, marginBottom: 24,
        }}>
          {[
            { label: 'Análises', value: usage.totalAnalyses },
            { label: 'Conversas', value: usage.totalConversations },
            { label: 'Tokens usados', value: formatTokens(usage.totalTokens) },
            { label: 'Custo estimado', value: `$${usage.estimatedCostUSD}` },
          ].map(item => (
            <div key={item.label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{item.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Knowledge Base */}
      <div className="card" style={{ marginBottom: 24, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>📚 Base de Conhecimento</div>
            {kb ? (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                {kb.fileName} • {Math.round((kb.contentLength || 0) / 1000)}k caracteres • Atualizado em {new Date(kb.updatedAt).toLocaleDateString('pt-BR')}
              </div>
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                Nenhum documento carregado. Suba seu material de alocação de ativos para o Consultor usar como referência.
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleKbUpload} style={{ display: 'none' }} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={kbLoading}
              className="btn-gold"
              style={{ fontSize: 13, padding: '6px 14px' }}
            >
              {kbLoading ? 'Processando...' : kb ? '🔄 Substituir' : '📤 Carregar Documento'}
            </button>
            {kb && (
              <button onClick={handleKbDelete} className="btn-danger" style={{ fontSize: 13, padding: '6px 14px' }}>
                Remover
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#2a1515', border: '1px solid var(--negative)', borderRadius: 8, padding: 16, marginBottom: 20, color: '#ff6b6b' }}>
          {error.includes('ANTHROPIC_API_KEY') ? (
            <div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>🔑 Chave de API não configurada</div>
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                Para usar o Consultor IA, configure a variável de ambiente <code style={{ background: '#1a0a0a', padding: '2px 6px', borderRadius: 4 }}>ANTHROPIC_API_KEY</code> no servidor.<br />
                1. Acesse <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color: 'var(--gold)' }}>console.anthropic.com</a><br />
                2. Crie uma API Key em "API Keys"<br />
                3. Adicione <code style={{ background: '#1a0a0a', padding: '2px 6px', borderRadius: 4 }}>ANTHROPIC_API_KEY=sua-chave</code> no arquivo .env do backend<br />
                4. Reinicie o servidor
              </div>
            </div>
          ) : (
            <div>{error}</div>
          )}
          <button onClick={() => setError(null)} style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Fechar</button>
        </div>
      )}

      {/* Analyses list selector */}
      {analyses.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Análise selecionada:</label>
          <select
            value={selectedAnalysis?.id || ''}
            onChange={e => {
              const a = analyses.find(x => x.id === e.target.value);
              if (a) { setSelectedAnalysis(a); setChatMessages([]); }
            }}
            style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', width: '100%', maxWidth: 400 }}
          >
            {analyses.map(a => (
              <option key={a.id} value={a.id}>{formatDate(a.generatedAt)} — {formatTokens(a.tokensUsed)} tokens</option>
            ))}
          </select>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Analisando seu patrimônio...</div>
          <div style={{ fontSize: 13 }}>O agente está revisando todos os seus ativos. Isso pode levar 10–30 segundos.</div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !initialLoading && analyses.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🧠</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>Nenhuma análise gerada ainda</div>
          <div style={{ fontSize: 14, maxWidth: 400, margin: '0 auto 20px' }}>
            Clique em "Gerar Nova Análise" para que o agente faça uma leitura crítica completa do seu patrimônio.
          </div>
          <button
            onClick={handleGenerate}
            style={{ background: 'var(--gold)', color: '#000', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, cursor: 'pointer' }}
          >
            ⚡ Gerar Primeira Análise
          </button>
        </div>
      )}

      {/* Analysis results */}
      {selectedAnalysis && !loading && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Gerado em {formatDate(selectedAnalysis.generatedAt)} •{' '}
              {formatTokens(selectedAnalysis.tokensUsed)} tokens •{' '}
              {selectedAnalysis.inputTokens}↑ {selectedAnalysis.outputTokens}↓
            </div>
          </div>

          <Section
            title="Riscos identificados"
            emoji="⚠️"
            items={selectedAnalysis.agentResponse?.risks || []}
            color="var(--negative)"
            defaultOpen={true}
          />
          <Section
            title="Ineficiências"
            emoji="🔧"
            items={selectedAnalysis.agentResponse?.inefficiencies || []}
            color="#f59e0b"
          />
          <Section
            title="Oportunidades"
            emoji="🚀"
            items={selectedAnalysis.agentResponse?.opportunities || []}
            color="var(--positive)"
          />
          <Section
            title="Precisa de mais dados"
            emoji="❓"
            items={selectedAnalysis.agentResponse?.needsMoreData || []}
            color="var(--muted)"
          />
        </div>
      )}

      {/* Chat */}
      <div style={{ marginTop: 32, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ background: 'var(--card)', padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 15 }}>
          💬 Pergunte ao Consultor
          {!selectedAnalysis && <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400, marginLeft: 8 }}>(sem análise selecionada — usará dados atuais)</span>}
        </div>

        {chatMessages.length > 0 && (
          <div style={{ padding: 16, maxHeight: 400, overflowY: 'auto', background: 'var(--card)' }}>
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                style={{
                  marginBottom: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    fontSize: 14,
                    lineHeight: 1.6,
                    background: msg.role === 'user' ? 'var(--gold)' : 'rgba(255,255,255,0.05)',
                    color: msg.role === 'user' ? '#000' : 'var(--text)',
                    border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--muted)' }}>
                  ✍️ Analisando...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}

        <form onSubmit={handleChat} style={{ display: 'flex', gap: 8, padding: 12, background: 'var(--card)', borderTop: chatMessages.length > 0 ? '1px solid var(--border)' : 'none' }}>
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder="Ex: Qual o meu yield médio dos imóveis para renda?"
            disabled={chatLoading}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '10px 14px',
              color: 'var(--text)',
              fontSize: 14,
            }}
          />
          <button
            type="submit"
            disabled={chatLoading || !chatInput.trim()}
            style={{
              background: 'var(--gold)',
              color: '#000',
              border: 'none',
              borderRadius: 8,
              padding: '10px 18px',
              fontWeight: 700,
              cursor: chatLoading || !chatInput.trim() ? 'not-allowed' : 'pointer',
              opacity: chatLoading || !chatInput.trim() ? 0.6 : 1,
              fontSize: 14,
            }}
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
