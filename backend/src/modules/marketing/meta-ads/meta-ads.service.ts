// Serviço Meta Ads — integração, webhook e Conversions API
import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SaveMetaIntegrationDto, FieldMappingDto, CapiEventDto } from './meta-ads.dto';

const ALGO = 'aes-256-cbc';

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY || '';
  if (hex.length === 64) return Buffer.from(hex, 'hex');
  return Buffer.alloc(32);
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  return iv.toString('hex') + ':' + cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
}

function decrypt(enc: string): string {
  try {
    const [ivHex, data] = enc.split(':');
    const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
    return decipher.update(data, 'hex', 'utf8') + decipher.final('utf8');
  } catch {
    return enc;
  }
}

@Injectable()
export class MetaAdsService {
  private readonly logger = new Logger(MetaAdsService.name);

  constructor(private prisma: PrismaService) {}

  async getIntegration(workspaceId: string) {
    const integration = await this.prisma.marketingIntegration.findFirst({
      where: { workspaceId, provider: 'META_ADS' },
    });
    if (!integration) return null;
    return { ...integration, accessToken: integration.accessToken ? '***' : null };
  }

  async saveIntegration(workspaceId: string, dto: SaveMetaIntegrationDto) {
    const encToken = encrypt(dto.accessToken);
    const existing = await this.prisma.marketingIntegration.findFirst({
      where: { workspaceId, provider: 'META_ADS' },
    });
    const data = {
      provider: 'META_ADS',
      accessToken: encToken,
      accountId: dto.accountId,
      pageId: dto.pageId,
      status: 'ACTIVE',
    };
    if (existing) {
      return this.prisma.marketingIntegration.update({ where: { id: existing.id }, data });
    }
    return this.prisma.marketingIntegration.create({ data: { workspaceId, ...data } });
  }

  async deleteIntegration(workspaceId: string) {
    const existing = await this.prisma.marketingIntegration.findFirst({
      where: { workspaceId, provider: 'META_ADS' },
    });
    if (!existing) return { deleted: false };
    await this.prisma.marketingIntegration.delete({ where: { id: existing.id } });
    return { deleted: true };
  }

  async getCampaigns(workspaceId: string) {
    return this.prisma.adCampaign.findMany({
      where: { workspaceId, provider: 'META_ADS' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async syncCampaigns(workspaceId: string) {
    // Simula sincronização com a API do Meta — em produção, chamaria a Graph API
    const mockCampaigns = [
      { externalId: 'meta_camp_001', name: 'Campanha Locação SP', spend: 1250.0, impressions: 45000, clicks: 920, leads: 38 },
      { externalId: 'meta_camp_002', name: 'Lançamento Alto Padrão', spend: 3200.0, impressions: 120000, clicks: 2400, leads: 87 },
    ];

    const campaigns = [];
    for (const mock of mockCampaigns) {
      const campaign = await this.prisma.adCampaign.upsert({
        where: { workspaceId_provider_externalId: { workspaceId, provider: 'META_ADS', externalId: mock.externalId } },
        update: { ...mock, syncedAt: new Date() },
        create: { workspaceId, provider: 'META_ADS', ...mock, syncedAt: new Date() },
      });
      campaigns.push(campaign);
    }
    return { synced: campaigns.length, campaigns };
  }

  async getFieldMappings(workspaceId: string) {
    const integration = await this.prisma.marketingIntegration.findFirst({
      where: { workspaceId, provider: 'META_ADS' },
    });
    const config = (integration?.config as Record<string, unknown>) ?? {};
    return { mappings: (config.fieldMappings as Record<string, string>) ?? {} };
  }

  async saveFieldMappings(workspaceId: string, dto: FieldMappingDto) {
    const existing = await this.prisma.marketingIntegration.findFirst({
      where: { workspaceId, provider: 'META_ADS' },
    });
    const config = existing ? { ...(existing.config as object), fieldMappings: dto.mappings } : { fieldMappings: dto.mappings };
    if (existing) {
      await this.prisma.marketingIntegration.update({ where: { id: existing.id }, data: { config } });
    } else {
      await this.prisma.marketingIntegration.create({
        data: { workspaceId, provider: 'META_ADS', status: 'ACTIVE', config },
      });
    }
    return { mappings: dto.mappings };
  }

  async processLeadWebhook(workspaceId: string, body: Record<string, unknown>) {
    // Extrai dados do lead — formato simplificado do Meta Lead Gen
    const entry = (body.entry as Record<string, unknown>[])?.[0];
    const changes = (entry?.changes as Record<string, unknown>[])?.[0];
    const value = changes?.value as Record<string, unknown>;
    const leadgen = (value?.leadgen_id as string) ?? `lead_${Date.now()}`;
    const fieldData = (value?.field_data as { name: string; values: string[] }[]) ?? [];

    const getName = (field: string) => fieldData.find(f => f.name === field)?.values?.[0] ?? '';
    const name = getName('full_name') || getName('first_name') || 'Lead Meta';
    const email = getName('email');
    const phone = getName('phone_number');
    const campaignName = (value?.campaign_name as string) ?? 'meta-ads';

    // Busca pipeline padrão para criar deal
    const pipeline = await this.prisma.pipeline.findFirst({ where: { workspaceId } });

    const contact = await this.prisma.contact.create({
      data: {
        workspaceId,
        name,
        email: email || null,
        phone: phone || null,
        type: 'PERSON',
        origin: 'META_ADS',
        utmSource: 'meta',
        utmCampaign: campaignName,
      },
    });

    let deal = null;
    if (pipeline) {
      const firstStage = await this.prisma.pipelineStage.findFirst({
        where: { pipelineId: pipeline.id },
        orderBy: { order: 'asc' },
      });
      if (firstStage) {
        deal = await this.prisma.deal.create({
          data: {
            workspaceId,
            title: `Lead Meta — ${name}`,
            contactId: contact.id,
            pipelineId: pipeline.id,
            stageId: firstStage.id,
            utmSource: 'meta',
            utmCampaign: campaignName,
            origin: 'META_ADS',
          },
        });
      }
    }

    this.logger.log(`Lead Meta processado: ${leadgen}`);
    return { received: true, contactId: contact.id, dealId: deal?.id };
  }

  async sendCapiEvent(workspaceId: string, dto: CapiEventDto) {
    // Simula envio para Conversions API — em produção, chamaria endpoint do Meta CAPI
    this.logger.log(`CAPI evento: ${dto.eventType} workspace=${workspaceId}`);
    return { sent: true, eventType: dto.eventType };
  }
}
