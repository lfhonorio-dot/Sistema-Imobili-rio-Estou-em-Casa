import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BillingService } from './billing.service';

// Um Prisma.Decimal de verdade não é um number — em tempo de execução ele
// só vira o valor certo se alguém chamar Number(...) nele (ele expõe
// toString(), não um valueOf() numérico). Este stub imita exatamente esse
// comportamento, para os testes pegarem o mesmo bug que pegaria em produção
// se alguém voltasse a fazer conta direto em cima do campo.
class DecimalStub {
  constructor(private raw: string) {}
  toString() { return this.raw; }
}

function makePrismaMock() {
  return {
    boleto: {
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    financialEntry: {
      update: jest.fn(),
    },
    paymentGatewayConfig: {
      findFirst: jest.fn(),
    },
    cnabFile: {
      create: jest.fn(),
    },
    splitRule: {
      findMany: jest.fn(),
    },
  };
}

function makeAsaasMock() {
  return {
    decryptApiKey: jest.fn(),
    ensureCustomer: jest.fn(),
    createBoletoPayment: jest.fn(),
    transferPix: jest.fn(),
  };
}

describe('BillingService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let asaas: ReturnType<typeof makeAsaasMock>;
  let service: BillingService;

  beforeEach(() => {
    prisma = makePrismaMock();
    asaas = makeAsaasMock();
    service = new BillingService(prisma as any, asaas as any);
  });

  describe('confirmPayment (FIX 13 — Decimal)', () => {
    it('usa o valor do boleto (convertido com Number) quando nenhum paidAmount é informado', async () => {
      prisma.boleto.findFirst.mockResolvedValue({
        id: 'bol-1', status: 'PENDING', amount: new DecimalStub('1234.56'), financialEntryId: null,
      });

      await service.confirmPayment('ws-1', 'bol-1');

      expect(prisma.boleto.update).toHaveBeenCalledWith({
        where: { id: 'bol-1' },
        data: expect.objectContaining({ status: 'PAID', paidAmount: 1234.56 }),
      });
    });

    it('recusa confirmar pagamento de um boleto que já está pago', async () => {
      prisma.boleto.findFirst.mockResolvedValue({ id: 'bol-1', status: 'PAID', amount: new DecimalStub('100') });
      await expect(service.confirmPayment('ws-1', 'bol-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('processWebhook (bloqueante #4 — assinatura do webhook)', () => {
    it('recusa quando o gateway não tem webhookSecret configurado', async () => {
      prisma.paymentGatewayConfig.findFirst.mockResolvedValue({ webhookSecret: null });
      await expect(
        service.processWebhook('ws-1', { event: 'PAYMENT_RECEIVED' }, 'qualquer-token'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('recusa quando o token recebido não bate com o webhookSecret', async () => {
      prisma.paymentGatewayConfig.findFirst.mockResolvedValue({ webhookSecret: 'segredo-correto' });
      await expect(
        service.processWebhook('ws-1', { event: 'PAYMENT_RECEIVED' }, 'token-forjado'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('confirma o pagamento quando o token bate e o evento é PAYMENT_RECEIVED', async () => {
      prisma.paymentGatewayConfig.findFirst.mockResolvedValue({ webhookSecret: 'segredo-correto' });
      prisma.boleto.findFirst.mockResolvedValue({
        id: 'bol-1', status: 'REGISTERED', amount: new DecimalStub('500'), financialEntryId: null,
      });

      const result = await service.processWebhook(
        'ws-1',
        { event: 'PAYMENT_RECEIVED', payment: { id: 'pay-1', value: 500 } },
        'segredo-correto',
      );

      expect(result).toEqual({ received: true });
      expect(prisma.boleto.update).toHaveBeenCalledWith({
        where: { id: 'bol-1' },
        data: expect.objectContaining({ status: 'PAID' }),
      });
    });
  });

  describe('generateRemessa / CNAB (FIX 13 — arquivo de remessa bancária)', () => {
    it('codifica o valor do boleto certo no arquivo CNAB mesmo vindo como Decimal', async () => {
      prisma.paymentGatewayConfig.findFirst.mockResolvedValue({ id: 'gw-1' });
      prisma.boleto.findMany.mockResolvedValue([
        { nossoNumero: '12345', amount: new DecimalStub('1234.56') },
      ]);
      prisma.cnabFile.create.mockResolvedValue({ id: 'cnab-1' });

      const result = await service.generateRemessa('ws-1', { format: 'CNAB400' } as any);
      const content = Buffer.from(result.content, 'base64').toString('utf-8');

      // R$ 1.234,56 em centavos = 123456, com 15 dígitos = 000000000123456.
      // Se alguém voltar a fazer `amount * 100` sem Number(), isso vira
      // "NaN" no arquivo de remessa em vez do valor — é exatamente isso
      // que este teste pega.
      expect(content).toContain('000000000123456');
      expect(content).not.toContain('NaN');
    });
  });
});
