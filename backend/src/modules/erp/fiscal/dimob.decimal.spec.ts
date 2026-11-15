import { DimobService } from './dimob.service';

// Os valores da DIMOB passaram de Float para Decimal(15,2). Um Prisma.Decimal
// não é number: só vira o valor certo com Number(...). Este teste garante
// que a exportação continua somando corretamente, em centavos exatos.

class DecimalStub {
  constructor(private raw: string) {}
  toString() { return this.raw; }
}

describe('DimobService.exportDimob com valores Decimal', () => {
  it('soma rendimento e comissão por declarante sem erro de arredondamento', async () => {
    const base = {
      declarantDoc: '11222333000181', declarantName: 'Imob', type: 'VENDA',
      referenceMonth: 3, eventDate: new Date('2026-03-10'), participationPct: 100,
      propertyAddress: 'Rua A', locadorDoc: '1', locadorName: 'V', locatarioDoc: '2', locatarioName: 'C',
    };
    const prisma = {
      dimobRecord: {
        findMany: jest.fn().mockResolvedValue([
          { ...base, totalValue: new DecimalStub('300000.10'), commissionAmount: new DecimalStub('18000.20') },
          { ...base, totalValue: new DecimalStub('200000.20'), commissionAmount: new DecimalStub('12000.10') },
        ]),
      },
    };
    const service = new DimobService(prisma as any);

    const result = await service.exportDimob('ws-1', 2026);
    const d = result.declarantes[0] as any;

    expect(prisma.dimobRecord.findMany.mock.calls[0][0].where.workspaceId).toBe('ws-1');
    expect(d.totalOperacoes).toBe(2);
    expect(d.totalRendimentoBruto).toBeCloseTo(500000.3, 2);
    expect(d.totalComissao).toBeCloseTo(30000.3, 2);
    expect(d.eventos[0].valorOperacao).toBe(300000.1);
    expect(typeof d.eventos[0].comissao).toBe('number');
  });
});
