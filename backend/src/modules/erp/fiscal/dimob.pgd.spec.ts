import { buildPgdFile, buildR01, buildR02, buildR03, money, text, digits, ddmmaaaa } from './dimob.pgd';

describe('PGD DIMOB file builder', () => {
  const declarant = { cnpj: '11.111.111/0001-99', name: 'Imobiliária Ção & Filhos', year: 2026 };

  it('money: centavos sem separador, zero-padded', () => {
    expect(money(1234.56)).toBe('00000000123456');
    expect(money(0)).toBe('00000000000000');
    expect(money(25000)).toBe('00000002500000');
  });

  it('text: uppercase, sem acento, largura fixa', () => {
    expect(text('Ção', 6)).toBe('CAO   ');
    expect(text('abcdefgh', 4)).toBe('ABCD');
  });

  it('digits: só números, zero-padded à esquerda', () => {
    expect(digits('11.111.111/0001-99', 14)).toBe('11111111000199');
  });

  it('ddmmaaaa', () => {
    expect(ddmmaaaa(new Date(2026, 2, 15))).toBe('15032026');
  });

  it('R01 tem prefixo, CNPJ limpo e ano', () => {
    const r = buildR01(declarant);
    expect(r.startsWith('R0111111111000199' + '2026')).toBe(true);
  });

  it('R02 embute valores em centavos e data de contratação', () => {
    const r = buildR02(declarant, {
      sellerDoc: '123.456.789-01', sellerName: 'Vendedor',
      buyerDoc: '98765432100', buyerName: 'Comprador',
      saleValue: 500000, commissionValue: 25000,
      contractDate: new Date(2026, 4, 10), propertyAddress: 'Rua X, 1',
    });
    expect(r).toContain('10052026');
    expect(r).toContain(money(500000));
    expect(r).toContain(money(25000));
  });

  it('R03 tem 36 campos mensais (12x bruto+comissão+imposto)', () => {
    const rental = {
      landlordDoc: '1', landlordName: 'L', tenantDoc: '2', tenantName: 'T',
      propertyAddress: 'Rua Y', monthlyGross: Array(12).fill(2500),
      monthlyCommission: Array(12).fill(250), monthlyTax: Array(12).fill(0),
    };
    const r = buildR03(declarant, rental);
    // 36 blocos monetários de 14 chars = 504 chars de valores
    const expectedLen = 3 + 14 + 4 + 14 + 60 + 14 + 60 + 36 * 14 + 120;
    expect(r.length).toBe(expectedLen);
  });

  it('arquivo completo: header, R01, corpo, trailer com contagem', () => {
    const file = buildPgdFile(declarant, [{
      sellerDoc: '1', sellerName: 'V', buyerDoc: '2', buyerName: 'C',
      saleValue: 100, commissionValue: 5, contractDate: new Date(2026, 0, 1),
      propertyAddress: 'End',
    }], []);
    const lines = file.trimEnd().split('\r\n');
    expect(lines[0]).toBe('DIMOB');
    expect(lines[1].startsWith('R01')).toBe(true);
    expect(lines[2].startsWith('R02')).toBe(true);
    expect(lines[3]).toBe('T9000000002'); // R01 + R02
  });
});
