import { NotFoundException } from '@nestjs/common';
import { FinancialService } from './financial.service';

// A falha reportada ("Contas a Pagar sem botão de pagamento") era só do
// frontend — o backend já registrava pagamento igual para PAYABLE e
// RECEIVABLE. Este teste trava esse comportamento genérico, para uma
// mudança futura não reintroduzir uma ramificação por tipo aqui.

function makePrismaMock() {
  return {
    financialEntry: {
      findFirst: jest.fn(),
      update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
    },
  };
}

describe('FinancialService.payEntry', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: FinancialService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new FinancialService(prisma as any, {} as any, {} as any);
  });

  it('registra pagamento de um lançamento do tipo PAYABLE (contas a pagar)', async () => {
    prisma.financialEntry.findFirst.mockResolvedValue({
      id: 'entry-1', type: 'PAYABLE', amount: 500, status: 'PENDING',
    });

    const result = await service.payEntry('ws-1', 'entry-1', {} as any);

    expect(result.status).toBe('PAID');
    expect(prisma.financialEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'entry-1' },
        data: expect.objectContaining({ status: 'PAID', paidAmount: 500 }),
      }),
    );
  });

  it('registra pagamento de um lançamento do tipo RECEIVABLE (contas a receber)', async () => {
    prisma.financialEntry.findFirst.mockResolvedValue({
      id: 'entry-2', type: 'RECEIVABLE', amount: 800, status: 'PENDING',
    });

    const result = await service.payEntry('ws-1', 'entry-2', {} as any);

    expect(result.status).toBe('PAID');
  });

  it('usa o paidAmount informado em vez do valor original, quando enviado', async () => {
    prisma.financialEntry.findFirst.mockResolvedValue({
      id: 'entry-3', type: 'PAYABLE', amount: 500, status: 'PENDING',
    });

    await service.payEntry('ws-1', 'entry-3', { paidAmount: 480 } as any);

    expect(prisma.financialEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paidAmount: 480 }) }),
    );
  });

  it('lança NotFoundException para lançamento inexistente ou de outro workspace', async () => {
    prisma.financialEntry.findFirst.mockResolvedValue(null);
    await expect(service.payEntry('ws-1', 'entry-x', {} as any)).rejects.toThrow(NotFoundException);
  });
});
