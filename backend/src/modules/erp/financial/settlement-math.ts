// Fase 5 — contas de baixa (funções puras, em centavos para não perder precisão).
//
// Uma "baixa" é cada recebimento/pagamento de um lançamento:
//   principal  → quanto abate do valor do lançamento
//   juros/multa → acréscimos por atraso
//   desconto   → abatimento concedido
//   total      → principal + juros + multa − desconto (o dinheiro que entrou/saiu)

export const toCents = (v: number | string | { toString(): string } | null | undefined): number =>
  Math.round(Number(v ?? 0) * 100);
export const fromCents = (c: number): number => Math.round(c) / 100;

const DAY = 86_400_000;

/** Dias de atraso (0 se pago no prazo). Compara só as datas, em UTC. */
export function daysLate(dueDate: Date, paidAt: Date): number {
  const d = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const p = Date.UTC(paidAt.getUTCFullYear(), paidAt.getUTCMonth(), paidAt.getUTCDate());
  return Math.max(0, Math.round((p - d) / DAY));
}

/**
 * Multa e juros sugeridos para pagar `openAmount` em `paidAt`.
 * Multa: % única sobre o valor em aberto. Juros: % ao mês, pro rata dia (mês de 30 dias).
 */
export function suggestLateCharges(
  openAmount: number,
  dueDate: Date,
  paidAt: Date,
  finePct: number,
  interestMonthlyPct: number,
): { daysLate: number; fine: number; interest: number } {
  const days = daysLate(dueDate, paidAt);
  if (days === 0) return { daysLate: 0, fine: 0, interest: 0 };
  const base = toCents(openAmount);
  const fine = Math.round((base * finePct) / 100);
  const interest = Math.round((base * interestMonthlyPct * days) / (100 * 30));
  return { daysLate: days, fine: fromCents(fine), interest: fromCents(interest) };
}

export interface PaymentParts {
  principal: number;
  interest?: number;
  fine?: number;
  discount?: number;
}

/** Valida as partes de uma baixa e devolve o total (em reais). Lança Error com mensagem para o usuário. */
export function paymentTotal(parts: PaymentParts, openAmount: number): number {
  const principal = toCents(parts.principal);
  const interest = toCents(parts.interest);
  const fine = toCents(parts.fine);
  const discount = toCents(parts.discount);
  const open = toCents(openAmount);
  if (principal <= 0) throw new Error('Informe o valor a baixar (maior que zero).');
  if (interest < 0 || fine < 0 || discount < 0) throw new Error('Juros, multa e desconto não podem ser negativos.');
  if (principal > open) {
    throw new Error(`O valor a baixar (R$ ${fromCents(principal).toFixed(2)}) é maior que o saldo em aberto (R$ ${fromCents(open).toFixed(2)}).`);
  }
  const total = principal + interest + fine - discount;
  if (total <= 0) throw new Error('O desconto não pode ser igual ou maior que o valor pago.');
  return fromCents(total);
}

/**
 * Situação do lançamento depois das baixas.
 * PAID quando o principal baixado cobre o valor; senão PENDING/OVERDUE pelo vencimento.
 * (Baixa parcial mantém o lançamento em aberto; a tela mostra "Parcial" quando paidAmount > 0.)
 */
export function entryStatusAfter(amount: number, principalPaid: number, dueDate: Date, now = new Date()): 'PAID' | 'PENDING' | 'OVERDUE' {
  if (toCents(principalPaid) >= toCents(amount)) return 'PAID';
  return daysLate(dueDate, now) > 0 ? 'OVERDUE' : 'PENDING';
}

/**
 * Divide um valor recebido pelo gateway em principal / juros / desconto,
 * dado o saldo em aberto e o valor original da cobrança.
 */
export function splitGatewayAmount(received: number, originalValue: number, openAmount: number): Required<PaymentParts> {
  const rec = toCents(received);
  // principal: o valor original da cobrança, limitado ao saldo em aberto
  const principal = Math.min(toCents(openAmount), toCents(originalValue) || rec);
  // acima do principal = juros/multa cobrados pelo gateway; abaixo = desconto
  const extra = rec - principal;
  return {
    principal: fromCents(principal),
    interest: fromCents(Math.max(extra, 0)),
    fine: 0,
    discount: fromCents(Math.max(-extra, 0)),
  };
}

/** Competência AAAA-MM de uma data (UTC). */
export function competenceOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Competências que uma recorrência mensal ainda precisa gerar, do início
 * até `horizon` (inclusive), pulando as já geradas e respeitando o fim.
 */
export function pendingCompetences(
  startDate: Date,
  endDate: Date | null,
  existing: Set<string>,
  horizon: Date,
): string[] {
  const out: string[] = [];
  let y = startDate.getUTCFullYear();
  let m = startDate.getUTCMonth();
  const hy = horizon.getUTCFullYear();
  const hm = horizon.getUTCMonth();
  while (y < hy || (y === hy && m <= hm)) {
    const comp = `${y}-${String(m + 1).padStart(2, '0')}`;
    const monthStart = new Date(Date.UTC(y, m, 1));
    if (endDate && monthStart > endDate) break;
    if (!existing.has(comp)) out.push(comp);
    m++;
    if (m === 12) { m = 0; y++; }
    if (out.length > 240) break; // trava de segurança (20 anos)
  }
  return out;
}

/** Data de vencimento de uma competência no dia informado (1–28). */
export function dueDateFor(competence: string, dayOfMonth: number): Date {
  const [y, m] = competence.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, Math.min(Math.max(dayOfMonth, 1), 28), 12));
}
