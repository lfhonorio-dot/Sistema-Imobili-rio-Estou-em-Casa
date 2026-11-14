import { buildPgdFile } from './dimob.pgd';
import { validateSaleParties, validatePgdFile, validCnpj, validCpf } from './dimob.validate';

// Fase 7 — DIMOB de vendas: partes identificadas e arquivo bem formado.

const declarant = { cnpj: '11.222.333/0001-81', name: 'Imobiliária', year: 2026 };
const sale = { sellerDoc: '529.982.247-25', sellerName: 'Vendedor', buyerDoc: '111.444.777-35', buyerName: 'Comprador', saleValue: 390000, commissionValue: 23400, contractDate: new Date(2026, 4, 10), propertyAddress: 'Rua do Sol, 7 - Franca/SP' };

describe('DIMOB — validação', () => {
  it('dígitos verificadores de CPF e CNPJ', () => {
    expect(validCpf('529.982.247-25')).toBe(true);
    expect(validCpf('529.982.247-26')).toBe(false);
    expect(validCpf('111.111.111-11')).toBe(false);
    expect(validCnpj('11.222.333/0001-81')).toBe(true);
    expect(validCnpj('11.222.333/0001-82')).toBe(false);
  });

  it('venda com todas as partes identificadas passa', () => {
    expect(validateSaleParties(2026, declarant.cnpj, [sale])).toEqual([]);
  });

  it('aponta comprador sem documento, data fora do ano e mesmo documento', () => {
    const issues = validateSaleParties(2026, '123', [
      { ...sale, buyerDoc: '', ref: 'Contrato C-2026-0001' },
      { ...sale, contractDate: new Date(2025, 11, 30), buyerDoc: sale.sellerDoc, ref: 'Contrato C-2026-0002' },
    ]);
    const msgs = issues.map((i) => `${i.where}: ${i.message}`);
    expect(msgs).toEqual(expect.arrayContaining([
      'Declarante: CNPJ do declarante inválido.',
      expect.stringMatching(/C-2026-0001: CPF\/CNPJ do comprador inválido/),
      expect.stringMatching(/C-2026-0002: Data do contrato fora do ano-calendário 2026/),
      'Contrato C-2026-0002: Vendedor e comprador com o mesmo documento.',
    ]));
  });

  it('arquivo gerado tem estrutura válida (DIMOB, R01, R04, T9, CR+LF, tamanhos)', () => {
    const file = buildPgdFile(declarant, [sale, sale], []);
    expect(validatePgdFile(file)).toEqual([]);
    expect(file.split('\r\n')[2].slice(0, 3)).toBe('R04');
  });

  it('detecta trailer errado, linha sem CR+LF e acento', () => {
    const file = buildPgdFile(declarant, [sale], []);
    const broken = file.replace('T9000000002', 'T9000000005').replace(/\r\nR04/, '\nR04').replace('VENDEDOR', 'VENDEDÔR');
    const msgs = validatePgdFile(broken).map((i) => i.message).join(' | ');
    expect(msgs).toMatch(/sem CR\+LF/);
    expect(msgs).toMatch(/Caractere especial|Tipo de registro desconhecido|Tamanho/);
  });
});
