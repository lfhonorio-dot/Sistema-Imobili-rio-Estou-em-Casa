import { calcCommissionBreakdown } from './commission-breakdown';

// Cálculo da comissão e do repasse aos corretores parceiros.

describe('calcCommissionBreakdown', () => {
  it('venda de R$ 500.000 a 6%, parceiro com 30% da comissão', () => {
    const r = calcCommissionBreakdown({
      baseValue: 500000,
      commissionRate: 6,
      partners: [{ recipientId: 'r1', name: 'Parceiro A', type: 'PERCENTAGE', value: 30 }],
    });
    expect(r.commissionTotal).toBe(30000);
    expect(r.splitBaseSource).toBe('PREVISTO');
    expect(r.partners[0].amount).toBe(9000);
    expect(r.partnersTotal).toBe(9000);
    expect(r.agencyAmount).toBe(21000);
    expect(r.agencyPercentage).toBe(70);
  });

  it('dois parceiros: um percentual e um valor fixo', () => {
    const r = calcCommissionBreakdown({
      baseValue: 350000,
      commissionRate: 5,
      partners: [
        { recipientId: 'r1', name: 'A', type: 'PERCENTAGE', value: 25 },
        { recipientId: 'r2', name: 'B', type: 'FIXED', value: 1500 },
      ],
    });
    expect(r.commissionTotal).toBe(17500);
    expect(r.partners.map((p) => p.amount)).toEqual([4375, 1500]);
    expect(r.agencyAmount).toBe(11625);
  });

  it('depois do recebimento, o repasse usa o valor efetivamente recebido', () => {
    const r = calcCommissionBreakdown({
      baseValue: 500000,
      commissionRate: 6,
      receivedValue: 28000, // comissão negociada com desconto
      partners: [{ recipientId: 'r1', name: 'A', type: 'PERCENTAGE', value: 30 }],
    });
    expect(r.commissionTotal).toBe(30000);
    expect(r.splitBase).toBe(28000);
    expect(r.splitBaseSource).toBe('RECEBIDO');
    expect(r.partners[0].amount).toBe(8400);
    expect(r.agencyAmount).toBe(19600);
  });

  it('arredonda em centavos sem perder ou criar dinheiro', () => {
    const r = calcCommissionBreakdown({
      baseValue: 333333.33,
      commissionRate: 5.5,
      partners: [
        { recipientId: 'r1', name: 'A', type: 'PERCENTAGE', value: 33.33 },
        { recipientId: 'r2', name: 'B', type: 'PERCENTAGE', value: 33.33 },
      ],
    });
    const total = Math.round((r.partnersTotal + r.agencyAmount) * 100);
    expect(total).toBe(Math.round(r.splitBase * 100));
    expect(r.commissionTotal).toBe(18333.33);
  });

  it('sem parceiros, a imobiliária fica com 100%', () => {
    const r = calcCommissionBreakdown({ baseValue: 200000, commissionRate: 6, partners: [] });
    expect(r.agencyAmount).toBe(12000);
    expect(r.agencyPercentage).toBe(100);
  });
});
