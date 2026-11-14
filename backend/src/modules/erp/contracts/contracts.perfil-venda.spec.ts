import { BadRequestException } from '@nestjs/common';
import { ContractsService } from './contracts.service';

// Fase 1 — no perfil VENDA, contratos de locação são recusados com mensagem
// clara (o módulo fica oculto; nada é apagado). No perfil VENDA_E_LOCACAO o
// fluxo segue normalmente até as validações seguintes.

function makePrisma(operationProfile: string) {
  return {
    property: {
      findFirst: jest.fn().mockResolvedValue({ id: 'p-1', workspaceId: 'ws-1', status: 'AVAILABLE' }),
    },
    workspace: { findUnique: jest.fn().mockResolvedValue({ operationProfile }) },
    contract: {
      // Usado na checagem de duplicidade: devolvemos um "ativo" para o teste
      // parar ali, provando que passou da checagem de perfil.
      findFirst: jest.fn().mockResolvedValue({ id: 'c-x', code: 'C-2026-0001' }),
    },
  };
}

const rentalDto = {
  type: 'RENTAL_RESIDENTIAL',
  propertyId: 'p-1',
  rentalValue: 2000,
  dueDay: 10,
} as any;

function makeService(prisma: unknown) {
  return new ContractsService(prisma as any, {} as any, {} as any, {} as any, {} as any, {} as any);
}

describe('ContractsService.create — perfil de operação', () => {
  it('recusa contrato de locação no perfil VENDA', async () => {
    const prisma = makePrisma('VENDA');
    const service = makeService(prisma);

    const call = service.create('ws-1', rentalDto, 'u-1');
    await expect(call).rejects.toBeInstanceOf(BadRequestException);
    await expect(call).rejects.toThrow(/locação não estão disponíveis no perfil de operação "Venda"/);
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: 'ws-1' },
      select: { operationProfile: true },
    });
    expect(prisma.contract.findFirst).not.toHaveBeenCalled();
  });

  it('no perfil VENDA_E_LOCACAO segue para as validações seguintes', async () => {
    const prisma = makePrisma('VENDA_E_LOCACAO');
    const service = makeService(prisma);

    await expect(service.create('ws-1', rentalDto, 'u-1')).rejects.toThrow(/Já existe um contrato ativo/);
  });

  it('contrato de venda não consulta o perfil', async () => {
    const prisma = makePrisma('VENDA');
    const service = makeService(prisma);

    await expect(
      service.create('ws-1', { type: 'SALE', propertyId: 'p-1', saleValue: 300000 } as any, 'u-1'),
    ).rejects.toThrow(/Já existe um contrato ativo/);
    expect(prisma.workspace.findUnique).not.toHaveBeenCalled();
  });
});
