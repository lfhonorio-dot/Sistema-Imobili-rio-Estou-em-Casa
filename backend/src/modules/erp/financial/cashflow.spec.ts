import { buildCashFlow, buildDre, periodsBetween } from './cashflow';

// Fase 5 — fluxo de caixa (realizado x projetado) e DRE por regime de caixa.

describe('buildCashFlow', () => {
  const base = {
    from: new Date('2026-11-01T00:00:00Z'),
    to: new Date('2026-11-05T23:59:59Z'),
    granularity: 'day' as const,
    today: new Date('2026-11-03T15:00:00Z'),
    openingBalance: 1000,
  };

  it('saldo realizado acumula só as baixas; projetado soma o previsto de hoje em diante', () => {
    const r = buildCashFlow({
      ...base,
      realized: [
        { date: new Date('2026-11-01T10:00:00Z'), amount: 500 },
        { date: new Date('2026-11-02T10:00:00Z'), amount: -200 },
      ],
      projected: [
        { date: new Date('2026-10-20T12:00:00Z'), amount: 300 },  // vencido → hoje (03)
        { date: new Date('2026-11-05T12:00:00Z'), amount: -100 },
        { date: new Date('2026-12-10T12:00:00Z'), amount: 999 },  // fora do período
      ],
    });
    expect(r.rows.map((x) => x.period)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
    expect(r.rows.map((x) => x.realizedBalance)).toEqual([1500, 1300, 1300, 1300, 1300]);
    expect(r.rows.map((x) => x.projectedBalance)).toEqual([1500, 1300, 1600, 1600, 1500]);
    expect(r.totals).toEqual({ realizedIn: 500, realizedOut: 200, projectedIn: 800, projectedOut: 300, closingRealized: 1300, closingProjected: 1500 });
  });

  it('mensal agrupa por mês', () => {
    expect(periodsBetween(new Date('2026-11-15T00:00:00Z'), new Date('2027-02-01T00:00:00Z'), 'month')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });

  it('período futuro: previsto antes do início entra no saldo projetado inicial', () => {
    const r = buildCashFlow({
      from: new Date('2026-12-01T00:00:00Z'), to: new Date('2026-12-31T23:59:59Z'), granularity: 'month',
      today: new Date('2026-11-03T00:00:00Z'), openingBalance: 100,
      realized: [], projected: [{ date: new Date('2026-11-20T00:00:00Z'), amount: 50 }, { date: new Date('2026-12-10T00:00:00Z'), amount: 25 }],
    });
    expect(r.projectedOpening).toBe(150);
    expect(r.rows[0].projectedBalance).toBe(175);
    expect(r.rows[0].realizedBalance).toBe(100);
  });
});

describe('buildDre', () => {
  it('soma por mês e categoria; resultado = receitas − despesas', () => {
    const names = new Map([['RECEIVABLE:COMMISSION', 'Comissão de venda'], ['PAYABLE:COMMISSION', 'Comissão de corretores']]);
    const d = buildDre(2026, [
      { paidAt: new Date('2026-01-10T12:00:00Z'), total: 10000.1, type: 'RECEIVABLE', category: 'COMMISSION' },
      { paidAt: new Date('2026-01-20T12:00:00Z'), total: 0.2, type: 'RECEIVABLE', category: 'COMMISSION' },
      { paidAt: new Date('2026-02-05T12:00:00Z'), total: 3000, type: 'PAYABLE', category: 'COMMISSION' },
      { paidAt: new Date('2025-12-31T12:00:00Z'), total: 999, type: 'RECEIVABLE', category: 'OTHER' }, // outro ano
    ], names);
    expect(d.revenue).toHaveLength(1);
    expect(d.revenue[0]).toMatchObject({ name: 'Comissão de venda', total: 10000.3 });
    expect(d.revenue[0].months[0]).toBe(10000.3);
    expect(d.expenses[0]).toMatchObject({ name: 'Comissão de corretores', total: 3000 });
    expect(d.result.slice(0, 2)).toEqual([10000.3, -3000]);
    expect(d.totals).toEqual({ revenue: 10000.3, expenses: 3000, result: 7000.3 });
  });
});
