// Dados legais da empresa (emitente) e seu histórico.
//
// - Fonte oficial: WorkspaceLegalEntity (um registro vigente por imobiliária).
//   Os campos antigos (workspaces.cnpj/name/address e tax_configs.cnpj/
//   razaoSocial/inscricaoMunicipal/regime) continuam existindo e são mantidos
//   em sincronia por este serviço, para não quebrar telas e integrações.
// - getCurrentSnapshot(): o ÚNICO ponto que produz a cópia (IssuerSnapshot)
//   gravada em cada documento na emissão.
// - changeIdentity(): trocar CNPJ ou razão social nunca sobrescreve: encerra
//   o registro vigente e cria outro, arquivando as credenciais presas ao CNPJ
//   antigo (certificado e numeração da NFS-e; contas de gateway ficam
//   vinculadas ao registro antigo).
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WorkspaceLegalEntity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { validCnpj } from '../erp/fiscal/dimob.validate';
import { asSnapshot, IssuerSnapshot, onlyDigits } from './issuer.types';

export type FreezableModel = 'contract' | 'signatureEnvelope' | 'nfseRecord' | 'boleto' | 'commission' | 'proposal';

type Db = PrismaService | Prisma.TransactionClient;

export interface ChangeIdentityInput {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  inscricaoMunicipal?: string | null;
  endereco?: string | null;
  regimeTributario?: string | null;
  validFrom: string; // AAAA-MM-DD — início da nova vigência
}

export interface DetailsInput {
  cnpj?: string | null;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  inscricaoMunicipal?: string | null;
  endereco?: string | null;
  regimeTributario?: string | null;
}

export interface ChecklistItem {
  key: string;
  label: string;
  help: string;
  done: boolean;
  auto: boolean; // conferido pelo sistema (true) ou marcado à mão (false)
}

const MANUAL_ITEMS: Array<Omit<ChecklistItem, 'done' | 'auto'>> = [
  { key: 'bankAccounts', label: 'Contas bancárias', help: 'Abra/atualize as contas no nome do novo CNPJ em Financeiro → Bancário e desative as antigas quando não forem mais usadas.' },
  { key: 'whatsapp', label: 'WhatsApp Business', help: 'Confirme com a Meta se o número continua verificado para a nova empresa e atualize a configuração do WhatsApp.' },
  { key: 'contractTemplates', label: 'Modelos de contrato', help: 'Revise os modelos e textos-padrão que citam a empresa. Contratos já emitidos continuam com os dados antigos.' },
];

const toDate = (ymd: string) => new Date(`${ymd}T00:00:00.000-03:00`); // meia-noite em Brasília

@Injectable()
export class IssuerService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  // ── leitura ───────────────────────────────────────────────

  /** Registro vigente; cria a partir do cadastro atual se ainda não existir (ex.: imobiliária nova). */
  async getCurrent(workspaceId: string, db: Db = this.prisma): Promise<WorkspaceLegalEntity> {
    const found = await db.workspaceLegalEntity.findFirst({ where: { workspaceId, validTo: null, deletedAt: null } });
    if (found) return found;
    const [ws, tax] = await Promise.all([
      db.workspace.findFirst({ where: { id: workspaceId }, select: { name: true, cnpj: true, address: true, createdAt: true } }),
      db.taxConfig.findFirst({ where: { workspaceId }, select: { cnpj: true, razaoSocial: true, inscricaoMunicipal: true, regime: true } }),
    ]);
    if (!ws) throw new NotFoundException('Imobiliária não encontrada.');
    try {
      return await db.workspaceLegalEntity.create({
        data: {
          workspaceId,
          cnpj: onlyDigits(tax?.cnpj || ws.cnpj) || null,
          razaoSocial: tax?.razaoSocial || null,
          nomeFantasia: ws.name,
          inscricaoMunicipal: tax?.inscricaoMunicipal || null,
          endereco: ws.address || null,
          regimeTributario: tax?.regime ?? null,
          validFrom: ws.createdAt,
        },
      });
    } catch (e) {
      // corrida: outra requisição criou o vigente ao mesmo tempo (índice único parcial)
      const again = await db.workspaceLegalEntity.findFirst({ where: { workspaceId, validTo: null, deletedAt: null } });
      if (again) return again;
      throw e;
    }
  }

  snapshotOf(e: WorkspaceLegalEntity, capturedAt = new Date()): IssuerSnapshot {
    return {
      cnpj: e.cnpj, razaoSocial: e.razaoSocial, nomeFantasia: e.nomeFantasia,
      inscricaoMunicipal: e.inscricaoMunicipal, endereco: e.endereco, regimeTributario: e.regimeTributario,
      capturedAt: capturedAt.toISOString(), legalEntityId: e.id,
    };
  }

  /** A cópia que todo documento grava na emissão. */
  async getCurrentSnapshot(workspaceId: string, db: Db = this.prisma): Promise<IssuerSnapshot> {
    return this.snapshotOf(await this.getCurrent(workspaceId, db));
  }

  /**
   * Grava a cópia dos dados da empresa num documento que ainda não tem
   * (só preenche NULL: depois de gravada, o banco não deixa mudar).
   * Devolve a cópia que ficou valendo.
   */
  async freeze(model: FreezableModel, workspaceId: string, id: string, db: Db = this.prisma): Promise<IssuerSnapshot> {
    const snap = await this.getCurrentSnapshot(workspaceId, db);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (db as any)[model];
    await delegate.updateMany({
      where: { id, workspaceId, issuerSnapshot: { equals: Prisma.DbNull } },
      data: { issuerSnapshot: snap as unknown as Prisma.InputJsonValue },
    });
    const row = await delegate.findFirst({ where: { id, workspaceId }, select: { issuerSnapshot: true } });
    return asSnapshot(row?.issuerSnapshot) ?? snap;
  }

  /** Registro vigente numa data (usado pela DIMOB: cada operação no CNPJ da sua data). */
  async getAt(workspaceId: string, date: Date, db: Db = this.prisma): Promise<WorkspaceLegalEntity> {
    const at = await db.workspaceLegalEntity.findFirst({
      where: { workspaceId, deletedAt: null, validFrom: { lte: date }, OR: [{ validTo: null }, { validTo: { gt: date } }] },
      orderBy: { validFrom: 'desc' },
    });
    if (at) return at;
    // data anterior ao primeiro registro: vale o mais antigo
    const first = await db.workspaceLegalEntity.findFirst({ where: { workspaceId, deletedAt: null }, orderBy: { validFrom: 'asc' } });
    return first ?? this.getCurrent(workspaceId, db);
  }

  async history(workspaceId: string) {
    await this.getCurrent(workspaceId);
    const list = await this.prisma.workspaceLegalEntity.findMany({
      where: { workspaceId, deletedAt: null }, orderBy: { validFrom: 'desc' },
    });
    // nunca devolve credenciais arquivadas
    return list.map(({ nfseCertPfxEnc, nfseCertPasswordEnc, ...e }) => ({ ...e, hasArchivedCertificate: !!nfseCertPfxEnc && !!nfseCertPasswordEnc }));
  }

  /** CNPJs (registros) vigentes em algum momento de um ano-calendário — para a DIMOB. */
  async entitiesInYear(workspaceId: string, year: number) {
    const start = toDate(`${year}-01-01`);
    const end = toDate(`${year + 1}-01-01`);
    const list = await this.prisma.workspaceLegalEntity.findMany({
      where: { workspaceId, deletedAt: null, validFrom: { lt: end }, OR: [{ validTo: null }, { validTo: { gt: start } }] },
      orderBy: { validFrom: 'asc' },
      select: { id: true, cnpj: true, razaoSocial: true, nomeFantasia: true, validFrom: true, validTo: true },
    });
    return list.map((e) => ({
      ...e,
      periodFrom: e.validFrom > start ? e.validFrom : start,
      periodTo: e.validTo && e.validTo < end ? e.validTo : end,
    }));
  }

  // ── escrita ───────────────────────────────────────────────

  /**
   * Edição dos dados que NÃO mudam a identidade (nome fantasia, endereço,
   * inscrição municipal, regime). CNPJ e razão social só podem ser
   * preenchidos quando estão vazios; trocar exige changeIdentity().
   * Chamado pelas telas antigas (Workspace e Configuração fiscal).
   */
  async updateDetails(workspaceId: string, userId: string | undefined, input: DetailsInput) {
    const cur = await this.getCurrent(workspaceId);
    const data: Prisma.WorkspaceLegalEntityUpdateInput = {};
    const norm = (v: string | null | undefined) => (v === undefined ? undefined : (v ?? '').trim() || null);
    if (input.cnpj !== undefined) {
      const d = onlyDigits(input.cnpj) || null;
      if (cur.cnpj && d !== cur.cnpj) {
        throw new BadRequestException('Para trocar o CNPJ use Configurações → Workspace → Dados da empresa → "Trocar CNPJ ou razão social". Assim os documentos já emitidos continuam com o CNPJ antigo.');
      }
      if (!cur.cnpj && d) {
        if (!validCnpj(d)) throw new BadRequestException('CNPJ inválido.');
        data.cnpj = d;
      }
    }
    if (input.razaoSocial !== undefined) {
      const r = norm(input.razaoSocial);
      if (cur.razaoSocial && r !== cur.razaoSocial) {
        throw new BadRequestException('Para trocar a razão social use Configurações → Workspace → Dados da empresa → "Trocar CNPJ ou razão social".');
      }
      if (!cur.razaoSocial && r) data.razaoSocial = r;
    }
    for (const k of ['nomeFantasia', 'inscricaoMunicipal', 'endereco', 'regimeTributario'] as const) {
      const v = norm(input[k]);
      if (v !== undefined && v !== cur[k]) data[k] = v;
    }
    if (!Object.keys(data).length) return cur;
    const updated = await this.prisma.workspaceLegalEntity.update({ where: { id: cur.id }, data });
    await this.audit.log({
      workspaceId, userId, action: 'LEGAL_ENTITY_UPDATED', entity: 'WorkspaceLegalEntity', entityId: cur.id,
      before: Object.fromEntries(Object.keys(data).map((k) => [k, cur[k as keyof WorkspaceLegalEntity]])) as Prisma.InputJsonValue,
      after: data as Prisma.InputJsonValue,
    });
    return updated;
  }

  /** Troca de CNPJ e/ou razão social: encerra o vigente e cria um novo a partir de validFrom. */
  async changeIdentity(workspaceId: string, userId: string, input: ChangeIdentityInput) {
    const cnpj = onlyDigits(input.cnpj);
    const razaoSocial = (input.razaoSocial ?? '').trim();
    if (!validCnpj(cnpj)) throw new BadRequestException('CNPJ inválido.');
    if (razaoSocial.length < 3) throw new BadRequestException('Informe a razão social.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.validFrom ?? '')) throw new BadRequestException('Informe a data de início (AAAA-MM-DD).');
    const validFrom = toDate(input.validFrom);
    if (validFrom.getTime() > Date.now()) throw new BadRequestException('A data de início não pode ser no futuro: faça a troca no dia em que ela passa a valer.');

    return this.prisma.$transaction(async (tx) => {
      const cur = await this.getCurrent(workspaceId, tx);
      const cnpjChanged = cnpj !== (cur.cnpj ?? '');
      if (!cnpjChanged && razaoSocial === (cur.razaoSocial ?? '')) {
        throw new BadRequestException('CNPJ e razão social são iguais aos atuais: não há o que trocar.');
      }
      if (validFrom <= cur.validFrom) {
        throw new BadRequestException(`A data de início precisa ser depois de ${cur.validFrom.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}, início do registro atual.`);
      }
      const dup = cnpjChanged && await tx.workspaceLegalEntity.findFirst({ where: { workspaceId, cnpj, deletedAt: null }, select: { id: true } });
      if (dup) throw new BadRequestException('Esse CNPJ já foi usado antes nesta imobiliária. Fale com o suporte para reativar o registro antigo.');

      const tax = await tx.taxConfig.findFirst({ where: { workspaceId } });

      // 1) encerra o vigente e arquiva o que é preso ao CNPJ antigo
      const archived = await tx.workspaceLegalEntity.update({
        where: { id: cur.id },
        data: {
          validTo: validFrom,
          ...(cnpjChanged && tax && {
            nfseCertPfxEnc: tax.certPfxEnc, nfseCertPasswordEnc: tax.certPasswordEnc,
            nfseCertSubject: tax.certSubject, nfseCertValidUntil: tax.certValidUntil,
            nfseRpsSerie: tax.rpsSerie, nfseRpsNextNumber: tax.rpsNextNumber,
          }),
        },
      });
      // contas de gateway sem dono passam a pertencer ao registro encerrado
      await tx.paymentGatewayConfig.updateMany({ where: { workspaceId, legalEntityId: null }, data: { legalEntityId: cur.id } });

      // 2) novo registro vigente
      const created = await tx.workspaceLegalEntity.create({
        data: {
          workspaceId, cnpj, razaoSocial,
          nomeFantasia: (input.nomeFantasia ?? '').trim() || cur.nomeFantasia,
          // inscrição municipal é do CNPJ: só herda se o CNPJ não mudou
          inscricaoMunicipal: (input.inscricaoMunicipal ?? '').trim() || (cnpjChanged ? null : cur.inscricaoMunicipal),
          endereco: (input.endereco ?? '').trim() || cur.endereco,
          regimeTributario: (input.regimeTributario ?? '').trim() || cur.regimeTributario,
          validFrom, createdBy: userId,
        },
      });

      // 3) sincroniza os campos antigos (telas e integrações que ainda os leem)
      await tx.workspace.update({
        where: { id: workspaceId },
        data: { cnpj, ...(created.nomeFantasia && { name: created.nomeFantasia }), address: created.endereco },
      });
      if (tax) {
        await tx.taxConfig.update({
          where: { workspaceId },
          data: {
            cnpj, razaoSocial, inscricaoMunicipal: created.inscricaoMunicipal, ...(created.regimeTributario && { regime: created.regimeTributario }),
            // certificado e autorização de produção eram do CNPJ antigo (ficam arquivados)
            ...(cnpjChanged && {
              certPfxEnc: null, certPasswordEnc: null, certSubject: null, certValidUntil: null,
              nfseEnvironment: 'HOMOLOG', productionAuthorizedAt: null, productionAuthorizedById: null,
            }),
          },
        });
      }

      await this.audit.log({
        workspaceId, userId, action: cnpjChanged ? 'LEGAL_ENTITY_CNPJ_CHANGED' : 'LEGAL_ENTITY_NAME_CHANGED',
        entity: 'WorkspaceLegalEntity', entityId: created.id,
        before: { id: archived.id, cnpj: cur.cnpj, razaoSocial: cur.razaoSocial, validFrom: cur.validFrom, validTo: validFrom },
        after: { id: created.id, cnpj, razaoSocial, validFrom, certificadoArquivado: cnpjChanged && !!tax?.certPfxEnc },
      });
      return { previous: archived, current: created, cnpjChanged };
    });
  }

  // ── checklist pós-troca de CNPJ ───────────────────────────

  async checklist(workspaceId: string): Promise<{ applies: boolean; previousCnpj: string | null; items: ChecklistItem[] }> {
    const cur = await this.getCurrent(workspaceId);
    const prev = await this.prisma.workspaceLegalEntity.findFirst({
      where: { workspaceId, deletedAt: null, validTo: { not: null } }, orderBy: { validFrom: 'desc' },
    });
    const applies = !!prev && !!prev.cnpj && prev.cnpj !== cur.cnpj;
    if (!applies) return { applies: false, previousCnpj: null, items: [] };
    const [gw, tax, wa] = await Promise.all([
      this.prisma.paymentGatewayConfig.findFirst({ where: { workspaceId, legalEntityId: cur.id, isActive: true, deletedAt: null }, select: { isDefault: true } }),
      this.prisma.taxConfig.findFirst({ where: { workspaceId }, select: { certPfxEnc: true, certSubject: true, inscricaoMunicipal: true } }),
      this.prisma.whatsAppConfig.findFirst({ where: { workspaceId }, select: { id: true } }),
    ]);
    const marks = (cur.checklist ?? {}) as Record<string, string>;
    const items: ChecklistItem[] = [
      { key: 'gateway', label: 'Conta de cobrança (Asaas) do novo CNPJ', help: 'Em Financeiro → Boletos e PIX, cadastre a conta Asaas aberta no novo CNPJ e deixe-a como padrão. A conta antiga continua guardada para baixar e cancelar as cobranças já emitidas nela.', done: !!gw?.isDefault, auto: true },
      { key: 'certificate', label: 'Certificado digital do novo CNPJ', help: 'Em Notas Fiscais → Configuração fiscal, instale o certificado A1 do novo CNPJ. O antigo fica guardado para cancelar notas antigas.', done: !!tax?.certPfxEnc && onlyDigits(tax.certSubject).includes(cur.cnpj ?? '#'), auto: true },
      { key: 'nfseProvider', label: 'Prefeitura (NFS-e): inscrição municipal e numeração', help: 'Informe a inscrição municipal do novo CNPJ, confirme com a prefeitura a série e o próximo número de RPS e autorize as notas reais de novo (o ambiente voltou para homologação).', done: !!tax?.inscricaoMunicipal, auto: true },
      ...MANUAL_ITEMS.map((m) => ({ ...m, done: m.key === 'whatsapp' && !wa ? true : !!marks[m.key], auto: m.key === 'whatsapp' && !wa })),
    ];
    return { applies, previousCnpj: prev!.cnpj, items };
  }

  async setChecklistItem(workspaceId: string, userId: string, key: string, done: boolean) {
    if (!MANUAL_ITEMS.some((m) => m.key === key)) throw new BadRequestException('Item de checklist inválido.');
    const cur = await this.getCurrent(workspaceId);
    const marks = { ...((cur.checklist ?? {}) as Record<string, string>) };
    if (done) marks[key] = new Date().toISOString(); else delete marks[key];
    await this.prisma.workspaceLegalEntity.update({ where: { id: cur.id }, data: { checklist: marks } });
    await this.audit.log({ workspaceId, userId, action: 'LEGAL_ENTITY_CHECKLIST', entity: 'WorkspaceLegalEntity', entityId: cur.id, after: { key, done } });
    return this.checklist(workspaceId);
  }

  // ── credenciais por CNPJ ──────────────────────────────────

  /**
   * Credenciais fiscais para operar um documento emitido num CNPJ anterior
   * (cancelar/consultar NFS-e). Devolve null quando o CNPJ é o vigente
   * (usa-se a configuração fiscal atual).
   */
  async archivedFiscalCredentials(workspaceId: string, cnpj: string | null | undefined) {
    const d = onlyDigits(cnpj);
    if (!d) return null;
    const cur = await this.getCurrent(workspaceId);
    if (cur.cnpj === d) return null;
    const old = await this.prisma.workspaceLegalEntity.findFirst({
      where: { workspaceId, cnpj: d, deletedAt: null, validTo: { not: null } }, orderBy: { validFrom: 'desc' },
    });
    if (!old) return null;
    if (!old.nfseCertPfxEnc || !old.nfseCertPasswordEnc) {
      throw new BadRequestException(`O certificado digital do CNPJ anterior (${d}) não está guardado: a operação na prefeitura precisa ser feita manualmente no portal da SIL.`);
    }
    return { cnpj: d, inscricaoMunicipal: old.inscricaoMunicipal, certPfxEnc: old.nfseCertPfxEnc, certPasswordEnc: old.nfseCertPasswordEnc };
  }
}
