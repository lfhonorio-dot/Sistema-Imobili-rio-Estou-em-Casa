// Fase 5 — configurações do financeiro: plano de categorias (receita e
// despesa), centros de custo e padrões de multa/juros. Tudo por workspace.

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export const DEFAULT_CATEGORIES: Array<{ type: 'RECEIVABLE' | 'PAYABLE'; code: string; name: string }> = [
  { type: 'RECEIVABLE', code: 'COMMISSION', name: 'Comissão de venda' },
  { type: 'RECEIVABLE', code: 'SALE', name: 'Venda (valor do imóvel)' },
  { type: 'RECEIVABLE', code: 'RENT', name: 'Aluguel' },
  { type: 'RECEIVABLE', code: 'ADMINISTRATION', name: 'Taxa de administração' },
  { type: 'RECEIVABLE', code: 'OTHER', name: 'Outras receitas' },
  { type: 'PAYABLE', code: 'COMMISSION', name: 'Comissão de corretores' },
  { type: 'PAYABLE', code: 'TAXES', name: 'Impostos' },
  { type: 'PAYABLE', code: 'PAYROLL', name: 'Pessoal e pró-labore' },
  { type: 'PAYABLE', code: 'RENT_OFFICE', name: 'Aluguel do escritório' },
  { type: 'PAYABLE', code: 'UTILITIES', name: 'Água, luz, internet e telefone' },
  { type: 'PAYABLE', code: 'MARKETING', name: 'Marketing e portais' },
  { type: 'PAYABLE', code: 'MAINTENANCE', name: 'Manutenção' },
  { type: 'PAYABLE', code: 'SERVICES', name: 'Serviços de terceiros (contador, advogado)' },
  { type: 'PAYABLE', code: 'BANK_FEES', name: 'Tarifas bancárias' },
  { type: 'PAYABLE', code: 'OTHER', name: 'Outras despesas' },
];

const TYPES = ['RECEIVABLE', 'PAYABLE'];

/** "Aluguel de Salas" → "ALUGUEL_DE_SALAS" (sem acentos). */
export function categoryCode(name: string): string {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

@Injectable()
export class FinancialConfigService {
  constructor(private prisma: PrismaService) {}

  /** Imobiliárias criadas depois da migration ganham o plano padrão na 1ª vez. */
  async ensureDefaults(workspaceId: string) {
    const count = await this.prisma.financialCategory.count({ where: { workspaceId } });
    if (count === 0) {
      await this.prisma.financialCategory.createMany({
        data: DEFAULT_CATEGORIES.map((c) => ({ workspaceId, ...c, isSystem: true })),
        skipDuplicates: true,
      });
    }
  }

  // ── Categorias ──────────────────────────────────────────

  async listCategories(workspaceId: string, type?: string, includeInactive = false) {
    await this.ensureDefaults(workspaceId);
    return this.prisma.financialCategory.findMany({
      where: { workspaceId, deletedAt: null, ...(type && { type }), ...(!includeInactive && { isActive: true }) },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(workspaceId: string, dto: { type: string; name: string }) {
    if (!TYPES.includes(dto.type)) throw new BadRequestException('Tipo inválido (receita ou despesa).');
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Informe o nome da categoria.');
    await this.ensureDefaults(workspaceId);
    const code = categoryCode(name);
    if (!code) throw new BadRequestException('Nome de categoria inválido.');
    const existing = await this.prisma.financialCategory.findUnique({
      where: { workspaceId_type_code: { workspaceId, type: dto.type, code } },
    });
    if (existing && !existing.deletedAt) throw new ConflictException('Já existe uma categoria com esse nome.');
    if (existing) {
      // reaproveita a categoria removida antes (mesmo código), reativando
      return this.prisma.financialCategory.update({
        where: { id: existing.id }, data: { name, deletedAt: null, isActive: true },
      });
    }
    return this.prisma.financialCategory.create({ data: { workspaceId, type: dto.type, code, name } });
  }

  async updateCategory(workspaceId: string, id: string, dto: { name?: string; isActive?: boolean }) {
    const cat = await this.prisma.financialCategory.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!cat) throw new NotFoundException('Categoria não encontrada.');
    const name = dto.name?.trim();
    return this.prisma.financialCategory.update({
      where: { id },
      data: { ...(name && { name }), ...(dto.isActive !== undefined && { isActive: dto.isActive }) },
    });
  }

  async removeCategory(workspaceId: string, id: string) {
    const cat = await this.prisma.financialCategory.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!cat) throw new NotFoundException('Categoria não encontrada.');
    if (cat.isSystem) throw new BadRequestException('Categorias padrão não podem ser removidas; você pode desativá-las.');
    await this.prisma.financialCategory.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    return { removed: true };
  }

  /** Garante que a categoria existe e está ativa para o tipo (receita/despesa). */
  async assertCategory(workspaceId: string, type: string, code: string) {
    await this.ensureDefaults(workspaceId);
    const cat = await this.prisma.financialCategory.findFirst({
      where: { workspaceId, type, code, deletedAt: null, isActive: true }, select: { id: true },
    });
    if (!cat) {
      throw new BadRequestException(
        `Categoria "${code}" não existe (ou está desativada) para ${type === 'RECEIVABLE' ? 'contas a receber' : 'contas a pagar'}.`,
      );
    }
  }

  async categoryNames(workspaceId: string): Promise<Map<string, string>> {
    const cats = await this.prisma.financialCategory.findMany({ where: { workspaceId }, select: { type: true, code: true, name: true } });
    return new Map(cats.map((c) => [`${c.type}:${c.code}`, c.name]));
  }

  // ── Centros de custo ────────────────────────────────────

  listCostCenters(workspaceId: string, includeInactive = false) {
    return this.prisma.costCenter.findMany({
      where: { workspaceId, deletedAt: null, ...(!includeInactive && { isActive: true }) },
      orderBy: { name: 'asc' },
    });
  }

  async createCostCenter(workspaceId: string, dto: { name: string }) {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Informe o nome do centro de custo.');
    const dup = await this.prisma.costCenter.findFirst({
      where: { workspaceId, deletedAt: null, name: { equals: name, mode: 'insensitive' } }, select: { id: true },
    });
    if (dup) throw new ConflictException('Já existe um centro de custo com esse nome.');
    return this.prisma.costCenter.create({ data: { workspaceId, name } });
  }

  async updateCostCenter(workspaceId: string, id: string, dto: { name?: string; isActive?: boolean }) {
    const cc = await this.prisma.costCenter.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!cc) throw new NotFoundException('Centro de custo não encontrado.');
    const name = dto.name?.trim();
    return this.prisma.costCenter.update({
      where: { id },
      data: { ...(name && { name }), ...(dto.isActive !== undefined && { isActive: dto.isActive }) },
    });
  }

  async removeCostCenter(workspaceId: string, id: string) {
    const cc = await this.prisma.costCenter.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!cc) throw new NotFoundException('Centro de custo não encontrado.');
    await this.prisma.costCenter.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    return { removed: true };
  }

  async assertCostCenter(workspaceId: string, id: string) {
    const cc = await this.prisma.costCenter.findFirst({ where: { id, workspaceId, deletedAt: null, isActive: true }, select: { id: true } });
    if (!cc) throw new BadRequestException('Centro de custo não encontrado (ou desativado) neste workspace.');
  }

  // ── Multa e juros padrão ────────────────────────────────

  async getSettings(workspaceId: string) {
    return this.prisma.workspaceFinancialSettings.upsert({
      where: { workspaceId }, create: { workspaceId }, update: {},
    });
  }

  async updateSettings(workspaceId: string, dto: { finePct?: number; interestMonthlyPct?: number }) {
    for (const [k, v] of Object.entries(dto)) {
      if (v !== undefined && (v < 0 || v > 20)) throw new BadRequestException(`Percentual inválido (${k}): use de 0 a 20.`);
    }
    return this.prisma.workspaceFinancialSettings.upsert({
      where: { workspaceId },
      create: { workspaceId, ...dto },
      update: dto,
    });
  }
}
