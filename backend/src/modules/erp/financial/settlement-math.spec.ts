import {
  daysLate, dueDateFor, entryStatusAfter, paymentTotal, pendingCompetences, splitGatewayAmount, suggestLateCharges,
} from './settlement-math';
import { categoryCode } from './financial-config.service';

// Fase 5 — regras de dinheiro da baixa: tudo em centavos, sem perder precisão.

describe('settlement-math', () => {
  it('dias de atraso comparam só a data', () => {
    expect(daysLate(new Date('2026-11-10T12:00:00Z'), new Date('2026-11-10T23:00:00Z'))).toBe(0);
    expect(daysLate(new Date('2026-11-10T12:00:00Z'), new Date('2026-11-25T08:00:00Z'))).toBe(15);
    expect(daysLate(new Date('2026-11-10T12:00:00Z'), new Date('2026-11-01T08:00:00Z'))).toBe(0);
  });

  it('multa única + juros ao mês pro rata dia', () => {
    // R$ 1.000, 2% multa, 1% a.m., 15 dias → multa 20,00, juros 5,00
    expect(suggestLateCharges(1000, new Date('2026-11-10'), new Date('2026-11-25'), 2, 1)).toEqual({ daysLate: 15, fine: 20, interest: 5 });
    expect(suggestLateCharges(1000, new Date('2026-11-10'), new Date('2026-11-10'), 2, 1)).toEqual({ daysLate: 0, fine: 0, interest: 0 });
  });

  it('total da baixa = principal + juros + multa − desconto (sem erro de ponto flutuante)', () => {
    expect(paymentTotal({ principal: 0.1, interest: 0.2 }, 1)).toBe(0.3);
    expect(paymentTotal({ principal: 1000, interest: 5, fine: 20, discount: 10 }, 1000)).toBe(1015);
  });

  it('recusa baixa maior que o saldo, zerada ou com desconto que anula o pagamento', () => {
    expect(() => paymentTotal({ principal: 1000.01 }, 1000)).toThrow(/maior que o saldo/);
    expect(() => paymentTotal({ principal: 0 }, 1000)).toThrow(/maior que zero/);
    expect(() => paymentTotal({ principal: 100, discount: 100 }, 1000)).toThrow(/desconto/);
    expect(() => paymentTotal({ principal: 100, interest: -1 }, 1000)).toThrow(/negativos/);
  });

  it('situação depois das baixas: parcial continua em aberto', () => {
    const due = new Date('2030-01-10');
    expect(entryStatusAfter(1000, 1000, due)).toBe('PAID');
    expect(entryStatusAfter(1000, 400, due, new Date('2030-01-05'))).toBe('PENDING');
    expect(entryStatusAfter(1000, 400, due, new Date('2030-01-15'))).toBe('OVERDUE');
    expect(entryStatusAfter(1000, 0, due, new Date('2030-01-05'))).toBe('PENDING');
  });

  it('valor do gateway: acima do original vira juros; abaixo vira desconto; limitado ao saldo', () => {
    expect(splitGatewayAmount(510, 500, 500)).toEqual({ principal: 500, interest: 10, fine: 0, discount: 0 });
    expect(splitGatewayAmount(490, 500, 500)).toEqual({ principal: 500, interest: 0, fine: 0, discount: 10 });
    expect(splitGatewayAmount(500, 500, 300)).toEqual({ principal: 300, interest: 200, fine: 0, discount: 0 });
  });

  it('recorrência: competências pendentes até o horizonte, sem repetir e respeitando o fim', () => {
    const start = new Date('2026-09-15T00:00:00Z');
    const horizon = new Date('2026-12-01T00:00:00Z');
    expect(pendingCompetences(start, null, new Set(), horizon)).toEqual(['2026-09', '2026-10', '2026-11', '2026-12']);
    expect(pendingCompetences(start, null, new Set(['2026-09', '2026-10']), horizon)).toEqual(['2026-11', '2026-12']);
    expect(pendingCompetences(start, new Date('2026-10-31T00:00:00Z'), new Set(), horizon)).toEqual(['2026-09', '2026-10']);
    expect(pendingCompetences(new Date('2026-11-20T00:00:00Z'), null, new Set(), new Date('2027-01-01T00:00:00Z'))).toEqual(['2026-11', '2026-12', '2027-01']);
  });

  it('vencimento da competência no dia escolhido (até 28)', () => {
    expect(dueDateFor('2027-02', 28).toISOString().slice(0, 10)).toBe('2027-02-28');
    expect(dueDateFor('2026-12', 5).toISOString().slice(0, 10)).toBe('2026-12-05');
  });

  it('código da categoria sem acentos', () => {
    expect(categoryCode('Aluguel de salas comerciais')).toBe('ALUGUEL_DE_SALAS_COMERCIAIS');
    expect(categoryCode('  Água & Luz ')).toBe('AGUA_LUZ');
  });
});
