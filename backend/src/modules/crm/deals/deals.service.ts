// Serviço de Negócios (Deals) - lógica de negócio
// Gerencia: CRUD, kanban, movimentação de estágios, histórico

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  CreateDealDto,
  UpdateDealDto,
  MoveStageDealDto,
  DealQueryDto,
} from './deals.dto';

@Injectable()
export class DealsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // Lista negócios com filtros (kanban ou lista)
  async findAll(workspaceId: string, query: DealQueryDto) {
    const {
      page = 1,
      limit = 50,
      pipelineId,
      stageId,
      assigneeId,
      tags,
      minValue,
      maxValue,
      startDate,
      endDate,
      search,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.DealWhereInput = {
      workspaceId,
      deletedAt: null,
      ...(pipelineId && { pipelineId }),
      ...(stageId && { stageId }),
      ...(assigneeId && { assigneeId }),
      ...(tags && tags.length > 0 && { tags: { some: { tagId: { in: tags } } } }),
      ...(minValue !== undefined && { value: { gte: minValue } }),
      ...(maxValue !== undefined && { value: { lte: maxValue } }),
      ...(startDate && { createdAt: { gte: new Date(startDate) } }),
      ...(endDate && { createdAt: { lte: new Date(endDate) } }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { contact: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [deals, total] = await Promise.all([
      this.prisma.deal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          contact: { select: { id: true, name: true, email: true, phone: true } },
          stage: true,
          pipeline: { select: { id: true, name: true } },
          tags: { include: { tag: true } },
        },
      }),
      this.prisma.deal.count({ where }),
    ]);

    // Calcula indicadores quente/frio baseado na última atividade
    const now = new Date();
    const dealsWithIndicators = deals.map((deal) => ({
      ...deal,
      isHot: deal.lastActivityAt
        ? (now.getTime() - deal.lastActivityAt.getTime()) < 3 * 24 * 60 * 60 * 1000
        : false,
      isCold: !deal.lastActivityAt ||
        (now.getTime() - deal.lastActivityAt.getTime()) > 7 * 24 * 60 * 60 * 1000,
    }));

    return { items: dealsWithIndicators, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  // Busca negócio por ID com detalhes completos
  async findOne(workspaceId: string, id: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        contact: true,
        stage: true,
        pipeline: { include: { stages: { orderBy: { order: 'asc' } } } },
        tags: { include: { tag: true } },
        stageHistory: {
          include: { stage: true },
          orderBy: { movedAt: 'desc' },
        },
        activities: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        properties: true,
      },
    });

    if (!deal) throw new NotFoundException('Negócio não encontrado');

    const now = new Date();
    const isHot = deal.lastActivityAt
      ? (now.getTime() - deal.lastActivityAt.getTime()) < 3 * 24 * 60 * 60 * 1000
      : false;
    const isCold = !deal.lastActivityAt ||
      (now.getTime() - deal.lastActivityAt.getTime()) > 7 * 24 * 60 * 60 * 1000;

    return { ...deal, isHot, isCold };
  }

  // Cria novo negócio
  async create(workspaceId: string, userId: string, dto: CreateDealDto) {
    // Se stageId não foi informado, usa o primeiro estágio do pipeline
    let stageId = dto.stageId;
    if (!stageId) {
      const firstStage = await this.prisma.pipelineStage.findFirst({
        where: { pipelineId: dto.pipelineId },
        orderBy: { order: 'asc' },
      });
      if (!firstStage) throw new BadRequestException('Pipeline não tem estágios');
      stageId = firstStage.id;
    }

    const deal = await this.prisma.deal.create({
      data: {
        workspaceId,
        title: dto.title,
        value: dto.value,
        contactId: dto.contactId,
        pipelineId: dto.pipelineId,
        stageId,
        assigneeId: dto.assigneeId,
        expectedCloseAt: dto.expectedCloseAt ? new Date(dto.expectedCloseAt) : undefined,
        origin: dto.origin,
        utmSource: dto.utmSource,
        utmCampaign: dto.utmCampaign,
        utmContent: dto.utmContent,
        gclid: dto.gclid,
        customFields: (dto.customFields ?? {}) as Prisma.JsonObject,
        lastActivityAt: new Date(),
      },
    });

    // Registra histórico de estágio inicial
    await this.prisma.dealStageHistory.create({
      data: {
        dealId: deal.id,
        stageId,
        userId,
        daysInStage: 0,
      },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'DEAL_CREATED',
      entity: 'Deal',
      entityId: deal.id,
      after: deal,
    });

    return deal;
  }

  // Atualiza negócio
  async update(workspaceId: string, userId: string, id: string, dto: UpdateDealDto) {
    const existing = await this.prisma.deal.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!existing) throw new NotFoundException('Negócio não encontrado');

    const updated = await this.prisma.deal.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.value !== undefined && { value: dto.value }),
        ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
        ...(dto.expectedCloseAt !== undefined && {
          expectedCloseAt: dto.expectedCloseAt ? new Date(dto.expectedCloseAt) : null,
        }),
        ...(dto.customFields !== undefined && { customFields: dto.customFields as Prisma.JsonObject }),
      },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'DEAL_UPDATED',
      entity: 'Deal',
      entityId: id,
      before: existing,
      after: updated,
    });

    return updated;
  }

  // Move negócio para outro estágio
  async moveStage(workspaceId: string, userId: string, dealId: string, dto: MoveStageDealDto) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, workspaceId, deletedAt: null },
    });

    if (!deal) throw new NotFoundException('Negócio não encontrado');

    const targetStage = await this.prisma.pipelineStage.findFirst({
      where: { id: dto.stageId, pipeline: { workspaceId } },
    });

    if (!targetStage) throw new NotFoundException('Estágio não encontrado');

    // Exige motivo de perda se movendo para estágio de perda
    if (targetStage.isLost && !dto.lostReason) {
      throw new BadRequestException('Motivo de perda é obrigatório para estágio de perdido');
    }

    // Calcula dias no estágio atual
    const lastHistory = await this.prisma.dealStageHistory.findFirst({
      where: { dealId },
      orderBy: { movedAt: 'desc' },
    });

    const daysInStage = lastHistory
      ? Math.floor((Date.now() - lastHistory.movedAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Atualiza dias no estágio anterior
    if (lastHistory) {
      await this.prisma.dealStageHistory.update({
        where: { id: lastHistory.id },
        data: { daysInStage },
      });
    }

    // Atualiza negócio
    const updated = await this.prisma.deal.update({
      where: { id: dealId },
      data: {
        stageId: dto.stageId,
        lostReason: dto.lostReason,
        lostNote: dto.lostNote,
        closedAt: (targetStage.isWon || targetStage.isLost) ? new Date() : null,
        lastActivityAt: new Date(),
      },
    });

    // Cria novo registro de histórico
    await this.prisma.dealStageHistory.create({
      data: { dealId, stageId: dto.stageId, userId, daysInStage: 0 },
    });

    // Placeholder para automação de vitória
    if (targetStage.isWon) {
      // TODO: Stage 4 - disparar automações de vitória
      console.log(`Deal ${dealId} ganho - automações serão implementadas na Etapa 4`);
    }

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'DEAL_STAGE_MOVED',
      entity: 'Deal',
      entityId: dealId,
      before: { stageId: deal.stageId },
      after: { stageId: dto.stageId },
    });

    return updated;
  }

  // Soft delete de negócio
  async remove(workspaceId: string, userId: string, id: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!deal) throw new NotFoundException('Negócio não encontrado');

    await this.prisma.deal.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'DEAL_DELETED',
      entity: 'Deal',
      entityId: id,
    });

    return { deleted: true };
  }

  // Adiciona tag a um negócio
  async addTag(workspaceId: string, dealId: string, tagId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, workspaceId, deletedAt: null },
    });

    if (!deal) throw new NotFoundException('Negócio não encontrado');

    await this.prisma.dealTag.upsert({
      where: { dealId_tagId: { dealId, tagId } },
      create: { dealId, tagId },
      update: {},
    });

    return { added: true };
  }

  // Remove tag de um negócio
  async removeTag(workspaceId: string, dealId: string, tagId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, workspaceId, deletedAt: null },
    });

    if (!deal) throw new NotFoundException('Negócio não encontrado');

    await this.prisma.dealTag.deleteMany({ where: { dealId, tagId } });

    return { removed: true };
  }
}
