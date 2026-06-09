// Serviço de auditoria - registra todas as ações críticas do sistema
// Logs imutáveis para rastreabilidade e conformidade LGPD

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Interface para criação de log de auditoria
export interface CreateAuditLogDto {
  workspaceId?: string;
  userId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  // Registra uma entrada no log de auditoria
  async log(dto: CreateAuditLogDto): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          workspaceId: dto.workspaceId,
          userId: dto.userId,
          action: dto.action,
          entity: dto.entity,
          entityId: dto.entityId,
          before: dto.before,
          after: dto.after,
          ipAddress: dto.ipAddress,
          userAgent: dto.userAgent,
        },
      });
    } catch (error) {
      // Log de auditoria não deve quebrar o fluxo principal
      this.logger.error(
        `Erro ao registrar log de auditoria [${dto.action}]:`,
        error,
      );
    }
  }

  // Lista logs de auditoria com paginação e filtros
  async getLogs(
    workspaceId: string,
    options: {
      page?: number;
      limit?: number;
      userId?: string;
      action?: string;
      entity?: string;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ) {
    const { page = 1, limit = 50, userId, action, entity, startDate, endDate } = options;
    const skip = (page - 1) * limit;

    // Constrói filtros dinamicamente
    const where: Record<string, unknown> = { workspaceId };

    if (userId) where['userId'] = userId;
    if (action) where['action'] = { contains: action, mode: 'insensitive' };
    if (entity) where['entity'] = entity;

    if (startDate || endDate) {
      where['createdAt'] = {};
      if (startDate) (where['createdAt'] as Record<string, unknown>)['gte'] = startDate;
      if (endDate) (where['createdAt'] as Record<string, unknown>)['lte'] = endDate;
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  // Busca log específico por ID
  async getLogById(workspaceId: string, logId: string) {
    return this.prisma.auditLog.findFirst({
      where: { id: logId, workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
