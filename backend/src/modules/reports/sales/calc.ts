// Fase 7 — contas dos relatórios (funções puras).

/** Conversão entre etapas do funil: de quantos que chegaram numa etapa, quantos chegaram na próxima. */
export function funnelConversion(stages: Array<{ id: string; name: string; order: number; isWon: boolean; isLost: boolean }>, reached: Map<string, number>) {
  const ordered = stages.filter((s) => !s.isLost).sort((a, b) => a.order - b.order);
  const top = reached.get(ordered[0]?.id ?? '') ?? 0;
  return ordered.map((s, i) => {
    const count = reached.get(s.id) ?? 0;
    const next = ordered[i + 1];
    const nextCount = next ? reached.get(next.id) ?? 0 : null;
    return {
      stage: s.name,
      reached: count,
      toNextPct: next && count ? Math.round((nextCount! / count) * 1000) / 10 : null,
      fromStartPct: top ? Math.round((count / top) * 1000) / 10 : null,
    };
  });
}

export const daysBetween = (a: Date, b: Date) => Math.max(0, (b.getTime() - a.getTime()) / 86_400_000);

export function average(values: number[]): number | null {
  return values.length ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10 : null;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return Math.round((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) * 10) / 10;
}

export const round2 = (v: number) => Math.round(v * 100) / 100;

/** Período padrão: início do ano até hoje. */
export function period(from?: string, to?: string): { from: Date; to: Date } {
  const now = new Date();
  const f = from ? new Date(`${from.slice(0, 10)}T00:00:00Z`) : new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const t = to ? new Date(`${to.slice(0, 10)}T23:59:59.999Z`) : now;
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime()) || t < f) throw new Error('Período inválido.');
  return { from: f, to: t };
}
