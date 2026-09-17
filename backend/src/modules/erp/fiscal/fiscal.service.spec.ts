import { FiscalService } from './fiscal.service';

// Bloqueante #6 do relatório de homologação: as consultas de DIMOB e
// Carnê-Leão usavam valores de enum que nunca existiram no schema
// ('RENTAL', 'INCOME'), então sempre voltavam vazias — mesmo com
// aluguéis pagos de verdade no período. Estes testes travam os filtros
// corretos para essas duas consultas não regredirem silenciosamente.

function makePrismaMock() {
  return {
    contract: { findMany: jest.fn() },
    dimobRecord: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn((a: any) => Promise.resolve(a.data)) },
    contact: { findFirst: jest.fn() },
    financialEntry: { findMany: jest.fn() },
    carneLeaoRecord: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn((a: any) => Promise.resolve(a.data)) },
  };
}

describe('FiscalService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: FiscalService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new FiscalService(prisma as any);
  });

  describe('generateDimob', () => {
    it('busca contratos de locação pelos tipos reais do schema, não por um enum inexistente', async () => {
      prisma.contract.findMany.mockResolvedValue([]);

      await service.generateDimob('ws-1', { year: 2026 });

      const callArgs = prisma.contract.findMany.mock.calls[0][0];
      expect(callArgs.where.type.in).toEqual(['RENTAL_RESIDENTIAL', 'RENTAL_COMMERCIAL']);
      // Os valores antigos e quebrados não podem voltar a aparecer aqui.
      expect(callArgs.where.type.in).not.toContain('RENTAL');
      expect(callArgs.where.type.in).not.toContain('INCOME');
    });

    it('soma os recebíveis pagos do contrato no totalValue do registro DIMOB', async () => {
      prisma.contract.findMany.mockResolvedValue([
        {
          id: 'ctr-1',
          tenant: { name: 'Inquilino', cpf: '111' },
          owner: { name: 'Proprietário', cpf: '222' },
          property: { address: 'Rua X, 1' },
          startDate: new Date('2026-01-01'),
          endDate: null,
          rentalValue: 2000,
          financialEntries: [{ amount: 2000 }, { amount: 2000 }],
        },
      ]);
      prisma.dimobRecord.findFirst.mockResolvedValue(null);

      const result = await service.generateDimob('ws-1', { year: 2026 });

      expect(result.records[0].totalValue).toBe(4000);
      expect(result.records[0].type).toBe('LOCACAO');
    });
  });

  describe('calculateCarneLeao', () => {
    it('soma apenas os recebíveis de aluguel do proprietário informado, não de todos os contatos', async () => {
      prisma.contact.findFirst.mockResolvedValue({ id: 'owner-1', cpf: '123.456.789-00' });
      prisma.financialEntry.findMany.mockResolvedValue([{ amount: 1500 }]);
      prisma.carneLeaoRecord.findFirst.mockResolvedValue(null);

      await service.calculateCarneLeao('ws-1', {
        period: '2026-03', ownerDocument: '123.456.789-00', ownerName: 'Fulano',
      });

      const callArgs = prisma.financialEntry.findMany.mock.calls[0][0];
      expect(callArgs.where.contactId).toBe('owner-1');
      expect(callArgs.where.type).toBe('RECEIVABLE');
      expect(callArgs.where.category).toBe('RENT');
    });

    it('quando o proprietário não é encontrado pelo documento, não soma recebíveis de outra pessoa', async () => {
      prisma.contact.findFirst.mockResolvedValue(null);
      prisma.financialEntry.findMany.mockResolvedValue([]);
      prisma.carneLeaoRecord.findFirst.mockResolvedValue(null);

      await service.calculateCarneLeao('ws-1', {
        period: '2026-03', ownerDocument: '000.000.000-00', ownerName: 'Ninguém',
      });

      const callArgs = prisma.financialEntry.findMany.mock.calls[0][0];
      // Filtro-sentinela que não bate com nenhum contato real — nunca pode
      // cair para "sem filtro" (o que somaria a renda de todo mundo).
      expect(callArgs.where.contactId).toBe('__no_owner_found__');
    });
  });
});
