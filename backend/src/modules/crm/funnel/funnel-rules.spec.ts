import { contractPaymentMethod, proposalSituation, validatePaymentTerms, visitsOverlap } from './funnel-rules';
import { shouldAdvance } from '../pipelines/funnel-stages';

describe('validatePaymentTerms', () => {
  it('à vista simples é válido', () => {
    expect(validatePaymentTerms({ amount: 400000, paymentMethod: 'CASH' })).toBeNull();
  });
  it('financiamento exige valor financiado e partes não passam do total', () => {
    expect(validatePaymentTerms({ amount: 400000, paymentMethod: 'FINANCING' })).toMatch(/financiado/);
    expect(validatePaymentTerms({ amount: 400000, paymentMethod: 'FINANCING', downPayment: 80000, financedAmount: 320000 })).toBeNull();
    expect(validatePaymentTerms({ amount: 400000, paymentMethod: 'FINANCING', downPayment: 100000, financedAmount: 320000 })).toMatch(/passam/);
  });
  it('misto exige soma exata, em centavos', () => {
    expect(validatePaymentTerms({ amount: 350000.1, paymentMethod: 'MIXED', downPayment: 50000.05, financedAmount: 250000, fgtsAmount: 50000.05 })).toBeNull();
    expect(validatePaymentTerms({ amount: 350000, paymentMethod: 'MIXED', downPayment: 50000, financedAmount: 250000 })).toMatch(/somar/);
  });
  it('permuta exige descrição e FGTS exige valor', () => {
    expect(validatePaymentTerms({ amount: 300000, paymentMethod: 'PERMUTA' })).toMatch(/permuta/);
    expect(validatePaymentTerms({ amount: 300000, paymentMethod: 'PERMUTA', exchangeDescription: 'Apto em Franca' })).toBeNull();
    expect(validatePaymentTerms({ amount: 300000, paymentMethod: 'FGTS' })).toMatch(/FGTS/);
  });
});

describe('proposalSituation', () => {
  const now = new Date('2026-11-14T15:00:00Z');
  it('aberta dentro da validade (inclusive no último dia)', () => {
    expect(proposalSituation({ status: 'OPEN', validUntil: '2026-11-14' }, now)).toBe('OPEN');
  });
  it('aberta com validade vencida vira vencida', () => {
    expect(proposalSituation({ status: 'OPEN', validUntil: '2026-11-13' }, now)).toBe('EXPIRED');
  });
  it('decididas mantêm o status', () => {
    expect(proposalSituation({ status: 'ACCEPTED', validUntil: '2026-01-01' }, now)).toBe('ACCEPTED');
  });
});

describe('visitsOverlap', () => {
  it('detecta sobreposição e libera horários encostados', () => {
    const a = { scheduledAt: '2026-11-20T14:00:00Z', durationMin: 60 };
    expect(visitsOverlap(a, { scheduledAt: '2026-11-20T14:30:00Z', durationMin: 60 })).toBe(true);
    expect(visitsOverlap(a, { scheduledAt: '2026-11-20T15:00:00Z', durationMin: 60 })).toBe(false);
  });
});

describe('shouldAdvance (funil só anda para frente)', () => {
  it('avança de Novo lead para Visita agendada', () => {
    expect(shouldAdvance({ order: 0, isWon: false, isLost: false }, { order: 2 })).toBe(true);
  });
  it('não volta de Proposta para Visita realizada', () => {
    expect(shouldAdvance({ order: 4, isWon: false, isLost: false }, { order: 3 })).toBe(false);
  });
  it('não mexe em negócio ganho ou perdido', () => {
    expect(shouldAdvance({ order: 8, isWon: false, isLost: true }, { order: 9 })).toBe(false);
    expect(shouldAdvance({ order: 7, isWon: true, isLost: false }, { order: 8 })).toBe(false);
  });
});

describe('contractPaymentMethod', () => {
  it('mapeia a forma da proposta para o contrato', () => {
    expect(contractPaymentMethod('CASH')).toBe('CASH');
    expect(contractPaymentMethod('FGTS')).toBe('FINANCING');
    expect(contractPaymentMethod(undefined)).toBeUndefined();
  });
});
