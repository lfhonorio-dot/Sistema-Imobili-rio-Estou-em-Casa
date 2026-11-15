// Fase 3 — rótulos do funil de venda (mesmos códigos do backend).

export const LOST_REASONS: Record<string, string> = {
  PRECO: 'Preço',
  FINANCIAMENTO_NEGADO: 'Financiamento negado',
  COMPROU_OUTRO_IMOVEL: 'Comprou outro imóvel',
  DESISTIU: 'Desistiu da compra',
  SEM_RETORNO: 'Cliente sem retorno',
  IMOVEL_VENDIDO: 'Imóvel vendido para outro',
  DOCUMENTACAO: 'Problema de documentação',
  LOCALIZACAO: 'Localização',
  OUTRO: 'Outro',
};

/** Rótulo do motivo de perda, incluindo códigos antigos. */
export function lostReasonLabel(code?: string | null): string {
  if (!code) return '—';
  const legacy: Record<string, string> = {
    PRICE: 'Preço', COMPETITOR: 'Concorrência', NOT_INTERESTED: 'Sem interesse',
    NO_CONTACT: 'Sem resposta', TIMING: 'Momento inadequado', OTHER: 'Outro',
  };
  return LOST_REASONS[code] ?? legacy[code] ?? code;
}

export const PAYMENT_METHODS: Record<string, string> = {
  CASH: 'À vista',
  FINANCING: 'Financiamento bancário',
  FGTS: 'Com FGTS',
  PERMUTA: 'Permuta',
  MIXED: 'Misto (entrada + financiamento + FGTS)',
};

export const INTEREST_LEVELS: Record<string, string> = {
  HIGH: 'Alto', MEDIUM: 'Médio', LOW: 'Baixo', NONE: 'Nenhum',
};

export const VISIT_STATUS: Record<string, { label: string; className: string }> = {
  SCHEDULED: { label: 'Agendada', className: 'bg-blue-100 text-blue-700' },
  DONE: { label: 'Realizada', className: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Cancelada', className: 'bg-gray-100 text-gray-600' },
  NO_SHOW: { label: 'Cliente não compareceu', className: 'bg-amber-100 text-amber-800' },
};

export const PROPOSAL_STATUS: Record<string, { label: string; className: string }> = {
  OPEN: { label: 'Em aberto', className: 'bg-blue-100 text-blue-700' },
  EXPIRED: { label: 'Vencida', className: 'bg-red-100 text-red-700' },
  ACCEPTED: { label: 'Aceita', className: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Recusada', className: 'bg-gray-100 text-gray-600' },
  COUNTERED: { label: 'Respondida (contraproposta)', className: 'bg-purple-100 text-purple-700' },
  WITHDRAWN: { label: 'Retirada', className: 'bg-gray-100 text-gray-600' },
};

export const brl = (v: unknown) =>
  v === null || v === undefined || v === ''
    ? '—'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v));

/** "350.000,50" → 350000.5; vazio → undefined */
export function parseMoney(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}
