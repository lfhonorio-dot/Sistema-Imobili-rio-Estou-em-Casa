import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SplitService } from './split.service';

function makePrismaMock() {
  return {
    financialEntry: { findFirst: jest.fn() },
    splitTransaction: {
      create: jest.fn((args: any) => Promise.resolve({ id: 'tx-new', ...args.data })),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
    },
    paymentGatewayConfig: { findFirst: jest.fn() },
  };
}

function makeAsaasMock() {
  return {
    decryptApiKey: jest.fn(),
    transferPix: jest.fn(),
  };
}

describe('SplitService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let asaas: ReturnType<typeof makeAsaasMock>;
  let service: SplitService;

  beforeEach(() => {
    prisma = makePrismaMock();
    asaas = makeAsaasMock();
    service = new SplitService(prisma as any, asaas as any);
  });

  describe('processSplit — cálculo do valor de cada parcela', () => {
    it('regra PERCENTAGE calcula a parcela como percentual do valor total', async () => {
      prisma.financialEntry.findFirst.mockResolvedValue({
        id: 'entry-1',
        contract: {
          splitRules: [
            { recipientId: 'rec-1', type: 'PERCENTAGE', value: 30 },
          ],
        },
      });

      const result = await service.processSplit('ws-1', {
        financialEntryId: 'entry-1', totalAmount: 1000,
      } as any);

      expect(result.transactions[0].amount).toBe(300);
    });

    it('regra FIXED usa o valor fixo, independente do valor total', async () => {
      prisma.financialEntry.findFirst.mockResolvedValue({
        id: 'entry-1',
        contract: {
          splitRules: [
            { recipientId: 'rec-1', type: 'FIXED', value: 150 },
          ],
        },
      });

      const result = await service.processSplit('ws-1', {
        financialEntryId: 'entry-1', totalAmount: 1000,
      } as any);

      expect(result.transactions[0].amount).toBe(150);
    });

    it('recusa quando o contrato não tem nenhuma regra de split ativa', async () => {
      prisma.financialEntry.findFirst.mockResolvedValue({
        id: 'entry-1', contract: { splitRules: [] },
      });
      await expect(
        service.processSplit('ws-1', { financialEntryId: 'entry-1', totalAmount: 1000 } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmSplitTransaction — trava contra repasse em dobro (bloqueante #5)', () => {
    it('quando outra requisição já reivindicou a transação e ela já foi concluída, retorna sem repassar de novo', async () => {
      prisma.splitTransaction.findFirst
        // 1ª chamada: busca inicial da transação
        .mockResolvedValueOnce({ id: 'tx-1', status: 'PENDING', recipient: {} })
        // 2ª chamada: releitura após perder a corrida pelo claim
        .mockResolvedValueOnce({ id: 'tx-1', status: 'COMPLETED' });
      // updateMany não conseguiu reivindicar (a outra requisição já mudou o status)
      prisma.splitTransaction.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.confirmSplitTransaction('ws-1', 'tx-1');

      expect(result).toEqual({ id: 'tx-1', status: 'COMPLETED' });
      expect(asaas.transferPix).not.toHaveBeenCalled();
    });

    it('quando outra requisição está processando a transação agora, recusa em vez de tentar repassar de novo', async () => {
      prisma.splitTransaction.findFirst
        .mockResolvedValueOnce({ id: 'tx-1', status: 'PENDING', recipient: {} })
        .mockResolvedValueOnce({ id: 'tx-1', status: 'PROCESSING' });
      prisma.splitTransaction.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.confirmSplitTransaction('ws-1', 'tx-1')).rejects.toThrow(BadRequestException);
      expect(asaas.transferPix).not.toHaveBeenCalled();
    });

    it('sem gateway ativo, confirma manualmente sem chamar o Asaas', async () => {
      prisma.splitTransaction.findFirst.mockResolvedValueOnce({
        id: 'tx-1', status: 'PENDING', amount: 100, recipient: { pixKey: null },
      });
      prisma.splitTransaction.updateMany.mockResolvedValue({ count: 1 });
      prisma.paymentGatewayConfig.findFirst.mockResolvedValue(null);

      const result = await service.confirmSplitTransaction('ws-1', 'tx-1');

      expect(result.status).toBe('COMPLETED');
      expect(asaas.transferPix).not.toHaveBeenCalled();
    });

    it('transação inexistente lança NotFoundException', async () => {
      prisma.splitTransaction.findFirst.mockResolvedValueOnce(null);
      await expect(service.confirmSplitTransaction('ws-1', 'tx-inexistente')).rejects.toThrow(NotFoundException);
    });
  });
});
