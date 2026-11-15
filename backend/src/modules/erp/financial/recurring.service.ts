// Fase 5 — recorrência mensal REAL.
//
// Uma recorrência (ex.: aluguel do escritório, dia 10, R$ 2.500) gera um
// lançamento por competência (AAAA-MM). A rotina diária (06h) gera os meses
// que faltam até o mês seguinte ao atual; ao criar, já gera na hora. Nunca
// duplica: antes de criar, confere se a competência já existe para a
// recorrência (e a transação trava a recorrência).

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialConfigService } from './financial-config.service';
import { dueDateFor, pendingCompetences } from './settlement-math';

export interface RecurringInput {
  type: string;
  category: string;
  description: string;
  amount: number;
  dayOfMonth: number;
  startDate: string;
  endDate?: string | null;
  contactId?: string;
  supplierId?: string;
  costCenterId?: string;
  propertyId?: string;
  notes?: string;
}

@Injectable()
export class RecurringService {
  private readonly logger = new Logger(RecurringService.name);

  constructor(
    private prisma: PrismaService,
    private config: FinancialConfigService,
  ) {}

  private async validate(workspaceId: string, dto: Partial<RecurringInput>) {
    if (dto.type && dto.category) await this.config.assertCategory(workspaceId, dto.type, dto.category);
    if (dto.costCenterId) await this.config.assertCostCenter(workspaceId, dto.costCenterId);
    if (dto.amount !== undefined && !(dto.amount > 0)) throw new BadRequestException('Informe um valor maior que zero.');
    if (dto.dayOfMonth !== undefined && (dto.dayOfMonth < 1 || dto.dayOfMonth > 28)) {
      throw new BadRequestException('O dia do vencimento deve ser de 1 a 28 (vale para todos os meses).');
    }
    if (dto.contactId && !(await this.prisma.contact.findFirst({ where: { id: dto.contactId, workspaceId, deletedAt: null }, select: { id: true } }))) {
      throw new BadRequestException('Contato não encontrado neste workspace.');
    }
    if (dto.supplierId && !(await this.prisma.supplier.findFirst({ where: { id: dto.supplierId, workspaceId, deletedAt: null }, select: { id: true } }))) {
      throw new BadRequestException('Fornecedor não encontrado neste workspace.');
    }
    if (dto.propertyId && !(await this.prisma.property.findFirst({ where: { id: dto.propertyId, workspaceId, deletedAt: null }, select: { id: true } }))) {
      throw new BadRequestException('Imóvel não encontrado neste workspace.');
    }
    if (dto.startDate && dto.endDate && new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException('A data final não pode ser antes do início.');
    }
  }

  async list(workspaceId: string) {
    const items = await this.prisma.recurringEntry.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: [{ isActive: 'desc' }, { description: 'asc' }],
    });
    const counts = await this.prisma.financialEntry.groupBy({
      by: ['recurrenceId'],
      where: { workspaceId, deletedAt: null, recurrenceId: { in: items.map((i) => i.id) } },
      _count: true,
    });
    const byId = new Map(counts.map((c) => [c.recurrenceId, c._count]));
    return items.map((i) => ({ ...i, generated: byId.get(i.id) ?? 0 }));
  }

  async create(workspaceId: string, dto: RecurringInput, userId?: string) {
    if (!['RECEIVABLE', 'PAYABLE'].includes(dto.type)) throw new BadRequestException('Tipo inválido.');
    if (!dto.description?.trim()) throw new BadRequestException('Informe a descrição.');
    await this.validate(workspaceId, dto);
    const rec = await this.prisma.recurringEntry.create({
      data: {
        workspaceId, type: dto.type, category: dto.category, description: dto.description.trim(),
        amount: dto.amount, dayOfMonth: dto.dayOfMonth,
        startDate: new Date(dto.startDate), endDate: dto.endDate ? new Date(dto.endDate) : null,
        contactId: dto.contactId, supplierId: dto.supplierId, costCenterId: dto.costCenterId,
        propertyId: dto.propertyId, notes: dto.notes, createdById: userId,
      },
    });
    const generated = await this.generateFor(rec.id);
    return { ...rec, generatedNow: generated };
  }

  /** Alterações valem para os próximos meses; lançamentos já gerados não mudam. */
  async update(workspaceId: string, id: string, dto: Partial<RecurringInput> & { isActive?: boolean }) {
    const rec = await this.prisma.recurringEntry.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!rec) throw new NotFoundException('Recorrência não encontrada.');
    await this.validate(workspaceId, { ...dto, type: rec.type, category: dto.category ?? undefined });
    const updated = await this.prisma.recurringEntry.update({
      where: { id },
      data: {
        ...(dto.description && { description: dto.description.trim() }),
        ...(dto.category && { category: dto.category }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.dayOfMonth !== undefined && { dayOfMonth: dto.dayOfMonth }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate ? new Date(dto.endDate) : null }),
        ...(dto.costCenterId !== undefined && { costCenterId: dto.costCenterId || null }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    if (updated.isActive) await this.generateFor(id);
    return updated;
  }

  /** Encerra (soft delete). Lançamentos já gerados continuam; os em aberto podem ser cancelados um a um. */
  async remove(workspaceId: string, id: string) {
    const rec = await this.prisma.recurringEntry.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!rec) throw new NotFoundException('Recorrência não encontrada.');
    await this.prisma.recurringEntry.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    return { removed: true };
  }

  /** Gera as competências que faltam (até o mês seguinte ao atual). Devolve quantas criou. */
  async generateFor(recurrenceId: string, now = new Date()): Promise<number> {
    const horizon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "recurring_entries" WHERE id = ${recurrenceId} FOR UPDATE`;
      const rec = await tx.recurringEntry.findUnique({ where: { id: recurrenceId } });
      if (!rec || !rec.isActive || rec.deletedAt) return 0;
      const existing = await tx.financialEntry.findMany({
        where: { recurrenceId, competence: { not: null } }, select: { competence: true },
      });
      const comps = pendingCompetences(rec.startDate, rec.endDate, new Set(existing.map((e) => e.competence as string)), horizon);
      // não gera meses anteriores ao início real (vencimento antes da data de início)
      const toCreate = comps.filter((c) => dueDateFor(c, rec.dayOfMonth) >= new Date(Date.UTC(rec.startDate.getUTCFullYear(), rec.startDate.getUTCMonth(), rec.startDate.getUTCDate())));
      for (const comp of toCreate) {
        const [y, m] = comp.split('-');
        await tx.financialEntry.create({
          data: {
            workspaceId: rec.workspaceId, type: rec.type, category: rec.category,
            description: `${rec.description} — ${m}/${y}`,
            amount: rec.amount, dueDate: dueDateFor(comp, rec.dayOfMonth), status: 'PENDING',
            contactId: rec.contactId, supplierId: rec.supplierId, costCenterId: rec.costCenterId,
            propertyId: rec.propertyId, notes: rec.notes, recurrenceId: rec.id, competence: comp,
          },
        });
      }
      const last = comps[comps.length - 1];
      if (last) await tx.recurringEntry.update({ where: { id: rec.id }, data: { lastCompetence: last } });
      return toCreate.length;
    });
  }

  @Cron('0 6 * * *', { name: 'financial-recurrence', timeZone: 'America/Sao_Paulo' })
  async runDaily() {
    const recs = await this.prisma.recurringEntry.findMany({ where: { isActive: true, deletedAt: null }, select: { id: true } });
    let created = 0;
    for (const r of recs) {
      try {
        created += await this.generateFor(r.id);
      } catch (e) {
        this.logger.error(`Recorrência ${r.id} falhou: ${(e as Error).message}`);
      }
    }
    if (created) this.logger.log(`Recorrências: ${created} lançamento(s) gerado(s).`);
    return { recurrences: recs.length, created };
  }
}
