import { average, funnelConversion, median, period } from './calc';
import { formatCell, tableToPdf, tableToXlsx, type ReportTable } from './report-table';

// Fase 7 — contas e exportação dos relatórios.

describe('relatórios — contas', () => {
  it('conversão do funil etapa a etapa (perdido fica de fora)', () => {
    const stages = [
      { id: 'a', name: 'Lead', order: 1, isWon: false, isLost: false },
      { id: 'b', name: 'Visita', order: 2, isWon: false, isLost: false },
      { id: 'c', name: 'Ganho', order: 3, isWon: true, isLost: false },
      { id: 'x', name: 'Perdido', order: 4, isWon: false, isLost: true },
    ];
    const r = funnelConversion(stages, new Map([['a', 10], ['b', 5], ['c', 2]]));
    expect(r).toEqual([
      { stage: 'Lead', reached: 10, toNextPct: 50, fromStartPct: 100 },
      { stage: 'Visita', reached: 5, toNextPct: 40, fromStartPct: 50 },
      { stage: 'Ganho', reached: 2, toNextPct: null, fromStartPct: 20 },
    ]);
  });
  it('média e mediana', () => {
    expect(average([10, 20, 31])).toBe(20.3);
    expect(median([5, 1, 9, 3])).toBe(4);
    expect(average([])).toBeNull();
  });
  it('período inválido dá erro', () => {
    expect(() => period('2026-12-01', '2026-01-01')).toThrow(/Período/);
    expect(period('2026-01-01', '2026-01-31').to.toISOString()).toBe('2026-01-31T23:59:59.999Z');
  });
});

describe('relatórios — exportação', () => {
  const t: ReportTable = {
    key: 'vgv', title: 'VGV vendido', subtitle: 'Período: 01/01/2026 a 31/12/2026',
    columns: [{ key: 'month', label: 'Mês', type: 'text' }, { key: 'count', label: 'Vendas', type: 'int' }, { key: 'vgv', label: 'VGV', type: 'money' }, { key: 'pct', label: '%', type: 'pct' }],
    rows: [{ month: '01/2026', count: 2, vgv: 780000, pct: 12.5 }, { month: '02/2026 — Patrocínio 🏠', count: 1, vgv: 300000, pct: 5 }],
    totals: { count: 3, vgv: 1080000 },
  };
  it('formata valores em reais, % e dias', () => {
    expect(formatCell(1234.5, 'money')).toBe('R$ 1.234,50');
    expect(formatCell(12.34, 'pct')).toBe('12,3%');
    expect(formatCell(null, 'money')).toBe('—');
  });
  it('gera Excel', async () => {
    const buf = await tableToXlsx(t);
    expect(buf.slice(0, 2).toString()).toBe('PK');
  });
  it('gera PDF mesmo com caracteres fora do alfabeto latino', async () => {
    const buf = await tableToPdf(t, 'Imobiliária Teste');
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });
});
