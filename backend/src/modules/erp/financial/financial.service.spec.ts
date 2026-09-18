import { BadRequestException, NotFoundException } from '@nestjs/common';
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

// Criação manual de lançamento (a porta de entrada das contas a pagar, que
// nenhum fluxo automático gera). O que precisa ficar travado aqui é o filtro
// de workspace nos vínculos: a FK do Prisma só checa existência, não o tenant.

function makeCreatePrismaMock() {
  return {
    financialEntry: {
      create: jest.fn((args: any) => Promise.resolve({ id: 'entry-novo', ...args.data })),
    },
    contract: { findFirst: jest.fn() },
    property: { findFirst: jest.fn() },
    contact: { findFirst: jest.fn() },
  };
}

describe('FinancialService.createEntry', () => {
  let prisma: ReturnType<typeof makeCreatePrismaMock>;
  let service: FinancialService;

  const basePayable = {
    type: 'PAYABLE',
    category: 'OTHER',
    description: 'IPTU do escritório',
    amount: 1200,
    dueDate: '2026-10-10T12:00:00.000Z',
  } as any;

  beforeEach(() => {
    prisma = makeCreatePrismaMock();
    service = new FinancialService(prisma as any, {} as any, {} as any);
  });

  it('cria conta a pagar sem vínculos e sem consultar contrato/imóvel/contato', async () => {
    const result = await service.createEntry('ws-1', basePayable);

    expect(result).toEqual(expect.objectContaining({ type: 'PAYABLE', workspaceId: 'ws-1' }));
    expect(prisma.financialEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workspaceId: 'ws-1', dueDate: new Date(basePayable.dueDate) }),
      }),
    );
    expect(prisma.contract.findFirst).not.toHaveBeenCalled();
    expect(prisma.property.findFirst).not.toHaveBeenCalled();
    expect(prisma.contact.findFirst).not.toHaveBeenCalled();
  });

  it('aceita vínculos que pertencem ao workspace', async () => {
    prisma.contract.findFirst.mockResolvedValue({ id: 'c-1' });
    prisma.property.findFirst.mockResolvedValue({ id: 'p-1' });
    prisma.contact.findFirst.mockResolvedValue({ id: 'ct-1' });

    await service.createEntry('ws-1', {
      ...basePayable,
      contractId: 'c-1',
      propertyId: 'p-1',
      contactId: 'ct-1',
    });

    expect(prisma.contract.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'c-1', workspaceId: 'ws-1' }) }),
    );
    expect(prisma.financialEntry.create).toHaveBeenCalled();
  });

  it('recusa contrato de outro workspace', async () => {
    prisma.contract.findFirst.mockResolvedValue(null);

    await expect(
      service.createEntry('ws-1', { ...basePayable, contractId: 'contrato-de-outra-imobiliaria' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.financialEntry.create).not.toHaveBeenCalled();
  });

  it('recusa imóvel de outro workspace', async () => {
    prisma.property.findFirst.mockResolvedValue(null);

    await expect(
      service.createEntry('ws-1', { ...basePayable, propertyId: 'imovel-alheio' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.financialEntry.create).not.toHaveBeenCalled();
  });

  it('recusa contato de outro workspace', async () => {
    prisma.contact.findFirst.mockResolvedValue(null);

    await expect(
      service.createEntry('ws-1', { ...basePayable, contactId: 'contato-alheio' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.financialEntry.create).not.toHaveBeenCalled();
  });
});
