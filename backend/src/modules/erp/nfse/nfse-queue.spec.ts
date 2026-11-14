import { NfseService } from './nfse.service';

// Fase 6 — fila da NFS-e: falha de comunicação volta para a fila com espera;
// na tentativa seguinte, consulta o RPS antes de reenviar (nunca duplica);
// depois do limite, vira "falha de comunicação" para o usuário reenviar.

function setup(record: Record<string, unknown>) {
  const updates: Array<Record<string, unknown>> = [];
  const prisma = {
    nfseRecord: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(record),
      update: jest.fn((a: { data: Record<string, unknown> }) => { updates.push(a.data); return Promise.resolve({}); }),
    },
    contact: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const cfg = { cnpj: '12345678000195', inscricaoMunicipal: '1', itemListaServico: '10.05', codigoMunicipioIbge: '3516200', nfseEnvironment: 'HOMOLOG',
    nfseSoapNamespace: 'x', exigibilidadeIss: 1, optanteSimples: false, incentivoFiscal: false, regimeEspecialTributacao: null, cnae: null, codigoTributacaoMunicipio: null };
  const config = {
    raw: jest.fn().mockResolvedValue(cfg), readiness: jest.fn().mockReturnValue({ ready: true, missing: [] }),
    wsUrl: jest.fn().mockReturnValue('https://x'), loadCertificate: jest.fn().mockReturnValue({}),
  };
  const provider = { name: 'SIL_ABRASF24', emit: jest.fn(), consultByRps: jest.fn(), cancel: jest.fn() };
  const service = new NfseService(prisma as never, {} as never, {} as never, {} as never, config as never, provider as never);
  const authorize = jest.spyOn(service as never as { authorize: () => Promise<void> }, 'authorize').mockResolvedValue(undefined);
  return { service, prisma, provider, updates, authorize };
}

const base = { id: 'n1', workspaceId: 'ws', environment: 'HOMOLOG', rpsSerie: '1', rpsNumber: 7, takerDocument: '52998224725', takerName: 'X',
  description: 'Intermediação', competence: new Date(), createdAt: new Date(), baseAmount: 100, amount: 100, issRate: 2, issDue: 2, issAmount: 2,
  issRetained: false, pisRetained: 0, cofinsRetained: 0, irRetained: 0, csllRetained: 0, takerContactId: null, takerEmail: null };

describe('fila da NFS-e', () => {
  it('falha de comunicação: volta para a fila com espera, sem marcar erro', async () => {
    const { service, provider, updates } = setup({ ...base, retryCount: 0 });
    provider.emit.mockResolvedValue({ kind: 'TRANSIENT', reason: 'Sem resposta da prefeitura (ETIMEDOUT).' });
    await service.processOne('n1');
    expect(updates[0]).toMatchObject({ status: 'QUEUED', retryCount: 1 });
    expect((updates[0].nextAttemptAt as Date).getTime()).toBeGreaterThan(Date.now() + 30_000);
    expect(provider.consultByRps).not.toHaveBeenCalled();
  });

  it('na nova tentativa, consulta o RPS primeiro: se a nota já existe, não reenvia', async () => {
    const { service, provider, authorize } = setup({ ...base, retryCount: 1 });
    provider.consultByRps.mockResolvedValue({ kind: 'AUTHORIZED', numero: '99', xml: '<CompNfse/>', requestXml: '' });
    await service.processOne('n1');
    expect(provider.consultByRps).toHaveBeenCalledWith(expect.anything(), '1', 7);
    expect(provider.emit).not.toHaveBeenCalled();
    expect(authorize).toHaveBeenCalled();
  });

  it('se o RPS não existe, reenvia', async () => {
    const { service, provider, authorize } = setup({ ...base, retryCount: 2 });
    provider.consultByRps.mockResolvedValue({ kind: 'NOT_FOUND' });
    provider.emit.mockResolvedValue({ kind: 'AUTHORIZED', numero: '100', xml: '<CompNfse/>', requestXml: '' });
    await service.processOne('n1');
    expect(provider.emit).toHaveBeenCalledTimes(1);
    expect(authorize).toHaveBeenCalled();
  });

  it('depois do limite de tentativas vira "falha de comunicação"', async () => {
    const { service, provider, updates } = setup({ ...base, retryCount: 5 });
    provider.consultByRps.mockResolvedValue({ kind: 'NOT_FOUND' });
    provider.emit.mockResolvedValue({ kind: 'TRANSIENT', reason: 'HTTP 503.' });
    await service.processOne('n1');
    expect(updates[0]).toMatchObject({ status: 'ERROR', nextAttemptAt: null });
    expect(String(updates[0].rejectionReason)).toMatch(/Reenviar/);
  });

  it('rejeição da prefeitura grava o motivo e não tenta de novo sozinha', async () => {
    const { service, provider, updates } = setup({ ...base, retryCount: 0 });
    provider.emit.mockResolvedValue({ kind: 'REJECTED', reason: '[E160] Código inválido', requestXml: '' });
    await service.processOne('n1');
    expect(updates[0]).toMatchObject({ status: 'REJECTED', rejectionReason: '[E160] Código inválido', nextAttemptAt: null });
  });

  it('nota já pega por outro processo não é processada de novo', async () => {
    const { service, prisma, provider } = setup({ ...base, retryCount: 0 });
    prisma.nfseRecord.updateMany.mockResolvedValue({ count: 0 });
    await service.processOne('n1');
    expect(provider.emit).not.toHaveBeenCalled();
  });
});
