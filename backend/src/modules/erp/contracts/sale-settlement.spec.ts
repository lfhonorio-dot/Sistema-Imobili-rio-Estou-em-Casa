import { buildSettlement, equalInstallments } from './sale-settlement';

const d = (s: string) => new Date(s + 'T12:00:00Z');

describe('equalInstallments', () => {
  it('divide em parcelas mensais com a sobra de centavos na última', () => {
    const p = equalInstallments(1000, 3, d('2026-12-10'));
    expect(p.map((x) => x.amount)).toEqual([333.33, 333.33, 333.34]);
    expect(p.map((x) => x.dueDate.toISOString().slice(0, 10))).toEqual(['2026-12-10', '2027-01-10', '2027-02-10']);
  });
});

describe('buildSettlement', () => {
  const brokers = [
    { kind: 'SELLER_BROKER' as const, label: 'Corretor vendedor', pct: 30, userId: 'wu-1' },
    { kind: 'CAPTOR' as const, label: 'Captador', pct: 10, userId: 'wu-2' },
    { kind: 'PARTNER' as const, label: 'Parceiro', pct: 20, contactId: 'c-9' },
  ];

  it('venda de R$ 390.000 a 6% em 2 parcelas: receber e pagar fecham no centavo', () => {
    const plan = buildSettlement({
      commissionTotal: 23400,
      installments: [{ dueDate: d('2026-12-10'), amount: 11700 }, { dueDate: d('2027-01-10'), amount: 11700 }],
      beneficiaries: brokers,
    });
    expect(plan.receivables.map((r) => r.amount)).toEqual([11700, 11700]);
    expect(plan.perBeneficiary.map((b) => b.amount)).toEqual([7020, 2340, 4680]);
    expect(plan.agencyNet).toBe(9360);
    // corretor vendedor: metade em cada parcela
    expect(plan.payables.filter((p) => p.kind === 'SELLER_BROKER').map((p) => p.amount)).toEqual([3510, 3510]);
    // vencimento do repasse = vencimento da parcela
    expect(plan.payables[0].dueDate.toISOString().slice(0, 10)).toBe('2026-12-10');
  });

  it('centavos difíceis: a soma por beneficiário é exata', () => {
    const plan = buildSettlement({
      commissionTotal: 1000,
      installments: equalInstallments(1000, 3, d('2026-12-10')),
      beneficiaries: [{ kind: 'SELLER_BROKER', label: 'V', pct: 33.33 }],
    });
    const sum = plan.payables.reduce((s, p) => s + Math.round(p.amount * 100), 0);
    expect(sum).toBe(33330);
    expect(Math.round((plan.agencyNet + plan.perBeneficiary[0].amount) * 100)).toBe(100000);
  });

  it('recusa parcelas que não fecham o total', () => {
    expect(() =>
      buildSettlement({ commissionTotal: 1000, installments: [{ dueDate: d('2026-12-10'), amount: 900 }], beneficiaries: [] }),
    ).toThrow(/soma das parcelas/);
  });

  it('recusa repasses acima de 100%', () => {
    expect(() =>
      buildSettlement({
        commissionTotal: 1000,
        installments: [{ dueDate: d('2026-12-10'), amount: 1000 }],
        beneficiaries: [{ kind: 'SELLER_BROKER', label: 'V', pct: 70 }, { kind: 'CAPTOR', label: 'C', pct: 40 }],
      }),
    ).toThrow(/100%/);
  });

  it('sem corretores: a imobiliária fica com tudo e não há contas a pagar', () => {
    const plan = buildSettlement({ commissionTotal: 500, installments: [{ dueDate: d('2026-12-10'), amount: 500 }], beneficiaries: [] });
    expect(plan.payables).toEqual([]);
    expect(plan.agencyNet).toBe(500);
  });

  it('recusa comissão zero e quantidade de parcelas fora do limite', () => {
    expect(() => buildSettlement({ commissionTotal: 0, installments: [], beneficiaries: [] })).toThrow(/maior que zero/);
    expect(() => buildSettlement({ commissionTotal: 10, installments: [], beneficiaries: [] })).toThrow(/1 a 60/);
  });
});
