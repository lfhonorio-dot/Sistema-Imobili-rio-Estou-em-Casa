// Serviço de Pipelines - lógica de negócio
// Gerencia: pipelines de vendas/locação com estágios

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  CreatePipelineDto,
  UpdatePipelineDto,
  CreateStageDto,
  UpdateStageDto,
  ReorderStagesDto,
} from './pipelines.dto';

// Estágios padrão para pipeline de VENDA
const DEFAULT_SALE_STAGES = [
  { name: 'Novo Lead', color: '#6366f1', order: 0, isWon: false, isLost: false },
  { name: 'Contato Feito', color: '#8b5cf6', order: 1, isWon: false, isLost: false },
  { name: 'Visita Agendada', color: '#f59e0b', order: 2, isWon: false, isLost: false },
  { name: 'Proposta', color: '#3b82f6', order: 3, isWon: false, isLost: false },
  { name: 'Documentação', color: '#10b981', order: 4, isWon: false, isLost: false },
  { name: 'Ganho', color: '#22c55e', order: 5, isWon: true, isLost: false },
  { name: 'Perdido', color: '#ef4444', order: 6, isWon: false, isLost: true },
];

// Estágios padrão para pipeline de LOCAÇÃO
const DEFAULT_RENTAL_STAGES = [
  { name: 'Novo Lead', color: '#6366f1', order: 0, isWon: false, isLost: false },
  { name: 'Contato Feito', color: '#8b5cf6', order: 1, isWon: false, isLost: false },
  { name: 'Visita Agendada', color: '#f59e0b', order: 2, isWon: false, isLost: false },
  { name: 'Proposta', color: '#3b82f6', order: 3, isWon: false, isLost: false },
  { name: 'Análise', color: '#06b6d4', order: 4, isWon: false, isLost: false },
  { name: 'Contrato', color: '#84cc16', order: 5, isWon: false, isLost: false },
  { name: 'Locado', color: '#22c55e', order: 6, isWon: true, isLost: false },
  { name: 'Perdido', color: '#ef4444', order: 7, isWon: false, isLost: true },
];

@Injectable()
export class PipelinesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // Lista todos os pipelines com contagens por estágio
  async findAll(workspaceId: string) {
    const pipelines = await this.prisma.pipeline.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { order: 'asc' },
      include: {
        stages: {
          orderBy: { order: 'asc' },
          include: {
            _count: { select: { deals: true } },
          },
        },
        _count: { select: { deals: true } },
      },
    });

    return { success: true, data: pipelines };
  }

  // Busca pipeline por ID com resumo por estágio
  async findOne(workspaceId: string, id: string) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        stages: {
          orderBy: { order: 'asc' },
          include: {
            deals: {
              where: { deletedAt: null },
              select: { id: true, title: true, value: true, contactId: true },
            },
          },
        },
      },
    });

    if (!pipeline) throw new NotFoundException('Pipeline não encontrado');

    return { success: true, data: pipeline };
  }

  // Cria pipeline com estágios padrão para SALE e RENTAL
  async create(workspaceId: string, userId: string, dto: CreatePipelineDto) {
    const pipeline = await this.prisma.pipeline.create({
      data: {
        workspaceId,
        name: dto.name,
        type: dto.type,
        isDefault: dto.isDefault ?? false,
        order: dto.order ?? 0,
      },
    });

    // Cria estágios padrão conforme o tipo
    if (dto.type === 'SALE' || dto.type === 'RENTAL') {
      await this.createDefaultStages(pipeline.id, dto.type);
    }

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'PIPELINE_CREATED',
      entity: 'Pipeline',
      entityId: pipeline.id,
    });

    const created = await this.findOne(workspaceId, pipeline.id);
    return created;
  }

  // Cria estágios padrão conforme tipo de pipeline
  private async createDefaultStages(pipelineId: string, type: string) {
    const stages = type === 'SALE' ? DEFAULT_SALE_STAGES : DEFAULT_RENTAL_STAGES;

    await this.prisma.pipelineStage.createMany({
      data: stages.map((s) => ({ ...s, pipelineId })),
    });
  }

  // Atualiza pipeline
  async update(workspaceId: string, userId: string, id: string, dto: UpdatePipelineDto) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!pipeline) throw new NotFoundException('Pipeline não encontrado');

    const updated = await this.prisma.pipeline.update({
      where: { id },
      data: { ...dto },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'PIPELINE_UPDATED',
      entity: 'Pipeline',
      entityId: id,
      before: pipeline,
      after: updated,
    });

    return { success: true, data: updated };
  }

  // Soft delete de pipeline
  async remove(workspaceId: string, userId: string, id: string) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!pipeline) throw new NotFoundException('Pipeline não encontrado');

    await this.prisma.pipeline.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      workspaceId,
      userId,
      action: 'PIPELINE_DELETED',
      entity: 'Pipeline',
      entityId: id,
    });

    return { success: true, data: { deleted: true } };
  }

  // Adiciona estágio ao pipeline
  async addStage(workspaceId: string, pipelineId: string, dto: CreateStageDto) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id: pipelineId, workspaceId, deletedAt: null },
    });

    if (!pipeline) throw new NotFoundException('Pipeline não encontrado');

    const stage = await this.prisma.pipelineStage.create({
      data: {
        pipelineId,
        name: dto.name,
        color: dto.color ?? '#6366f1',
        order: dto.order,
        expectedDays: dto.expectedDays,
        isWon: dto.isWon ?? false,
        isLost: dto.isLost ?? false,
        rottenAfterDays: dto.rottenAfterDays,
      },
    });

    return { success: true, data: stage };
  }

  // Atualiza estágio
  async updateStage(workspaceId: string, pipelineId: string, stageId: string, dto: UpdateStageDto) {
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: stageId, pipelineId, pipeline: { workspaceId } },
    });

    if (!stage) throw new NotFoundException('Estágio não encontrado');

    const updated = await this.prisma.pipelineStage.update({
      where: { id: stageId },
      data: { ...dto },
    });

    return { success: true, data: updated };
  }

  // Remove estágio (apenas se não tiver negócios)
  async deleteStage(workspaceId: string, pipelineId: string, stageId: string) {
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: stageId, pipelineId, pipeline: { workspaceId } },
      include: { _count: { select: { deals: true } } },
    });

    if (!stage) throw new NotFoundException('Estágio não encontrado');

    if (stage._count.deals > 0) {
      throw new BadRequestException('Não é possível remover estágio com negócios ativos');
    }

    await this.prisma.pipelineStage.delete({ where: { id: stageId } });

    return { success: true, data: { deleted: true } };
  }

  // Reordena estágios
  async reorderStages(workspaceId: string, pipelineId: string, dto: ReorderStagesDto) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id: pipelineId, workspaceId, deletedAt: null },
    });

    if (!pipeline) throw new NotFoundException('Pipeline não encontrado');

    const updates = dto.stageIds.map((stageId, index) =>
      this.prisma.pipelineStage.update({
        where: { id: stageId },
        data: { order: index },
      }),
    );

    await this.prisma.$transaction(updates);

    return { success: true, data: { reordered: true } };
  }
}
