import { priceHistoryChanges } from './properties.service';
import { FilesService, sanitizeFileName } from '../../files/files.service';
import { normalizeDocument } from '../suppliers/suppliers.service';

// Fase 2 — regras pequenas que valem um teste rápido.

class DecimalStub {
  constructor(private raw: string) {}
  toString() { return this.raw; }
}

describe('priceHistoryChanges', () => {
  it('registra mudança do preço de venda (Decimal antigo × número novo)', () => {
    expect(priceHistoryChanges({ salePrice: new DecimalStub('400000.00') }, { salePrice: 380000 })).toEqual([
      { field: 'SALE_PRICE', oldValue: 400000, newValue: 380000 },
    ]);
  });
  it('não registra quando o valor é o mesmo (mesmo com casas decimais)', () => {
    expect(priceHistoryChanges({ salePrice: new DecimalStub('380000.00') }, { salePrice: 380000 })).toEqual([]);
  });
  it('não registra campo que não veio na atualização', () => {
    expect(priceHistoryChanges({ salePrice: new DecimalStub('1') }, {})).toEqual([]);
  });
  it('registra quando o preço é definido pela primeira vez ou removido', () => {
    expect(priceHistoryChanges({ salePrice: null }, { salePrice: 500000 })[0]).toMatchObject({ oldValue: null, newValue: 500000 });
    expect(priceHistoryChanges({ rentalPrice: new DecimalStub('2000') }, { rentalPrice: null })[0]).toMatchObject({ field: 'RENTAL_PRICE', newValue: null });
  });
});

describe('FilesService — links assinados', () => {
  const hmac = {
    sign: (d: string) => require('crypto').createHmac('sha256', 'segredo-de-teste-com-32-caracteres!!').update(d).digest('hex'),
    verify(d: string, s: string) { return this.sign(d) === s; },
  };
  const prisma = { storedFile: { findFirst: jest.fn().mockResolvedValue({ fileName: 'a.png', mimeType: 'image/png', size: 1, data: Buffer.from('x') }) } };
  const service = new FilesService(prisma as any, hmac as any);

  it('aceita o link assinado dentro da validade', async () => {
    const now = Date.now();
    const path = service.signedPath('f1', 60, now);
    const q = new URLSearchParams(path.split('?')[1]);
    await expect(service.getSigned('f1', q.get('exp')!, q.get('sig')!, now)).resolves.toMatchObject({ mimeType: 'image/png' });
  });

  it('recusa link vencido, adulterado ou de outro arquivo', async () => {
    const now = Date.now();
    const q = new URLSearchParams(service.signedPath('f1', 60, now).split('?')[1]);
    await expect(service.getSigned('f1', q.get('exp')!, q.get('sig')!, now + 61_000)).rejects.toThrow(/expirado/);
    await expect(service.getSigned('f2', q.get('exp')!, q.get('sig')!, now)).rejects.toThrow(/inválido/);
    await expect(service.getSigned('f1', String(Number(q.get('exp')) + 999), q.get('sig')!, now)).rejects.toThrow(/inválido/);
    await expect(service.getSigned('f1', undefined, undefined, now)).rejects.toThrow(/inválido/);
  });

  it('rejeita formato e tamanho fora do permitido', () => {
    expect(() => service.validate({ buffer: Buffer.from('x'), originalname: 'a.txt', mimetype: 'text/plain', size: 1 }, 'DOCUMENT')).toThrow(/Formato/);
    expect(() => service.validate({ buffer: Buffer.from('x'), originalname: 'a.pdf', mimetype: 'application/pdf', size: 1 }, 'IMAGE')).toThrow(/imagem/);
    expect(() => service.validate({ buffer: Buffer.from('x'), originalname: 'a.png', mimetype: 'image/png', size: 6 * 1024 * 1024 }, 'IMAGE')).toThrow(/muito grande/);
  });

  it('resolveUrl mantém URLs externas e assina as internas', () => {
    expect(service.resolveUrl('https://exemplo.com/a.jpg')).toBe('https://exemplo.com/a.jpg');
    expect(service.resolveUrl('file:abc')).toMatch(/^\/files\/abc\?exp=\d+&sig=[0-9a-f]{64}$/);
  });

  it('limpa nome de arquivo', () => {
    expect(sanitizeFileName('Matrícula nº 123/../x.pdf')).toBe('Matricula n_ 123_.._x.pdf');
  });
});

describe('normalizeDocument', () => {
  it('guarda só os dígitos', () => {
    expect(normalizeDocument('11.222.333/0001-81')).toBe('11222333000181');
    expect(normalizeDocument('')).toBeNull();
  });
});
