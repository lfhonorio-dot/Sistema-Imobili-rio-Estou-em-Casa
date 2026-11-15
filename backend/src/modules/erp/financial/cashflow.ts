// Fase 5 — montagem do fluxo de caixa e do DRE (funções puras, em centavos).
//
// Fluxo de caixa:
//   REALIZADO  = baixas efetivas (dinheiro que entrou/saiu), na data da baixa
//   PROJETADO  = realizado até hoje + saldos em aberto, no vencimento
//                (vencidos e não pagos são projetados para hoje)
// DRE gerencial por regime de CAIXA: soma das baixas do mês por categoria.

import { fromCents, toCents } from './settlement-math';

export type Granularity = 'day' | 'month';

export interface Movement {
  date: Date;
  /** positivo = entrada; negativo = saída (em reais) */
  amount: number;
}

export interface CashFlowRow {
  period: string; // AAAA-MM-DD ou AAAA-MM
  realizedIn: number;
  realizedOut: number;
  projectedIn: number;
  projectedOut: number;
  realizedBalance: number;
  projectedBalance: number;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const monthKey = (d: Date) => d.toISOString().slice(0, 7);

export function periodsBetween(from: Date, to: Date, g: Granularity): string[] {
  const out: string[] = [];
  if (g === 'day') {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
    while (d <= to && out.length < 1000) {
      out.push(dayKey(d));
      d.setUTCDate(d.getUTCDate() + 1);
    }
  } else {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
    while (d <= to && out.length < 240) {
      out.push(monthKey(d));
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
  }
  return out;
}

export function buildCashFlow(input: {
  from: Date;
  to: Date;
  granularity: Granularity;
  today: Date;
  /** saldo inicial (contas) + realizado antes de `from` */
  openingBalance: number;
  realized: Movement[];
  projected: Movement[];
}): { openingBalance: number; projectedOpening: number; rows: CashFlowRow[]; totals: Omit<CashFlowRow, 'period' | 'realizedBalance' | 'projectedBalance'> & { closingRealized: number; closingProjected: number } } {
  const key = input.granularity === 'day' ? dayKey : monthKey;
  const periods = periodsBetween(input.from, input.to, input.granularity);
  const idx = new Map(periods.map((p, i) => [p, i]));
  const acc = periods.map(() => ({ rIn: 0, rOut: 0, pIn: 0, pOut: 0 }));
  const todayStart = new Date(Date.UTC(input.today.getUTCFullYear(), input.today.getUTCMonth(), input.today.getUTCDate()));

  for (const m of input.realized) {
    const i = idx.get(key(m.date));
    if (i === undefined) continue;
    const c = toCents(m.amount);
    if (c >= 0) acc[i].rIn += c; else acc[i].rOut += -c;
  }

  let projectedOpeningCents = 0;
  for (const m of input.projected) {
    const eff = m.date < todayStart ? todayStart : m.date; // vencido → hoje
    const c = toCents(m.amount);
    if (eff < input.from) { projectedOpeningCents += c; continue; }
    const i = idx.get(key(eff));
    if (i === undefined) continue;
    if (c >= 0) acc[i].pIn += c; else acc[i].pOut += -c;
  }

  let rBal = toCents(input.openingBalance);
  let pBal = rBal + projectedOpeningCents;
  const tot = { rIn: 0, rOut: 0, pIn: 0, pOut: 0 };
  const rows: CashFlowRow[] = periods.map((period, i) => {
    const a = acc[i];
    rBal += a.rIn - a.rOut;
    // projetado = realizado + previsto (o previsto só existe de hoje em diante)
    pBal += a.rIn - a.rOut + a.pIn - a.pOut;
    tot.rIn += a.rIn; tot.rOut += a.rOut; tot.pIn += a.pIn; tot.pOut += a.pOut;
    return {
      period,
      realizedIn: fromCents(a.rIn),
      realizedOut: fromCents(a.rOut),
      projectedIn: fromCents(a.rIn + a.pIn),
      projectedOut: fromCents(a.rOut + a.pOut),
      realizedBalance: fromCents(rBal),
      projectedBalance: fromCents(pBal),
    };
  });

  return {
    openingBalance: fromCents(toCents(input.openingBalance)),
    projectedOpening: fromCents(toCents(input.openingBalance) + projectedOpeningCents),
    rows,
    totals: {
      realizedIn: fromCents(tot.rIn),
      realizedOut: fromCents(tot.rOut),
      projectedIn: fromCents(tot.rIn + tot.pIn),
      projectedOut: fromCents(tot.rOut + tot.pOut),
      closingRealized: fromCents(rBal),
      closingProjected: fromCents(pBal),
    },
  };
}

export interface DreLine {
  type: 'RECEIVABLE' | 'PAYABLE';
  category: string;
  name: string;
  months: number[]; // 12 posições (jan..dez)
  total: number;
}

export function buildDre(
  year: number,
  payments: Array<{ paidAt: Date; total: number; type: string; category: string }>,
  names: Map<string, string>,
): { year: number; revenue: DreLine[]; expenses: DreLine[]; totalRevenue: number[]; totalExpenses: number[]; result: number[]; totals: { revenue: number; expenses: number; result: number } } {
  const lines = new Map<string, { type: string; category: string; cents: number[] }>();
  for (const p of payments) {
    if (p.paidAt.getUTCFullYear() !== year) continue;
    const k = `${p.type}:${p.category}`;
    if (!lines.has(k)) lines.set(k, { type: p.type, category: p.category, cents: Array(12).fill(0) });
    lines.get(k)!.cents[p.paidAt.getUTCMonth()] += toCents(p.total);
  }
  const toLine = (l: { type: string; category: string; cents: number[] }): DreLine => ({
    type: l.type as DreLine['type'],
    category: l.category,
    name: names.get(`${l.type}:${l.category}`) ?? l.category,
    months: l.cents.map(fromCents),
    total: fromCents(l.cents.reduce((s, c) => s + c, 0)),
  });
  const all = [...lines.values()];
  const revenue = all.filter((l) => l.type === 'RECEIVABLE').map(toLine).sort((a, b) => b.total - a.total);
  const expenses = all.filter((l) => l.type === 'PAYABLE').map(toLine).sort((a, b) => b.total - a.total);
  const sumMonths = (ls: Array<{ cents: number[] }>) => Array.from({ length: 12 }, (_, m) => ls.reduce((s, l) => s + l.cents[m], 0));
  const rev = sumMonths(all.filter((l) => l.type === 'RECEIVABLE'));
  const exp = sumMonths(all.filter((l) => l.type === 'PAYABLE'));
  const res = rev.map((r, m) => r - exp[m]);
  const sum = (a: number[]) => a.reduce((s, c) => s + c, 0);
  return {
    year,
    revenue,
    expenses,
    totalRevenue: rev.map(fromCents),
    totalExpenses: exp.map(fromCents),
    result: res.map(fromCents),
    totals: { revenue: fromCents(sum(rev)), expenses: fromCents(sum(exp)), result: fromCents(sum(res)) },
  };
}
