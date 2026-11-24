import { BadRequestException } from '@nestjs/common';
import { IssuerService } from './issuer.service';
import { asSnapshot, legalName } from './issuer.types';

const CNPJ_A = '11222333000181';
const CNPJ_B = '11444777000161';

function entity(over: Record<string, unknown> = {}) {
  return {
    id: 'le-1', workspaceId: 'ws-1', cnpj: CNPJ_A, razaoSocial: 'Empresa Antiga Ltda', nomeFantasia: 'Estou em Casa',
    inscricaoMunicipal: '123', endereco: 'Rua A, 1', regimeTributario: 'LUCRO_PRESUMIDO',
    validFrom: new Date('2024-01-01T03:00:00Z'), validTo: null, createdBy: null,
    nfseCertPfxEnc: null, nfseCertPasswordEnc: null, nfseCertSubject: null, nfseCertValidUntil: null,
    nfseRpsSerie: null, nfseRpsNextNumber: null, checklist: {}, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
    ...over,
  };
}

function makePrisma() {
  const p: any = {
    workspaceLegalEntity: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    workspace: { findFirst: jest.fn(), update: jest.fn() },
    taxConfig: { findFirst: jest.fn(), update: jest.fn() },
    paymentGatewayConfig: { updateMany: jest.fn(), findFirst: jest.fn() },
    whatsAppConfig: { findFirst: jest.fn() },
    contract: { updateMany: jest.fn(), findFirst: jest.fn() },
  };
  p.$transaction = jest.fn((fn: any) => fn(p));
  return p;
}

describe('IssuerService (dados da empresa com histórico)', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let audit: { log: jest.Mock };
  let service: IssuerService;

  beforeEach(() => {
    prisma = makePrisma();
    audit = { log: jest.fn() };
    service = new IssuerService(prisma as any, audit as any);
  });

  describe('getCurrentSnapshot', () => {
    it('devolve a cópia do registro vigente com data de captura e id do registro', async () => {
      prisma.workspaceLegalEntity.findFirst.mockResolvedValue(entity());
      const s = await service.getCurrentSnapshot('ws-1');
      expect(s).toMatchObject({ cnpj: CNPJ_A, razaoSocial: 'Empresa Antiga Ltda', legalEntityId: 'le-1' });
      expect(Date.parse(s.capturedAt)).not.toBeNaN();
      expect(prisma.workspaceLegalEntity.findFirst).toHaveBeenCalledWith({ where: { workspaceId: 'ws-1', validTo: null, deletedAt: null } });
    });

    it('imobiliária sem registro: cria o vigente a partir do cadastro atual', async () => {
      prisma.workspaceLegalEntity.findFirst.mockResolvedValue(null);
      prisma.workspace.findFirst.mockResolvedValue({ name: 'Imob', cnpj: '11.222.333/0001-81', address: null, createdAt: new Date('2025-01-01') });
      prisma.taxConfig.findFirst.mockResolvedValue(null);
      prisma.workspaceLegalEntity.create.mockImplementation(async ({ data }: any) => ({ id: 'novo', ...data }));
      const s = await service.getCurrentSnapshot('ws-1');
      expect(s.cnpj).toBe(CNPJ_A);
      expect(prisma.workspaceLegalEntity.create.mock.calls[0][0].data.workspaceId).toBe('ws-1');
    });
  });

  describe('freeze (gravar a cópia no documento)', () => {
    it('só preenche quando o documento ainda não tem cópia, sempre filtrando por workspace', async () => {
      prisma.workspaceLegalEntity.findFirst.mockResolvedValue(entity());
      prisma.contract.findFirst.mockResolvedValue({ issuerSnapshot: { cnpj: CNPJ_B, razaoSocial: 'Gravada', capturedAt: '2025-01-01T00:00:00Z' } });
      const s = await service.freeze('contract', 'ws-1', 'c-1');
      const where = prisma.contract.updateMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ id: 'c-1', workspaceId: 'ws-1' });
      expect(where.issuerSnapshot).toBeDefined(); // só onde é NULL
      expect(s.cnpj).toBe(CNPJ_B); // devolve a que ficou valendo (a já gravada)
    });
  });

  describe('updateDetails (telas antigas)', () => {
    it('recusa trocar o CNPJ por edição simples', async () => {
      prisma.workspaceLegalEntity.findFirst.mockResolvedValue(entity());
      await expect(service.updateDetails('ws-1', 'u-1', { cnpj: CNPJ_B })).rejects.toThrow(/Trocar CNPJ ou razão social/);
      expect(prisma.workspaceLegalEntity.update).not.toHaveBeenCalled();
    });

    it('recusa trocar a razão social por edição simples', async () => {
      prisma.workspaceLegalEntity.findFirst.mockResolvedValue(entity());
      await expect(service.updateDetails('ws-1', 'u-1', { razaoSocial: 'Outra' })).rejects.toThrow(BadRequestException);
    });

    it('aceita o mesmo CNPJ com pontuação e edita só endereço/nome fantasia (auditado)', async () => {
      prisma.workspaceLegalEntity.findFirst.mockResolvedValue(entity());
      prisma.workspaceLegalEntity.update.mockResolvedValue(entity({ endereco: 'Rua B, 2' }));
      await service.updateDetails('ws-1', 'u-1', { cnpj: '11.222.333/0001-81', endereco: 'Rua B, 2' });
      expect(prisma.workspaceLegalEntity.update).toHaveBeenCalledWith({ where: { id: 'le-1' }, data: { endereco: 'Rua B, 2' } });
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LEGAL_ENTITY_UPDATED', workspaceId: 'ws-1' }));
    });

    it('preenche o CNPJ quando ainda está vazio', async () => {
      prisma.workspaceLegalEntity.findFirst.mockResolvedValue(entity({ cnpj: null }));
      prisma.workspaceLegalEntity.update.mockResolvedValue(entity());
      await service.updateDetails('ws-1', 'u-1', { cnpj: CNPJ_A });
      expect(prisma.workspaceLegalEntity.update.mock.calls[0][0].data).toEqual({ cnpj: CNPJ_A });
    });
  });

  describe('changeIdentity (trocar CNPJ/razão social)', () => {
    const input = { cnpj: CNPJ_B, razaoSocial: 'Empresa Nova Ltda', validFrom: '2025-07-01' };

    it('valida CNPJ, data futura e data anterior ao registro atual', async () => {
      prisma.workspaceLegalEntity.findFirst.mockResolvedValue(entity());
      await expect(service.changeIdentity('ws-1', 'u-1', { ...input, cnpj: '11111111111111' })).rejects.toThrow('CNPJ inválido.');
      await expect(service.changeIdentity('ws-1', 'u-1', { ...input, validFrom: '2999-01-01' })).rejects.toThrow(/futuro/);
      await expect(service.changeIdentity('ws-1', 'u-1', { ...input, validFrom: '2023-12-01' })).rejects.toThrow(/precisa ser depois/);
    });

    it('recusa quando nada muda', async () => {
      prisma.workspaceLegalEntity.findFirst.mockResolvedValue(entity());
      await expect(service.changeIdentity('ws-1', 'u-1', { ...input, cnpj: CNPJ_A, razaoSocial: 'Empresa Antiga Ltda' })).rejects.toThrow(/não há o que trocar/);
    });

    it('encerra o vigente, arquiva certificado e RPS, vincula gateways antigos, cria o novo e sincroniza os campos antigos', async () => {
      prisma.workspaceLegalEntity.findFirst
        .mockResolvedValueOnce(entity()) // getCurrent
        .mockResolvedValueOnce(null); // CNPJ novo nunca usado
      prisma.taxConfig.findFirst.mockResolvedValue({
        certPfxEnc: 'enc-pfx', certPasswordEnc: 'enc-pw', certSubject: 'CN=ANTIGA:11222333000181', certValidUntil: new Date('2027-01-01'),
        rpsSerie: '1', rpsNextNumber: 42,
      });
      prisma.workspaceLegalEntity.update.mockImplementation(async ({ data }: any) => entity(data));
      prisma.workspaceLegalEntity.create.mockImplementation(async ({ data }: any) => ({ id: 'le-2', ...data }));

      const r = await service.changeIdentity('ws-1', 'u-1', input);

      const closed = prisma.workspaceLegalEntity.update.mock.calls[0][0];
      expect(closed.where).toEqual({ id: 'le-1' });
      expect(closed.data).toMatchObject({ nfseCertPfxEnc: 'enc-pfx', nfseCertPasswordEnc: 'enc-pw', nfseRpsNextNumber: 42 });
      expect(closed.data.validTo).toEqual(new Date('2025-07-01T03:00:00.000Z'));
      expect(prisma.paymentGatewayConfig.updateMany).toHaveBeenCalledWith({ where: { workspaceId: 'ws-1', legalEntityId: null }, data: { legalEntityId: 'le-1' } });
      const created = prisma.workspaceLegalEntity.create.mock.calls[0][0].data;
      expect(created).toMatchObject({ workspaceId: 'ws-1', cnpj: CNPJ_B, razaoSocial: 'Empresa Nova Ltda', inscricaoMunicipal: null, createdBy: 'u-1' });
      expect(prisma.workspace.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'ws-1' }, data: expect.objectContaining({ cnpj: CNPJ_B }) }));
      const tax = prisma.taxConfig.update.mock.calls[0][0];
      expect(tax.where).toEqual({ workspaceId: 'ws-1' });
      expect(tax.data).toMatchObject({ cnpj: CNPJ_B, certPfxEnc: null, nfseEnvironment: 'HOMOLOG', productionAuthorizedAt: null });
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LEGAL_ENTITY_CNPJ_CHANGED', workspaceId: 'ws-1', userId: 'u-1' }));
      expect(r.cnpjChanged).toBe(true);
    });

    it('troca só da razão social mantém certificado e inscrição municipal', async () => {
      prisma.workspaceLegalEntity.findFirst.mockResolvedValueOnce(entity());
      prisma.taxConfig.findFirst.mockResolvedValue({ certPfxEnc: 'enc', certPasswordEnc: 'pw' });
      prisma.workspaceLegalEntity.update.mockImplementation(async ({ data }: any) => entity(data));
      prisma.workspaceLegalEntity.create.mockImplementation(async ({ data }: any) => ({ id: 'le-2', ...data }));
      await service.changeIdentity('ws-1', 'u-1', { ...input, cnpj: CNPJ_A });
      expect(prisma.workspaceLegalEntity.update.mock.calls[0][0].data.nfseCertPfxEnc).toBeUndefined();
      expect(prisma.workspaceLegalEntity.create.mock.calls[0][0].data.inscricaoMunicipal).toBe('123');
      expect(prisma.taxConfig.update.mock.calls[0][0].data.certPfxEnc).toBeUndefined();
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LEGAL_ENTITY_NAME_CHANGED' }));
    });
  });

  describe('archivedFiscalCredentials', () => {
    it('CNPJ vigente: usa a configuração atual (null)', async () => {
      prisma.workspaceLegalEntity.findFirst.mockResolvedValue(entity());
      expect(await service.archivedFiscalCredentials('ws-1', CNPJ_A)).toBeNull();
    });

    it('CNPJ anterior: devolve o certificado arquivado daquela empresa', async () => {
      prisma.workspaceLegalEntity.findFirst
        .mockResolvedValueOnce(entity({ id: 'le-2', cnpj: CNPJ_B }))
        .mockResolvedValueOnce(entity({ validTo: new Date(), nfseCertPfxEnc: 'old', nfseCertPasswordEnc: 'oldpw' }));
      const r = await service.archivedFiscalCredentials('ws-1', CNPJ_A);
      expect(r).toEqual({ cnpj: CNPJ_A, inscricaoMunicipal: '123', certPfxEnc: 'old', certPasswordEnc: 'oldpw' });
      expect(prisma.workspaceLegalEntity.findFirst.mock.calls[1][0].where).toMatchObject({ workspaceId: 'ws-1', cnpj: CNPJ_A });
    });

    it('CNPJ anterior sem certificado guardado: erro claro (não finge que cancelou)', async () => {
      prisma.workspaceLegalEntity.findFirst
        .mockResolvedValueOnce(entity({ id: 'le-2', cnpj: CNPJ_B }))
        .mockResolvedValueOnce(entity({ validTo: new Date() }));
      await expect(service.archivedFiscalCredentials('ws-1', CNPJ_A)).rejects.toThrow(/manualmente/);
    });
  });

  describe('tipos', () => {
    it('asSnapshot ignora lixo e legalName junta razão social e nome fantasia', () => {
      expect(asSnapshot(null)).toBeNull();
      expect(asSnapshot([1])).toBeNull();
      const s = asSnapshot({ cnpj: CNPJ_A, razaoSocial: 'Empresa Ltda', nomeFantasia: 'Estou em Casa', capturedAt: 'x' });
      expect(legalName(s)).toBe('Empresa Ltda (Estou em Casa)');
      expect(legalName({ ...s!, nomeFantasia: null })).toBe('Empresa Ltda');
    });
  });
});
