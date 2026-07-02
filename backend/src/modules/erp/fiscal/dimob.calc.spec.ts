import { computeDimobDeclarants } from './dimob.calc';

describe('computeDimobDeclarants (rateio DIMOB PJ/PF)', () => {
  const imob = { name: 'Imobiliária X', cnpj: '11111111000199' };

  it('sem parceiros: imobiliária declara 100% da comissão', () => {
    const r = computeDimobDeclarants(imob, [], 60000);
    expect(r).toHaveLength(1);
    expect(r[0].declarantDoc).toBe('11111111000199');
    expect(r[0].participationPct).toBe(100);
    expect(r[0].commissionAmount).toBe(60000);
  });

  it('parceiro PJ: cada declarante tem registro proporcional', () => {
    const partners = [
      { name: 'Corretora PJ', document: '22222222000188', documentType: 'CNPJ', percentage: 30 },
    ];
    const r = computeDimobDeclarants(imob, partners, 60000);
    expect(r).toHaveLength(2);
    const imobRec = r.find((d) => d.declarantDoc === '11111111000199')!;
    const pjRec = r.find((d) => d.declarantDoc === '22222222000188')!;
    expect(imobRec.participationPct).toBe(70);
    expect(imobRec.commissionAmount).toBe(42000);
    expect(pjRec.participationPct).toBe(30);
    expect(pjRec.commissionAmount).toBe(18000);
  });

  it('parceiro PF autônomo: NÃO é declarante; parcela vai para a imobiliária', () => {
    const partners = [
      { name: 'Corretor PF', document: '12345678901', documentType: 'CPF', percentage: 40 },
    ];
    const r = computeDimobDeclarants(imob, partners, 60000);
    expect(r).toHaveLength(1); // só a imobiliária declara
    expect(r[0].declarantDoc).toBe('11111111000199');
    expect(r[0].participationPct).toBe(100); // 60% base + 40% do PF
    expect(r[0].commissionAmount).toBe(60000);
  });

  it('mix PJ + PF: PJ próprio registro; PF somado à imobiliária', () => {
    const partners = [
      { name: 'PJ', document: '22222222000188', documentType: 'CNPJ', percentage: 25 },
      { name: 'PF', document: '12345678901', documentType: 'CPF', percentage: 15 },
    ];
    const r = computeDimobDeclarants(imob, partners, 100000);
    expect(r).toHaveLength(2);
    const imobRec = r.find((d) => d.declarantDoc === '11111111000199')!;
    const pjRec = r.find((d) => d.declarantDoc === '22222222000188')!;
    // imobiliária = 60% base + 15% PF = 75%
    expect(imobRec.participationPct).toBe(75);
    expect(imobRec.commissionAmount).toBe(75000);
    expect(pjRec.participationPct).toBe(25);
    expect(pjRec.commissionAmount).toBe(25000);
  });
});
