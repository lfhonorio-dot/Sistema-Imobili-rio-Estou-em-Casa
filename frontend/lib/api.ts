const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function fetchAPI(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    throw new Error('Não autorizado');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Erro ${res.status}`);
  }
  return res.json();
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      fetchAPI('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    me: () => fetchAPI('/auth/me'),
  },
  dashboard: {
    get: () => fetchAPI('/dashboard'),
    alerts: () => fetchAPI('/dashboard/alerts'),
  },
  assets: {
    list: (params?: Record<string, string>) =>
      fetchAPI('/assets' + (params ? '?' + new URLSearchParams(params) : '')),
    summary: () => fetchAPI('/assets/summary'),
    get: (id: string) => fetchAPI(`/assets/${id}`),
    create: (data: any) => fetchAPI('/assets', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchAPI(`/assets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => fetchAPI(`/assets/${id}`, { method: 'DELETE' }),
    dividends: (id: string) => fetchAPI(`/assets/${id}/dividends`),
    addDividend: (id: string, data: any) =>
      fetchAPI(`/assets/${id}/dividends`, { method: 'POST', body: JSON.stringify(data) }),
  },
  properties: {
    list: (params?: Record<string, string>) =>
      fetchAPI('/properties' + (params ? '?' + new URLSearchParams(params) : '')),
    summary: () => fetchAPI('/properties/summary'),
    get: (id: string) => fetchAPI(`/properties/${id}`),
    create: (data: any) => fetchAPI('/properties', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchAPI(`/properties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => fetchAPI(`/properties/${id}`, { method: 'DELETE' }),
  },
  cashFlow: {
    list: (year?: number, month?: number) =>
      fetchAPI('/cash-flow' + (year && month ? `?year=${year}&month=${month}` : '')),
    summary: (year?: number, month?: number) =>
      fetchAPI('/cash-flow/summary' + (year && month ? `?year=${year}&month=${month}` : '')),
    evolution: () => fetchAPI('/cash-flow/evolution'),
    create: (data: any) => fetchAPI('/cash-flow', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchAPI(`/cash-flow/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => fetchAPI(`/cash-flow/${id}`, { method: 'DELETE' }),
  },
  receivables: {
    list: () => fetchAPI('/receivables'),
    get: (id: string) => fetchAPI(`/receivables/${id}`),
    create: (data: any) => fetchAPI('/receivables', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchAPI(`/receivables/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => fetchAPI(`/receivables/${id}`, { method: 'DELETE' }),
    addHistory: (id: string, data: any) =>
      fetchAPI(`/receivables/${id}/history`, { method: 'POST', body: JSON.stringify(data) }),
  },
  retirement: {
    get: () => fetchAPI('/retirement'),
    create: (data: any) => fetchAPI('/retirement', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchAPI(`/retirement/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    save: (data: any) => fetchAPI('/retirement', { method: 'POST', body: JSON.stringify(data) }),
    simulation: () => fetchAPI('/retirement/simulation'),
  },
  snapshots: {
    list: () => fetchAPI('/snapshots'),
    create: () => fetchAPI('/snapshots', { method: 'POST' }),
  },
  import: {
    logs: () => fetchAPI('/import/logs'),
    rules: () => fetchAPI('/import/rules'),
    createRule: (data: any) => fetchAPI('/import/rules', { method: 'POST', body: JSON.stringify(data) }),
    deleteRule: (id: string) => fetchAPI(`/import/rules/${id}`, { method: 'DELETE' }),
    upload: async (file: File, source?: string) => {
      const token = getToken();
      const formData = new FormData();
      formData.append('file', file);
      if (source) formData.append('source', source);
      const res = await fetch(`${API}/api/import/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      return res.json();
    },
    confirm: (logId: string, entries: any[]) =>
      fetchAPI(`/import/${logId}/confirm`, { method: 'POST', body: JSON.stringify({ entries }) }),
  },
};

export function formatBRL(value: number | string | null | undefined): string {
  const n = Number(value) || 0;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

export function formatPercent(value: number, decimals = 2): string {
  return `${Number(value).toFixed(decimals)}%`;
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  try { return new Date(date).toLocaleDateString('pt-BR'); } catch { return '-'; }
}

export const ASSET_TYPE_LABELS: Record<string, string> = {
  RENDA_FIXA: 'Renda Fixa',
  FII: 'FIIs',
  ACAO: 'Ações',
  PREVIDENCIA: 'Previdência',
  COE: 'COE',
  CAIXA: 'Caixa',
  RECEBIVEIS: 'Recebíveis',
};

export const ASSET_TYPE_COLORS: Record<string, string> = {
  RENDA_FIXA: '#3B82F6',
  FII: '#8B5CF6',
  ACAO: '#22C55E',
  PREVIDENCIA: '#F59E0B',
  COE: '#EC4899',
  CAIXA: '#6B7280',
  RECEBIVEIS: '#C9A227',
};

export const CATEGORY_LABELS: Record<string, string> = {
  ALUGUEL: 'Aluguel',
  RECEBIVEIS_LOTEAMENTO: 'Recebíveis de Loteamento',
  APOSENTADORIA: 'Aposentadoria/INSS',
  RENDIMENTO_FII: 'Rendimento FII',
  RENDIMENTO_RENDA_FIXA: 'Rendimento Renda Fixa',
  RENDIMENTO_RF: 'Rendimento Renda Fixa',
  RECEITA_RECEBIVEIS: 'Receita de Recebíveis',
  DIVIDENDO: 'Dividendos',
  SALARIO: 'Salário',
  OUTRAS_RECEITAS: 'Outras Receitas',
  IPTU: 'IPTU',
  CONDOMINIO: 'Condomínio',
  SEGURO: 'Seguro',
  MANUTENCAO_IMOVEL: 'Manutenção de Imóvel',
  IMPOSTOS_ESCRITORIO: 'Impostos e Escritório',
  IMPOSTOS: 'Impostos',
  IR_DARF: 'IR / DARF',
  CUSTO_VIDA: 'Custo de Vida',
  MORADIA: 'Moradia',
  ALIMENTACAO: 'Alimentação',
  SAUDE: 'Saúde',
  EDUCACAO: 'Educação',
  TRANSPORTE: 'Transporte',
  LAZER: 'Lazer',
  INVESTIMENTO: 'Investimento',
  PLANO_SAUDE: 'Plano de Saúde',
  OUTRAS_DESPESAS: 'Outras Despesas',
};

export const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
