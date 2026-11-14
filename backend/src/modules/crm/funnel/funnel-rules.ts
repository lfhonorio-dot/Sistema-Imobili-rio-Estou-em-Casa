// Fase 3 — regras puras do funil (sem banco), testadas em funnel-rules.spec.ts.

export interface PaymentTerms {
  amount: number;
  paymentMethod: string;
  downPayment?: number | null;
  financedAmount?: number | null;
  fgtsAmount?: number | null;
  exchangeDescription?: string | null;
}

const cents = (v?: number | null) => Math.round(Number(v ?? 0) * 100);

/**
 * Confere a composição do pagamento. Devolve a mensagem de erro, ou null.
 * - Partes informadas (entrada + financiamento + FGTS) não passam do valor.
 * - Financiamento exige o valor financiado; FGTS exige o valor do FGTS.
 * - Permuta exige a descrição do bem dado em permuta.
 * - "Misto" exige que as partes somem exatamente o valor da proposta.
 */
export function validatePaymentTerms(t: PaymentTerms): string | null {
  const total = cents(t.amount);
  if (total <= 0) return 'O valor da proposta deve ser maior que zero.';
  const parts = cents(t.downPayment) + cents(t.financedAmount) + cents(t.fgtsAmount);
  if (parts > total) return 'Entrada + financiamento + FGTS passam do valor da proposta.';
  if (t.paymentMethod === 'FINANCING' && !cents(t.financedAmount)) {
    return 'Informe o valor a ser financiado.';
  }
  if (t.paymentMethod === 'FGTS' && !cents(t.fgtsAmount)) {
    return 'Informe o valor que será pago com FGTS.';
  }
  if (t.paymentMethod === 'PERMUTA' && !t.exchangeDescription?.trim()) {
    return 'Descreva o imóvel ou bem dado em permuta.';
  }
  if (t.paymentMethod === 'MIXED' && parts !== total) {
    return 'No pagamento misto, entrada + financiamento + FGTS devem somar o valor da proposta.';
  }
  return null;
}

export type ProposalSituation = 'OPEN' | 'EXPIRED' | 'ACCEPTED' | 'REJECTED' | 'COUNTERED' | 'WITHDRAWN';

/** Proposta em aberto com validade vencida é "vencida" (vale até o fim do dia). */
export function proposalSituation(p: { status: string; validUntil: Date | string }, now = new Date()): ProposalSituation {
  if (p.status !== 'OPEN') return p.status as ProposalSituation;
  const v = new Date(p.validUntil);
  const endOfDay = Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate(), 23, 59, 59, 999);
  return endOfDay < now.getTime() ? 'EXPIRED' : 'OPEN';
}

/** Duas visitas do mesmo corretor se sobrepõem? */
export function visitsOverlap(
  a: { scheduledAt: Date | string; durationMin: number },
  b: { scheduledAt: Date | string; durationMin: number },
): boolean {
  const aStart = new Date(a.scheduledAt).getTime();
  const bStart = new Date(b.scheduledAt).getTime();
  const aEnd = aStart + a.durationMin * 60_000;
  const bEnd = bStart + b.durationMin * 60_000;
  return aStart < bEnd && bStart < aEnd;
}

/** Forma de pagamento da proposta → campo paymentMethod do contrato. */
export function contractPaymentMethod(method?: string | null): string | undefined {
  if (!method) return undefined;
  if (method === 'CASH') return 'CASH';
  if (method === 'FINANCING' || method === 'FGTS' || method === 'MIXED') return 'FINANCING';
  return method; // PERMUTA
}
