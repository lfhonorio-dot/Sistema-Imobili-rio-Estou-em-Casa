import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Tabela regressiva de IR para renda fixa (prazo total da aplicação)
function irRateByDays(days: number): number {
  if (days <= 180) return 0.225;
  if (days <= 360) return 0.20;
  if (days <= 720) return 0.175;
  return 0.15;
}

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { type?: string; broker?: string; search?: string }) {
    const [assets, dividendSums, plan] = await Promise.all([
      this.prisma.investmentAsset.findMany({
        where: {
          deletedAt: null,
          ...(query.type && { type: query.type as any }),
          ...(query.broker && { broker: query.broker }),
          ...(query.search && {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { ticker: { contains: query.search, mode: 'insensitive' } },
              { issuer: { contains: query.search, mode: 'insensitive' } },
            ],
          }),
        },
        include: {
          dividendHistory: { orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 12 },
        },
        orderBy: { currentValue: 'desc' },
      }),
      // Soma de TODOS os proventos por ativo (o include acima traz só os últimos 12)
      this.prisma.dividendHistory.groupBy({ by: ['assetId'], _sum: { totalAmount: true } }),
      this.prisma.retirementPlan.findFirst(),
    ]);

    const dividendsByAsset: Record<string, number> = {};
    for (const d of dividendSums) dividendsByAsset[d.assetId] = Number(d._sum.totalAmount || 0);

    const expectedIpca = Number(plan?.expectedIpca ?? 4.5);
    const expectedCdi = Number(plan?.expectedCdi ?? 10.5);
    const now = Date.now();

    return assets.map(a => {
      const invested = Number(a.investedAmount);
      const current = Number(a.currentValue);
      const totalDividends = dividendsByAsset[a.id] || 0;

      // Retorno TOTAL: valorização + proventos recebidos
      const totalReturnPct = invested > 0 ? ((current + totalDividends - invested) / invested) * 100 : null;

      // Anualização pelo tempo de carteira (só a partir de 6 meses, para não distorcer)
      const startDate = a.applicationDate || a.createdAt;
      const years = (now - new Date(startDate).getTime()) / (365.25 * 86400000);
      const annualizedReturnPct = totalReturnPct !== null && years >= 0.5
        ? (Math.pow((current + totalDividends) / invested, 1 / years) - 1) * 100
        : null;

      // Taxa líquida equivalente (renda fixa): rendimento nominal esperado após IR,
      // permitindo comparar isentos (LCA/LCI) com tributados (CDB) na mesma régua
      let grossAnnualRate: number | null = null;
      let netAnnualRate: number | null = null;
      if (a.type === 'RENDA_FIXA' && a.rate !== null) {
        const rate = Number(a.rate);
        switch (a.indexer) {
          case 'PREFIXADO': grossAnnualRate = rate; break;
          case 'IPCA': case 'IGPM': grossAnnualRate = expectedIpca + rate; break;
          // CDI/SELIC: taxa > 20 é lida como "% do CDI" (ex.: 110); senão, "CDI + x%"
          case 'CDI': case 'SELIC':
            grossAnnualRate = rate > 20 ? (expectedCdi * rate) / 100 : expectedCdi + rate;
            break;
          default: grossAnnualRate = rate;
        }
        if (a.isIRExempt) {
          netAnnualRate = grossAnnualRate;
        } else {
          const termDays = a.applicationDate && a.maturityDate
            ? (new Date(a.maturityDate).getTime() - new Date(a.applicationDate).getTime()) / 86400000
            : 721; // sem datas, assume alíquota mínima de 15%
          netAnnualRate = grossAnnualRate * (1 - irRateByDays(termDays));
        }
      }

      return {
        ...a,
        totalDividends,
        totalReturnPct: totalReturnPct !== null ? Number(totalReturnPct.toFixed(2)) : null,
        annualizedReturnPct: annualizedReturnPct !== null ? Number(annualizedReturnPct.toFixed(2)) : null,
        holdingYears: Number(years.toFixed(2)),
        grossAnnualRate: grossAnnualRate !== null ? Number(grossAnnualRate.toFixed(2)) : null,
        netAnnualRate: netAnnualRate !== null ? Number(netAnnualRate.toFixed(2)) : null,
      };
    });
  }

  async getSummary() {
    const assets = await this.prisma.investmentAsset.findMany({ where: { deletedAt: null } });
    const byType: Record<string, number> = {};
    let total = 0;
    for (const a of assets) {
      const v = Number(a.currentValue);
      byType[a.type] = (byType[a.type] || 0) + v;
      total += v;
    }
    return { total, byType };
  }

  async findOne(id: string) {
    const asset = await this.prisma.investmentAsset.findFirst({
      where: { id, deletedAt: null },
      include: { dividendHistory: { orderBy: [{ year: 'desc' }, { month: 'desc' }] } },
    });
    if (!asset) throw new NotFoundException('Ativo não encontrado');
    return asset;
  }

  async create(data: any) {
    const { dividendHistory, valueReferenceDate, ...rest } = data;
    const asset = await this.prisma.investmentAsset.create({ data: rest });
    await this.prisma.assetValueHistory.create({
      data: {
        assetId: asset.id,
        currentValue: asset.currentValue,
        referenceDate: valueReferenceDate ? new Date(valueReferenceDate) : new Date(),
      },
    });
    return asset;
  }

  async update(id: string, data: any) {
    const existing = await this.findOne(id);
    // Remove campos calculados (retorno total, taxa líquida etc.) que o findAll()
    // anexa a cada ativo mas não existem na tabela — nunca devem ser persistidos.
    const {
      dividendHistory, id: _id, createdAt, updatedAt, deletedAt,
      totalDividends, totalReturnPct, annualizedReturnPct, holdingYears,
      grossAnnualRate, netAnnualRate, valueReferenceDate,
      ...rest
    } = data;
    const updated = await this.prisma.investmentAsset.update({ where: { id }, data: rest });
    // Valor mudou => registra no histórico com a data de referência informada
    // (mês/ano dos dados sendo atualizados). O valor anterior fica preservado.
    if (rest.currentValue !== undefined && Number(rest.currentValue) !== Number(existing.currentValue)) {
      await this.prisma.assetValueHistory.create({
        data: {
          assetId: id,
          currentValue: rest.currentValue,
          referenceDate: valueReferenceDate ? new Date(valueReferenceDate) : new Date(),
        },
      });
    }
    return updated;
  }

  async getValueHistory(id: string) {
    await this.findOne(id);
    return this.prisma.assetValueHistory.findMany({
      where: { assetId: id },
      orderBy: { referenceDate: 'asc' },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.investmentAsset.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async addDividend(assetId: string, data: { month: number; year: number; amount: number; totalAmount: number }) {
    return this.prisma.dividendHistory.upsert({
      where: { assetId_year_month: { assetId, year: Number(data.year), month: Number(data.month) } },
      create: { assetId, month: Number(data.month), year: Number(data.year), amount: data.amount, totalAmount: data.totalAmount },
      update: { amount: data.amount, totalAmount: data.totalAmount },
    });
  }

  async getDividends(assetId: string) {
    return this.prisma.dividendHistory.findMany({
      where: { assetId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }
}
