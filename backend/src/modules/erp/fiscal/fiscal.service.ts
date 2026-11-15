// Serviço Fiscal — NFS-e, DIMOB, IRRF, Carnê-Leão
import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SaveTaxConfigDto, GenerateDimobDto, GenerateCarneLeaoDto,
  DimobQueryDto, IrrfQueryDto, CarneLeaoQueryDto,
} from './fiscal.dto';

@Injectable()
export class FiscalService {
  private readonly logger = new Logger(FiscalService.name);

  constructor(private prisma: PrismaService) {}

  // ── CONFIGURAÇÃO FISCAL ───────────────────────────────────

  async getTaxConfig(workspaceId: string) {
    return this.prisma.taxConfig.findFirst({ where: { workspaceId } });
  }

  async saveTaxConfig(workspaceId: string, dto: SaveTaxConfigDto) {
    const existing = await this.prisma.taxConfig.findFirst({ where: { workspaceId } });
    const data = { ...dto };
    if (existing) {
      return this.prisma.taxConfig.update({ where: { id: existing.id }, data });
    }
    // Regime padrão da imobiliária: LUCRO PRESUMIDO (decisão do dono).
    return this.prisma.taxConfig.create({
      data: { workspaceId, ...data, regime: data.regime ?? 'LUCRO_PRESUMIDO' },
    });
  }

  // ── IRRF ──────────────────────────────────────────────────

  async findIrrf(workspaceId: string, query: IrrfQueryDto) {
    return this.prisma.irrfRecord.findMany({
      where: {
        workspaceId,
        ...(query.period && { period: query.period }),
      },
      orderBy: { period: 'desc' },
    });
  }

  async createIrrfRecord(workspaceId: string, dto: {
    period: string;
    contractId?: string;
    tenantDocument: string;
    tenantName: string;
    ownerDocument: string;
    ownerName: string;
    grossAmount: number;
    irrfRate?: number;
  }) {
    const irrfRate = dto.irrfRate ?? 11.0;
    const irrfAmount = (dto.grossAmount * irrfRate) / 100;
    const netAmount = dto.grossAmount - irrfAmount;

    return this.prisma.irrfRecord.create({
      data: {
        workspaceId,
        period: dto.period,
        contractId: dto.contractId,
        tenantDocument: dto.tenantDocument,
        tenantName: dto.tenantName,
        ownerDocument: dto.ownerDocument,
        ownerName: dto.ownerName,
        grossAmount: dto.grossAmount,
        irrfRate,
        irrfAmount,
        netAmount,
        status: 'RETAINED',
      },
    });
  }

  // ── DIMOB ─────────────────────────────────────────────────

  async findDimob(workspaceId: string, query: DimobQueryDto) {
    return this.prisma.dimobRecord.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(query.year && { year: query.year }),
      },
      orderBy: { year: 'desc' },
    });
  }

  async generateDimob(workspaceId: string, dto: GenerateDimobDto) {
    const startDate = new Date(`${dto.year}-01-01`);
    const endDate = new Date(`${dto.year + 1}-01-01`);

    // 'RENTAL' e 'INCOME' nunca existiram como valores desses enums
    // (Contract.type é RENTAL_RESIDENTIAL/RENTAL_COMMERCIAL; FinancialEntry.type
    // é RECEIVABLE/PAYABLE) — esta query sempre retornava zero contratos, mesmo
    // com aluguéis pagos reais no período.
    const contracts = await this.prisma.contract.findMany({
      where: {
        workspaceId,
        type: { in: ['RENTAL_RESIDENTIAL', 'RENTAL_COMMERCIAL'] },
        financialEntries: {
          some: {
            type: 'RECEIVABLE', status: 'PAID',
            paidAt: { gte: startDate, lt: endDate },
          },
        },
      },
      include: {
        tenant: true,
        property: true,
        owner: true,
        financialEntries: {
          where: { type: 'RECEIVABLE', status: 'PAID', paidAt: { gte: startDate, lt: endDate } },
        },
      },
    });

    const records = [];
    for (const contract of contracts) {
      const totalValue = contract.financialEntries.reduce((s, e) => s + Number(e.amount), 0);
      const existing = await this.prisma.dimobRecord.findFirst({
        where: { workspaceId, year: dto.year, contractId: contract.id, deletedAt: null },
      });

      const prop = contract.property as Record<string, unknown>;
      const data = {
        year: dto.year,
        contractId: contract.id,
        type: 'LOCACAO',
        locadorDoc: (contract.owner as Record<string, unknown>)?.cpf as string ?? '',
        locadorName: contract.owner?.name ?? '',
        locatarioDoc: (contract.tenant as Record<string, unknown>)?.cpf as string ?? '',
        locatarioName: contract.tenant?.name ?? '',
        propertyAddress: prop?.address as string ?? prop?.street as string ?? '',
        startDate: contract.startDate,
        endDate: contract.endDate,
        monthlyValue: contract.rentalValue ? Number(contract.rentalValue) : null,
        totalValue,
      };

      const record = existing
        ? await this.prisma.dimobRecord.update({ where: { id: existing.id }, data })
        : await this.prisma.dimobRecord.create({ data: { workspaceId, ...data } });

      records.push(record);
    }

    this.logger.log(`DIMOB gerado: ano=${dto.year} contratos=${records.length}`);
    return { year: dto.year, records, total: records.length };
  }

  // ── CARNÊ-LEÃO ────────────────────────────────────────────

  async findCarneLeao(workspaceId: string, query: CarneLeaoQueryDto) {
    return this.prisma.carneLeaoRecord.findMany({
      where: {
        workspaceId,
        ...(query.period && { period: query.period }),
      },
      orderBy: { period: 'desc' },
    });
  }

  async calculateCarneLeao(workspaceId: string, dto: GenerateCarneLeaoDto) {
    const [year, month] = dto.period.split('-').map(Number);
    const startDate = new Date(`${year}-${String(month).padStart(2, '0')}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    // Carnê-Leão é POR PROPRIETÁRIO (pessoa física) — sem filtrar por
    // contato e por categoria de aluguel, esta consulta somava TODO o
    // recebível pago da imobiliária no mês (vendas, comissões, de todos os
    // proprietários) como se fosse renda de uma única pessoa.
    const owner = await this.prisma.contact.findFirst({
      where: { workspaceId, cpf: dto.ownerDocument, deletedAt: null },
    });

    const entries = await this.prisma.financialEntry.findMany({
      where: {
        workspaceId,
        type: 'RECEIVABLE',
        category: 'RENT',
        status: 'PAID',
        paidAt: { gte: startDate, lt: endDate },
        ...(owner ? { contactId: owner.id } : { contactId: '__no_owner_found__' }),
      },
    });

    const grossIncome = entries.reduce((s, e) => s + Number(e.amount), 0);
    const deductions = 0;
    const taxableBase = grossIncome - deductions;
    const { rate, tax } = this.calcProgressiveTax(taxableBase);
    const darfAmount = tax;

    const existing = await this.prisma.carneLeaoRecord.findFirst({
      where: { workspaceId, period: dto.period },
    });

    const data = {
      ownerDocument: dto.ownerDocument,
      ownerName: dto.ownerName,
      grossIncome,
      deductions,
      taxableBase,
      rate,
      taxDue: tax,
      darfAmount,
      status: 'CALCULATED' as const,
      calcDetails: { entriesCount: entries.length },
    };

    return existing
      ? this.prisma.carneLeaoRecord.update({ where: { id: existing.id }, data })
      : this.prisma.carneLeaoRecord.create({
          data: { workspaceId, period: dto.period, ...data },
        });
  }

  // ── HELPER ────────────────────────────────────────────────

  private calcProgressiveTax(monthlyIncome: number): { rate: number; tax: number } {
    if (monthlyIncome <= 2259.20) return { rate: 0, tax: 0 };
    if (monthlyIncome <= 2826.65) return { rate: 7.5, tax: monthlyIncome * 0.075 - 169.44 };
    if (monthlyIncome <= 3751.05) return { rate: 15, tax: monthlyIncome * 0.15 - 381.44 };
    if (monthlyIncome <= 4664.68) return { rate: 22.5, tax: monthlyIncome * 0.225 - 662.77 };
    return { rate: 27.5, tax: monthlyIncome * 0.275 - 896.00 };
  }
}
