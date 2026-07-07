// Serviço de registro de eventos DIMOB por declarante (rateio PJ/PF) e exportação.
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { computeDimobDeclarants, PartnerShareInput } from './dimob.calc';

@Injectable()
export class DimobService {
  private readonly logger = new Logger(DimobService.name);

  constructor(private prisma: PrismaService) {}

  private async loadContext(workspaceId: string, contractId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, workspaceId, deletedAt: null },
      include: {
        property: { select: { street: true, number: true, city: true, state: true } },
        owner: { select: { name: true, cpf: true, cnpj: true } },
        tenant: { select: { name: true, cpf: true, cnpj: true } },
        splitRules: {
          where: { isActive: true },
          include: { recipient: { select: { name: true, document: true, documentType: true } } },
        },
      },
    });
    if (!contract) throw new NotFoundException('Contrato não encontrado');

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, cnpj: true },
    });

    const partners: PartnerShareInput[] = (contract.splitRules ?? []).map((r: any) => ({
      name: r.recipient?.name ?? '',
      document: r.recipient?.document ?? null,
      documentType: r.recipient?.documentType ?? null,
      percentage: Number(r.value),
    }));

    return { contract, workspace, partners };
  }

  // Registra os eventos DIMOB de um contrato de VENDA ou INTERMEDIAÇÃO
  // (data do evento = contratação/assinatura, não o recebimento).
  async registerSaleEvents(workspaceId: string, contractId: string) {
    const { contract, workspace, partners } = await this.loadContext(workspaceId, contractId);
    if (contract.type !== 'SALE' && contract.type !== 'BROKERAGE') {
      return { created: 0, reason: 'not a sale/brokerage contract' };
    }
    const dimobType = contract.type === 'BROKERAGE' ? 'INTERMEDIACAO' : 'VENDA';

    const saleValue = Number(contract.saleValue ?? 0);
    const commissionTotal = contract.commissionRate
      ? (saleValue * Number(contract.commissionRate)) / 100
      : 0;
    const eventDate = contract.startDate ?? contract.createdAt;
    const year = new Date(eventDate).getFullYear();

    const declarants = computeDimobDeclarants(
      { name: workspace?.name ?? '', cnpj: workspace?.cnpj ?? null },
      partners,
      commissionTotal,
    );

    const prop = contract.property as any;
    const address = [prop?.street, prop?.number, prop?.city, prop?.state].filter(Boolean).join(', ');
    const seller = contract.owner as any;
    const buyer = contract.tenant as any;

    // Idempotência: remove registros anteriores deste contrato antes de recriar
    await this.prisma.dimobRecord.deleteMany({ where: { workspaceId, contractId } });

    let created = 0;
    for (const d of declarants) {
      await this.prisma.dimobRecord.create({
        data: {
          workspaceId,
          year,
          contractId,
          type: dimobType,
          declarantDoc: d.declarantDoc,
          declarantName: d.declarantName,
          declarantType: d.declarantType,
          participationPct: d.participationPct,
          eventDate,
          locadorDoc: (seller?.cnpj || seller?.cpf) ?? '',
          locadorName: seller?.name ?? '',
          locatarioDoc: (buyer?.cnpj || buyer?.cpf) ?? '',
          locatarioName: buyer?.name ?? '',
          propertyAddress: address,
          totalValue: saleValue,
          commissionAmount: d.commissionAmount,
        },
      });
      created++;
    }
    this.logger.log(`DIMOB venda: contrato=${contractId} declarantes=${created}`);
    return { created };
  }

  // Registra um evento DIMOB mensal de LOCAÇÃO (por pagamento de aluguel).
  async registerRentalMonthEvent(workspaceId: string, contractId: string, opts: { grossAmount: number; competenceDate: Date; taxWithheld?: number }) {
    const { contract, workspace, partners } = await this.loadContext(workspaceId, contractId);
    const commissionMonth = contract.commissionRate
      ? (opts.grossAmount * Number(contract.commissionRate)) / 100
      : 0;
    const year = opts.competenceDate.getFullYear();
    const month = opts.competenceDate.getMonth() + 1;

    const declarants = computeDimobDeclarants(
      { name: workspace?.name ?? '', cnpj: workspace?.cnpj ?? null },
      partners,
      commissionMonth,
    );

    const prop = contract.property as any;
    const address = [prop?.street, prop?.number, prop?.city, prop?.state].filter(Boolean).join(', ');
    const locador = contract.owner as any;
    const locatario = contract.tenant as any;

    // Idempotência por contrato+mês+ano
    await this.prisma.dimobRecord.deleteMany({ where: { workspaceId, contractId, year, referenceMonth: month } });

    let created = 0;
    for (const d of declarants) {
      await this.prisma.dimobRecord.create({
        data: {
          workspaceId,
          year,
          referenceMonth: month,
          contractId,
          type: 'LOCACAO',
          declarantDoc: d.declarantDoc,
          declarantName: d.declarantName,
          declarantType: d.declarantType,
          participationPct: d.participationPct,
          eventDate: opts.competenceDate,
          locadorDoc: (locador?.cnpj || locador?.cpf) ?? '',
          locadorName: locador?.name ?? '',
          locatarioDoc: (locatario?.cnpj || locatario?.cpf) ?? '',
          locatarioName: locatario?.name ?? '',
          propertyAddress: address,
          monthlyValue: opts.grossAmount,
          totalValue: opts.grossAmount,
          commissionAmount: d.commissionAmount,
        },
      });
      created++;
    }
    return { created };
  }

  // Agrega os eventos por declarante (CNPJ) e ano-calendário para exportação DIMOB.
  async exportDimob(workspaceId: string, year: number, declarantDoc?: string) {
    const records = await this.prisma.dimobRecord.findMany({
      where: { workspaceId, year, ...(declarantDoc && { declarantDoc }) },
      orderBy: [{ declarantDoc: 'asc' }, { referenceMonth: 'asc' }],
    });

    // Agrupa por declarante
    const byDeclarant: Record<string, any> = {};
    for (const r of records) {
      const key = r.declarantDoc ?? 'SEM_DECLARANTE';
      if (!byDeclarant[key]) {
        byDeclarant[key] = {
          declarantDoc: r.declarantDoc,
          declarantName: r.declarantName,
          year,
          totalOperacoes: 0,
          totalRendimentoBruto: 0,
          totalComissao: 0,
          eventos: [],
        };
      }
      const g = byDeclarant[key];
      g.totalOperacoes++;
      g.totalRendimentoBruto += Number(r.totalValue ?? 0);
      g.totalComissao += Number(r.commissionAmount ?? 0);
      g.eventos.push({
        tipo: r.type,
        mes: r.referenceMonth,
        data: r.eventDate,
        participacaoPct: r.participationPct,
        imovel: r.propertyAddress,
        parteA: { doc: r.locadorDoc, nome: r.locadorName },
        parteB: { doc: r.locatarioDoc, nome: r.locatarioName },
        valorOperacao: Number(r.totalValue ?? 0),
        comissao: Number(r.commissionAmount ?? 0),
      });
    }

    const declarantes = Object.values(byDeclarant);
    const csv = this.toCsv(declarantes as any[]);
    return { year, declarantes, csv };
  }

  private toCsv(declarantes: any[]): string {
    const header = 'declarante_doc;declarante_nome;ano;tipo;mes;participacao_pct;imovel;parteA_doc;parteA_nome;parteB_doc;parteB_nome;valor_operacao;comissao';
    const lines: string[] = [header];
    for (const d of declarantes) {
      for (const e of d.eventos) {
        lines.push([
          d.declarantDoc, d.declarantName, d.year, e.tipo, e.mes ?? '', e.participacaoPct ?? '',
          (e.imovel ?? '').replace(/;/g, ','), e.parteA.doc, (e.parteA.nome ?? '').replace(/;/g, ','),
          e.parteB.doc, (e.parteB.nome ?? '').replace(/;/g, ','), e.valorOperacao, e.comissao,
        ].join(';'));
      }
    }
    return lines.join('\n');
  }
}
