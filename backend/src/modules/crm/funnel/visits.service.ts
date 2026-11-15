// Fase 3 — visitas. Cada visita cria uma atividade do tipo VISIT (aparece em
// Tarefas e no calendário, no nome do corretor que acompanha) e, quando
// ligada a um negócio, avança o funil (agendada → realizada).

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { advanceDealToStage } from '../pipelines/funnel-stages';
import { visitsOverlap } from './funnel-rules';
import { CancelVisitDto, CompleteVisitDto, CreateVisitDto, RescheduleVisitDto, VisitQueryDto } from './funnel.dto';
import { brokerMemberId, dealScope, visitScope } from '../../../common/access/access';

const INTEREST_LABEL: Record<string, string> = { HIGH: 'alto', MEDIUM: 'médio', LOW: 'baixo', NONE: 'nenhum' };

const VISIT_INCLUDE = {
  contact: { select: { id: true, name: true, phone: true } },
  property: { select: { id: true, code: true, street: true, number: true, neighborhood: true, city: true } },
  deal: { select: { id: true, title: true } },
} satisfies Prisma.VisitInclude;

@Injectable()
export class VisitsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private async me(workspaceId: string, userId: string) {
    return this.prisma.workspaceUser.findFirst({ where: { workspaceId, userId }, select: { id: true, userId: true } });
  }

  private async attachBrokers<T extends { brokerId: string | null }>(workspaceId: string, items: T[]) {
    const ids = [...new Set(items.map((i) => i.brokerId).filter((v): v is string => !!v))];
    const members = ids.length
      ? await this.prisma.workspaceUser.findMany({
          where: { workspaceId, id: { in: ids } },
          select: { id: true, user: { select: { name: true } } },
        })
      : [];
    const byId = new Map(members.map((m) => [m.id, { id: m.id, name: m.user.name }]));
    return items.map((i) => ({ ...i, broker: i.brokerId ? byId.get(i.brokerId) ?? null : null }));
  }

  async list(workspaceId: string, userId: string, q: VisitQueryDto) {
    let brokerId: string | undefined;
    if (q.mine === 'true') brokerId = (await this.me(workspaceId, userId))?.id ?? '__nenhum__';
    const items = await this.prisma.visit.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(q.status && { status: q.status }),
        ...(q.dealId && { dealId: q.dealId }),
        ...(q.propertyId && { propertyId: q.propertyId }),
        ...(q.contactId && { contactId: q.contactId }),
        ...(brokerId && { brokerId }),
        // Fase 7: Corretor só vê as visitas dele
        AND: [visitScope()],
        ...((q.from || q.to) && {
          scheduledAt: { ...(q.from && { gte: new Date(q.from) }), ...(q.to && { lte: new Date(q.to) }) },
        }),
      },
      include: VISIT_INCLUDE,
      orderBy: { scheduledAt: 'asc' },
      take: 500,
    });
    return this.attachBrokers(workspaceId, items);
  }

  private async findOrThrow(workspaceId: string, id: string) {
    const v = await this.prisma.visit.findFirst({ where: { id, workspaceId, deletedAt: null, AND: [visitScope()] } });
    if (!v) throw new NotFoundException('Visita não encontrada.');
    return v;
  }

  private async assertNoOverlap(
    workspaceId: string, brokerId: string | null, scheduledAt: Date, durationMin: number, ignoreId?: string,
  ) {
    if (!brokerId) return;
    const dayStart = new Date(scheduledAt.getTime() - 12 * 3600_000);
    const dayEnd = new Date(scheduledAt.getTime() + 12 * 3600_000);
    const others = await this.prisma.visit.findMany({
      where: {
        workspaceId, brokerId, deletedAt: null, status: 'SCHEDULED',
        scheduledAt: { gte: dayStart, lte: dayEnd },
        ...(ignoreId && { id: { not: ignoreId } }),
      },
      select: { scheduledAt: true, durationMin: true },
    });
    const clash = others.find((o) => visitsOverlap(o, { scheduledAt, durationMin }));
    if (clash) {
      const h = clash.scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
      throw new ConflictException(`O corretor já tem uma visita marcada nesse horário (às ${h}).`);
    }
  }

  async create(workspaceId: string, userId: string, dto: CreateVisitDto) {
    let contactId = dto.contactId;
    if (dto.dealId) {
      const deal = await this.prisma.deal.findFirst({
        where: { id: dto.dealId, workspaceId, deletedAt: null, ...dealScope() },
        select: { id: true, contactId: true },
      });
      if (!deal) throw new BadRequestException('Negócio não encontrado neste workspace.');
      contactId = contactId ?? deal.contactId;
    }
    if (!contactId) throw new BadRequestException('Informe o cliente da visita.');
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, workspaceId, deletedAt: null }, select: { id: true, name: true },
    });
    if (!contact) throw new BadRequestException('Cliente não encontrado neste workspace.');
    const property = await this.prisma.property.findFirst({
      where: { id: dto.propertyId, workspaceId, deletedAt: null }, select: { id: true, code: true, status: true },
    });
    if (!property) throw new BadRequestException('Imóvel não encontrado neste workspace.');
    if (['SOLD', 'INACTIVE'].includes(property.status)) {
      throw new BadRequestException('Este imóvel está vendido ou inativo; não é possível agendar visita.');
    }

    let broker: { id: string; userId: string } | null;
    // Fase 7: Corretor agenda sempre em nome dele
    if (brokerMemberId()) {
      broker = await this.me(workspaceId, userId);
    } else if (dto.brokerId) {
      broker = await this.prisma.workspaceUser.findFirst({
        where: { id: dto.brokerId, workspaceId }, select: { id: true, userId: true },
      });
      if (!broker) throw new BadRequestException('Corretor não pertence a esta imobiliária.');
    } else {
      broker = await this.me(workspaceId, userId);
    }

    const scheduledAt = new Date(dto.scheduledAt);
    const durationMin = dto.durationMin ?? 60;
    await this.assertNoOverlap(workspaceId, broker?.id ?? null, scheduledAt, durationMin);

    const result = await this.prisma.$transaction(async (tx) => {
      const activity = await tx.activity.create({
        data: {
          workspaceId,
          type: 'VISIT',
          title: `Visita: ${property.code} — ${contact.name}`,
          content: dto.notes,
          contactId: contact.id,
          dealId: dto.dealId,
          userId: broker?.userId ?? userId,
          dueAt: scheduledAt,
          priority: 'HIGH',
        },
      });
      const visit = await tx.visit.create({
        data: {
          workspaceId,
          dealId: dto.dealId,
          contactId: contact.id,
          propertyId: property.id,
          brokerId: broker?.id,
          scheduledAt,
          durationMin,
          activityId: activity.id,
          createdById: userId,
        },
        include: VISIT_INCLUDE,
      });
      let movedTo: string | null = null;
      if (dto.dealId) {
        // garante o imóvel entre os de interesse do negócio
        const link = await tx.dealProperty.findFirst({ where: { dealId: dto.dealId, propertyId: property.id } });
        if (!link) await tx.dealProperty.create({ data: { dealId: dto.dealId, propertyId: property.id } });
        movedTo = await advanceDealToStage(tx, workspaceId, dto.dealId, 'VISIT_SCHEDULED', userId);
      }
      return { visit, movedTo };
    });
    await this.audit.log({ workspaceId, userId, action: 'VISIT_SCHEDULED', entity: 'Visit', entityId: result.visit.id });
    const [withBroker] = await this.attachBrokers(workspaceId, [result.visit]);
    return { ...withBroker, dealMovedTo: result.movedTo };
  }

  async reschedule(workspaceId: string, userId: string, id: string, dto: RescheduleVisitDto) {
    const v = await this.findOrThrow(workspaceId, id);
    if (v.status !== 'SCHEDULED') throw new BadRequestException('Só é possível reagendar visitas agendadas.');
    const scheduledAt = new Date(dto.scheduledAt);
    const durationMin = dto.durationMin ?? v.durationMin;
    await this.assertNoOverlap(workspaceId, v.brokerId, scheduledAt, durationMin, id);
    const updated = await this.prisma.$transaction(async (tx) => {
      if (v.activityId) await tx.activity.update({ where: { id: v.activityId }, data: { dueAt: scheduledAt } });
      return tx.visit.update({ where: { id }, data: { scheduledAt, durationMin }, include: VISIT_INCLUDE });
    });
    await this.audit.log({ workspaceId, userId, action: 'VISIT_RESCHEDULED', entity: 'Visit', entityId: id });
    return updated;
  }

  async complete(workspaceId: string, userId: string, id: string, dto: CompleteVisitDto) {
    const v = await this.findOrThrow(workspaceId, id);
    if (v.status !== 'SCHEDULED') throw new BadRequestException('Esta visita não está mais agendada.');
    const feedback = dto.feedback?.trim() || null;
    const result = await this.prisma.$transaction(async (tx) => {
      const visit = await tx.visit.update({
        where: { id },
        data: { status: 'DONE', interestLevel: dto.interestLevel, feedback, completedAt: new Date() },
        include: VISIT_INCLUDE,
      });
      if (v.activityId) {
        await tx.activity.update({
          where: { id: v.activityId },
          data: {
            doneAt: new Date(),
            content: `Interesse do cliente: ${INTEREST_LABEL[dto.interestLevel]}.${feedback ? `\nRetorno: ${feedback}` : ''}`,
          },
        });
      }
      const movedTo = v.dealId ? await advanceDealToStage(tx, workspaceId, v.dealId, 'VISIT_DONE', userId) : null;
      return { visit, movedTo };
    });
    await this.audit.log({ workspaceId, userId, action: 'VISIT_DONE', entity: 'Visit', entityId: id });
    return { ...result.visit, dealMovedTo: result.movedTo };
  }

  async cancel(workspaceId: string, userId: string, id: string, dto: CancelVisitDto) {
    const v = await this.findOrThrow(workspaceId, id);
    if (v.status !== 'SCHEDULED') throw new BadRequestException('Esta visita não está mais agendada.');
    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('Informe o motivo.');
    const status = dto.status ?? 'CANCELLED';
    const updated = await this.prisma.$transaction(async (tx) => {
      if (v.activityId) {
        // a tarefa some da agenda (soft delete), o motivo fica na visita
        await tx.activity.update({ where: { id: v.activityId }, data: { deletedAt: new Date() } });
      }
      return tx.visit.update({ where: { id }, data: { status, cancelReason: reason }, include: VISIT_INCLUDE });
    });
    await this.audit.log({ workspaceId, userId, action: status === 'NO_SHOW' ? 'VISIT_NO_SHOW' : 'VISIT_CANCELLED', entity: 'Visit', entityId: id });
    return updated;
  }
}
