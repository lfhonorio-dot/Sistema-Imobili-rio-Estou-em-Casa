import { BadRequestException } from '@nestjs/common';
import { FiscalService } from './fiscal.service';

// Fase 1 — regra 5 (nada de sucesso fabricado). Sem provedor de NFS-e
// configurado, a emissão é recusada com mensagem clara e NADA é gravado.
// Antes, a nota era salva como ISSUED ("emitida") sem ir à prefeitura.

describe('FiscalService.emitNfse sem provedor', () => {
  const original = process.env.FOCUS_NFE_TOKEN;

  afterEach(() => {
    if (original === undefined) delete process.env.FOCUS_NFE_TOKEN;
    else process.env.FOCUS_NFE_TOKEN = original;
  });

  it('recusa a emissão e não grava nenhuma nota', async () => {
    delete process.env.FOCUS_NFE_TOKEN;
    const prisma = {
      taxConfig: { findFirst: jest.fn() },
      nfseRecord: { create: jest.fn(), update: jest.fn() },
    };
    const service = new FiscalService(prisma as any);

    const call = service.emitNfse('ws-1', {
      issuerCnpj: '00.000.000/0001-00',
      takerDocument: '000.000.000-00',
      takerName: 'Tomador',
      serviceCode: '10.05',
      description: 'Intermediação imobiliária',
      amount: 1000,
    } as any);

    await expect(call).rejects.toBeInstanceOf(BadRequestException);
    await expect(call).rejects.toThrow(/não disponível/);
    expect(prisma.nfseRecord.create).not.toHaveBeenCalled();
  });
});

describe('FiscalService.saveTaxConfig', () => {
  it('cria a configuração fiscal com regime LUCRO_PRESUMIDO por padrão', async () => {
    const prisma = {
      taxConfig: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn((a: any) => Promise.resolve(a.data)),
      },
    };
    const service = new FiscalService(prisma as any);

    const saved = await service.saveTaxConfig('ws-1', { inscricaoMunicipal: '123' } as any);

    expect(saved.regime).toBe('LUCRO_PRESUMIDO');
    expect(saved.workspaceId).toBe('ws-1');
  });

  it('respeita o regime quando informado explicitamente', async () => {
    const prisma = {
      taxConfig: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn((a: any) => Promise.resolve(a.data)),
      },
    };
    const service = new FiscalService(prisma as any);
    const saved = await service.saveTaxConfig('ws-1', { regime: 'LUCRO_REAL' } as any);
    expect(saved.regime).toBe('LUCRO_REAL');
  });
});
