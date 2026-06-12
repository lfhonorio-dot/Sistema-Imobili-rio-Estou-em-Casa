import { Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto, CreateWebhookDto, UpdateWebhookDto } from './integrations.dto';

@Injectable()
export class IntegrationsService {
  constructor(private prisma: PrismaService) {}

  // ── API Keys ──────────────────────────────────────────────────────────────

  async listApiKeys(workspaceId: string) {
    return this.prisma.apiKey.findMany({
      where: { workspaceId, deletedAt: null },
      select: { id: true, name: true, keyPrefix: true, scopes: true, lastUsedAt: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createApiKey(workspaceId: string, dto: CreateApiKeyDto) {
    const raw = `eic_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(raw).digest('hex');
    const keyPrefix = raw.slice(0, 12);

    const key = await this.prisma.apiKey.create({
      data: {
        workspaceId,
        name: dto.name,
        keyHash,
        keyPrefix,
        scopes: dto.scopes ?? ['read'],
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    // Return raw key only once
    return { ...key, key: raw };
  }

  async revokeApiKey(workspaceId: string, id: string) {
    const key = await this.prisma.apiKey.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!key) throw new NotFoundException('API key não encontrada');
    await this.prisma.apiKey.update({ where: { id }, data: { deletedAt: new Date() } });
    return { revoked: true };
  }

  async validateApiKey(rawKey: string): Promise<{ workspaceId: string } | null> {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const key = await this.prisma.apiKey.findFirst({
      where: { keyHash, deletedAt: null },
    });
    if (!key) return null;
    if (key.expiresAt && key.expiresAt < new Date()) return null;
    await this.prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
    return { workspaceId: key.workspaceId };
  }

  // ── Webhooks ──────────────────────────────────────────────────────────────

  async listWebhooks(workspaceId: string) {
    return this.prisma.webhookEndpoint.findMany({
      where: { workspaceId, deletedAt: null },
      include: { _count: { select: { logs: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createWebhook(workspaceId: string, dto: CreateWebhookDto) {
    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;
    return this.prisma.webhookEndpoint.create({
      data: { workspaceId, url: dto.url, events: dto.events, secret },
    });
  }

  async updateWebhook(workspaceId: string, id: string, dto: UpdateWebhookDto) {
    const wh = await this.prisma.webhookEndpoint.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!wh) throw new NotFoundException('Webhook não encontrado');
    return this.prisma.webhookEndpoint.update({
      where: { id },
      data: {
        ...(dto.url && { url: dto.url }),
        ...(dto.events && { events: dto.events }),
        ...(dto.status && { status: dto.status }),
      },
    });
  }

  async deleteWebhook(workspaceId: string, id: string) {
    const wh = await this.prisma.webhookEndpoint.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!wh) throw new NotFoundException('Webhook não encontrado');
    await this.prisma.webhookEndpoint.update({ where: { id }, data: { deletedAt: new Date() } });
    return { deleted: true };
  }

  async getWebhookLogs(workspaceId: string, webhookId: string, page = 1, limit = 20) {
    const wh = await this.prisma.webhookEndpoint.findFirst({ where: { id: webhookId, workspaceId, deletedAt: null } });
    if (!wh) throw new NotFoundException('Webhook não encontrado');
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.webhookLog.findMany({ where: { endpointId: webhookId }, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.webhookLog.count({ where: { endpointId: webhookId } }),
    ]);
    return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async testWebhook(workspaceId: string, id: string) {
    const wh = await this.prisma.webhookEndpoint.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!wh) throw new NotFoundException('Webhook não encontrado');

    const payload = { event: 'ping', timestamp: new Date().toISOString(), workspaceId };
    const signature = crypto.createHmac('sha256', wh.secret).update(JSON.stringify(payload)).digest('hex');
    const start = Date.now();

    let statusCode = 0;
    let status = 'FAILURE';
    let response = '';

    try {
      const res = await fetch(wh.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-signature': signature },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
      statusCode = res.status;
      response = await res.text().catch(() => '');
      status = res.ok ? 'SUCCESS' : 'FAILURE';
    } catch {
      response = 'Connection failed';
    }

    const duration = Date.now() - start;

    await this.prisma.webhookLog.create({
      data: { endpointId: id, event: 'ping', payload: payload as never, status, statusCode, response: response.slice(0, 500), duration },
    });

    await this.prisma.webhookEndpoint.update({
      where: { id },
      data: {
        lastTriggeredAt: new Date(),
        failureCount: status === 'FAILURE' ? { increment: 1 } : wh.failureCount,
      },
    });

    return { status, statusCode, duration, response: response.slice(0, 200) };
  }

  // ── Available webhook events ───────────────────────────────────────────────

  getAvailableEvents() {
    return [
      'contact.created', 'contact.updated', 'contact.deleted',
      'deal.created', 'deal.updated', 'deal.won', 'deal.lost',
      'property.created', 'property.updated', 'property.sold', 'property.rented',
      'contract.created', 'contract.signed', 'contract.expired',
      'boleto.paid', 'boleto.overdue',
      'maintenance.opened', 'maintenance.completed',
      'lead.received',
    ];
  }
}
