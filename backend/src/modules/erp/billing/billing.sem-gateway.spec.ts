import { BadRequestException } from '@nestjs/common';
import { BillingService, BOLETO_UNAVAILABLE_MESSAGE } from './billing.service';

// Fase 1 — regra 5. Sem gateway Asaas ativo, o boleto NÃO é emitido e nada
// é gravado. Antes, o sistema criava um boleto "simulado" com linha
// digitável e PIX inventados.

function makePrisma(gateway: Record<string, unknown> | null) {
  return {
    paymentGatewayConfig: { findFirst: jest.fn().mockResolvedValue(gateway) },
    boleto: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
    financialEntry: { findFirst: jest.fn(), update: jest.fn() },
  };
}

const dto = { amount: 1500, dueDate: '2026-12-10', contactId: 'c-1' } as any;

describe('BillingService sem gateway real', () => {
  it('recusa a emissão quando não há gateway configurado', async () => {
    const prisma = makePrisma(null);
    const service = new BillingService(prisma as any, {} as any);

    await expect(service.generateBoleto('ws-1', dto)).rejects.toThrow(BOLETO_UNAVAILABLE_MESSAGE);
    expect(prisma.boleto.create).not.toHaveBeenCalled();
  });

  it('recusa quando o gateway padrão é de um provedor sem integração (ex.: EFI)', async () => {
    const prisma = makePrisma({ id: 'g-1', provider: 'EFI', isActive: true });
    const service = new BillingService(prisma as any, {} as any);

    await expect(service.generateBoleto('ws-1', dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.boleto.create).not.toHaveBeenCalled();
  });

  it('recusa quando o gateway Asaas está inativo', async () => {
    const prisma = makePrisma({ id: 'g-1', provider: 'ASAAS', isActive: false });
    const service = new BillingService(prisma as any, {} as any);

    await expect(service.generateBoleto('ws-1', dto)).rejects.toThrow(BOLETO_UNAVAILABLE_MESSAGE);
  });

  it('reemissão sem gateway não cancela o boleto atual', async () => {
    const prisma = makePrisma(null);
    prisma.boleto.findFirst.mockResolvedValue({ id: 'b-1', status: 'REGISTERED' });
    const service = new BillingService(prisma as any, {} as any);

    await expect(service.reissueBoleto('ws-1', 'b-1', '2026-12-20')).rejects.toThrow(BOLETO_UNAVAILABLE_MESSAGE);
    expect(prisma.boleto.update).not.toHaveBeenCalled();
  });

  it('hasActiveBoletoGateway filtra pelo workspace e só considera Asaas ativo', async () => {
    const prisma = makePrisma({ id: 'g-1' });
    const service = new BillingService(prisma as any, {} as any);

    await expect(service.hasActiveBoletoGateway('ws-1')).resolves.toBe(true);
    expect(prisma.paymentGatewayConfig.findFirst).toHaveBeenCalledWith({
      where: { workspaceId: 'ws-1', provider: 'ASAAS', isActive: true, deletedAt: null },
      select: { id: true },
    });
  });
});
