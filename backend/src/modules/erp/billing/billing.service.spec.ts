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
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
    financialPayment: { findFirst: jest.fn() },
    gatewayWebhookEvent: { create: jest.fn(), update: jest.fn() },
    bankAccount: { findFirst: jest.fn() },
    $transaction: jest.fn(),
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
  let payments: { register: jest.Mock; reverse: jest.Mock };

  beforeEach(() => {
    prisma = makePrismaMock();
    asaas = makeAsaasMock();
    payments = { register: jest.fn(), reverse: jest.fn() };
    // transação de mentira: roda o callback com o próprio mock como "tx"
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma));
    service = new BillingService(prisma as any, asaas as any, payments as any);
  });

  describe('confirmPayment (manual, só cobranças sem gateway)', () => {
    it('usa o valor da cobrança (convertido com Number) quando nenhum paidAmount é informado', async () => {
      const bol = { id: 'bol-1', workspaceId: 'ws-1', status: 'PENDING', kind: 'BOLETO', amount: new DecimalStub('1234.56'), financialEntryId: null, entryRef: null, gatewayBoletoId: null };
      prisma.boleto.findFirst.mockResolvedValue(bol);

      await service.confirmPayment('ws-1', 'bol-1');

      expect(prisma.boleto.update).toHaveBeenCalledWith({
        where: { id: 'bol-1' },
        data: expect.objectContaining({ status: 'PAID', paidAmount: 1234.56 }),
      });
    });

    it('recusa confirmar "na mão" uma cobrança do Asaas (a baixa vem do webhook)', async () => {
      prisma.boleto.findFirst.mockResolvedValue({ id: 'bol-1', status: 'REGISTERED', amount: new DecimalStub('100'), gatewayBoletoId: 'pay_1' });
      await expect(service.confirmPayment('ws-1', 'bol-1')).rejects.toThrow(/automática/);
      expect(prisma.boleto.update).not.toHaveBeenCalled();
    });

    it('recusa confirmar pagamento de uma cobrança que já está paga', async () => {
      prisma.boleto.findFirst.mockResolvedValue({ id: 'bol-1', status: 'PAID', amount: new DecimalStub('100') });
      await expect(service.confirmPayment('ws-1', 'bol-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('processWebhook (assinatura + idempotência + baixa)', () => {
    it('recusa quando o gateway não tem token de webhook configurado', async () => {
      prisma.paymentGatewayConfig.findFirst.mockResolvedValue({ webhookSecret: null });
      await expect(
        service.processWebhook('ws-1', { event: 'PAYMENT_RECEIVED' }, 'qualquer-token'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('recusa quando o token recebido não bate com o configurado', async () => {
      prisma.paymentGatewayConfig.findFirst.mockResolvedValue({ webhookSecret: 'segredo-correto' });
      await expect(
        service.processWebhook('ws-1', { event: 'PAYMENT_RECEIVED' }, 'token-forjado'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.gatewayWebhookEvent.create).not.toHaveBeenCalled();
    });

    it('PAYMENT_RECEIVED: baixa a conta (com juros pagos no gateway) e marca a cobrança como paga', async () => {
      prisma.paymentGatewayConfig.findFirst.mockResolvedValue({ webhookSecret: 'segredo-correto', metadata: {} });
      prisma.boleto.findFirst.mockResolvedValue({
        id: 'bol-1', workspaceId: 'ws-1', kind: 'BOLETO', status: 'REGISTERED', amount: new DecimalStub('500'),
        financialEntryId: 'e-1', entryRef: 'e-1', gatewayBoletoId: 'pay-1',
      });
      prisma.financialEntry.findFirst.mockResolvedValue({ id: 'e-1', status: 'OVERDUE', amount: 500, paidAmount: null });

      const result = await service.processWebhook(
        'ws-1',
        { id: 'evt_1', event: 'PAYMENT_RECEIVED', payment: { id: 'pay-1', value: 510, originalValue: 500, paymentDate: '2026-11-10' } },
        'segredo-correto',
      );

      expect(result).toEqual({ received: true, result: 'PAID' });
      expect(prisma.gatewayWebhookEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ workspaceId: 'ws-1', eventId: 'evt_1' }) });
      expect(payments.register).toHaveBeenCalledWith('ws-1', 'e-1',
        expect.objectContaining({ principal: 500, interest: 10, discount: 0, source: 'GATEWAY', gatewayPaymentId: 'pay-1' }),
        undefined, prisma);
      expect(prisma.boleto.update).toHaveBeenCalledWith({
        where: { id: 'bol-1' },
        data: expect.objectContaining({ status: 'PAID', paidAmount: 510 }),
      });
    });

    it('evento repetido (mesmo id) não baixa de novo', async () => {
      const { Prisma } = jest.requireActual('@prisma/client');
      prisma.paymentGatewayConfig.findFirst.mockResolvedValue({ webhookSecret: 'segredo-correto' });
      prisma.gatewayWebhookEvent.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
      );
      const r = await service.processWebhook('ws-1', { id: 'evt_1', event: 'PAYMENT_RECEIVED', payment: { id: 'pay-1' } }, 'segredo-correto');
      expect(r).toEqual({ received: true, duplicate: true });
      expect(payments.register).not.toHaveBeenCalled();
    });

    it('PAYMENT_DELETED: cancela a cobrança e libera a conta para nova emissão', async () => {
      prisma.paymentGatewayConfig.findFirst.mockResolvedValue({ webhookSecret: 'segredo-correto' });
      prisma.boleto.findFirst.mockResolvedValue({ id: 'bol-2', status: 'REGISTERED', financialEntryId: 'e-2' });
      const r = await service.processWebhook('ws-1', { id: 'evt_2', event: 'PAYMENT_DELETED', payment: { id: 'pay-2' } }, 'segredo-correto');
      expect(r).toEqual({ received: true, result: 'CANCELLED' });
      expect(prisma.boleto.update).toHaveBeenCalledWith({
        where: { id: 'bol-2' },
        data: expect.objectContaining({ status: 'CANCELLED', financialEntryId: null }),
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
