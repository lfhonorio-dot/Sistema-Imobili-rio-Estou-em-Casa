import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAutomationDto, UpdateAutomationDto, TriggerAutomationDto } from './automation.dto';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(workspaceId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { workspaceId, deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.automation.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { logs: true } } },
      }),
      this.prisma.automation.count({ where }),
    ]);
    return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async findOne(workspaceId: string, id: string) {
    const automation = await this.prisma.automation.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: { logs: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!automation) throw new NotFoundException('Automação não encontrada');
    return automation;
  }

  async create(workspaceId: string, dto: CreateAutomationDto) {
    return this.prisma.automation.create({
      data: {
        workspaceId,
        name: dto.name,
        description: dto.description,
        trigger: dto.trigger,
        triggerConfig: (dto.triggerConfig ?? {}) as never,
        steps: dto.steps as unknown as never,
      },
    });
  }

  async update(workspaceId: string, id: string, dto: UpdateAutomationDto) {
    await this.findOne(workspaceId, id);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.trigger !== undefined) data.trigger = dto.trigger;
    if (dto.triggerConfig !== undefined) data.triggerConfig = dto.triggerConfig;
    if (dto.steps !== undefined) data.steps = dto.steps;
    if (dto.status !== undefined) data.status = dto.status ? 'ACTIVE' : 'PAUSED';
    return this.prisma.automation.update({ where: { id }, data });
  }

  async remove(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);
    await this.prisma.automation.update({ where: { id }, data: { deletedAt: new Date() } });
    return { deleted: true };
  }

  async trigger(workspaceId: string, dto: TriggerAutomationDto) {
    const automations = await this.prisma.automation.findMany({
      where: { workspaceId, trigger: dto.trigger, status: 'ACTIVE', deletedAt: null },
    });

    const results = [];
    for (const automation of automations) {
      const start = Date.now();
      try {
        const steps = automation.steps as unknown[];
        const executedSteps = steps.map((s: unknown, i: number) => ({
          index: i, step: s, status: 'SUCCESS', executedAt: new Date().toISOString(),
        }));

        await this.prisma.automationLog.create({
          data: {
            automationId: automation.id,
            workspaceId,
            status: 'SUCCESS',
            trigger: dto.trigger,
            entityId: dto.entityId,
            entityType: dto.entityType,
            steps: executedSteps as never,
            duration: Date.now() - start,
          },
        });

        await this.prisma.automation.update({
          where: { id: automation.id },
          data: {
            executions: { increment: 1 },
            successes: { increment: 1 },
            lastRunAt: new Date(),
          },
        });

        results.push({ automationId: automation.id, name: automation.name, status: 'SUCCESS' });
        this.logger.log(`Automation ${automation.id} triggered successfully`);
      } catch (err) {
        await this.prisma.automationLog.create({
          data: {
            automationId: automation.id,
            workspaceId,
            status: 'FAILURE',
            trigger: dto.trigger,
            entityId: dto.entityId,
            entityType: dto.entityType,
            steps: [],
            errorMessage: err instanceof Error ? err.message : 'Unknown error',
            duration: Date.now() - start,
          },
        });

        await this.prisma.automation.update({
          where: { id: automation.id },
          data: { executions: { increment: 1 }, failures: { increment: 1 }, lastRunAt: new Date() },
        });

        results.push({ automationId: automation.id, name: automation.name, status: 'FAILURE' });
      }
    }

    return { triggered: results.length, results };
  }

  async getLogs(workspaceId: string, automationId: string, page = 1, limit = 20) {
    await this.findOne(workspaceId, automationId);
    const skip = (page - 1) * limit;
    const where = { automationId, workspaceId };
    const [items, total] = await Promise.all([
      this.prisma.automationLog.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.automationLog.count({ where }),
    ]);
    return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }
}
