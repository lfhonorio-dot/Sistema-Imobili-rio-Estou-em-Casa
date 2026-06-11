// Serviço Google Ads — integração, webhook e Offline Conversions
import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SaveGoogleIntegrationDto, OfflineConversionDto } from './google-ads.dto';

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

@Injectable()
export class GoogleAdsService {
  private readonly logger = new Logger(GoogleAdsService.name);

  constructor(private prisma: PrismaService) {}

  async getIntegration(workspaceId: string) {
    const integration = await this.prisma.marketingIntegration.findFirst({
      where: { workspaceId, provider: 'GOOGLE_ADS' },
    });
    if (!integration) return null;
    return { ...integration, accessToken: integration.accessToken ? '***' : null };
  }

  async saveIntegration(workspaceId: string, dto: SaveGoogleIntegrationDto) {
    const encToken = encrypt(dto.accessToken);
    const existing = await this.prisma.marketingIntegration.findFirst({
      where: { workspaceId, provider: 'GOOGLE_ADS' },
    });
    const data = {
      provider: 'GOOGLE_ADS',
      accessToken: encToken,
      accountId: dto.customerId,
      status: 'ACTIVE',
    };
    if (existing) {
      return this.prisma.marketingIntegration.update({ where: { id: existing.id }, data });
    }
    return this.prisma.marketingIntegration.create({ data: { workspaceId, ...data } });
  }

  async deleteIntegration(workspaceId: string) {
    const existing = await this.prisma.marketingIntegration.findFirst({
      where: { workspaceId, provider: 'GOOGLE_ADS' },
    });
    if (!existing) return { deleted: false };
    await this.prisma.marketingIntegration.delete({ where: { id: existing.id } });
    return { deleted: true };
  }

  async getCampaigns(workspaceId: string) {
    return this.prisma.adCampaign.findMany({
      where: { workspaceId, provider: 'GOOGLE_ADS' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async syncCampaigns(workspaceId: string) {
    // Simula sincronização com Google Ads API
    const mockCampaigns = [
      { externalId: 'gads_camp_001', name: 'Search — Apartamentos SP', spend: 890.0, impressions: 22000, clicks: 650, leads: 24, conversions: 5 },
      { externalId: 'gads_camp_002', name: 'Display — Casas Condomínio', spend: 420.0, impressions: 85000, clicks: 310, leads: 12, conversions: 2 },
    ];

    const campaigns = [];
    for (const mock of mockCampaigns) {
      const campaign = await this.prisma.adCampaign.upsert({
        where: { workspaceId_provider_externalId: { workspaceId, provider: 'GOOGLE_ADS', externalId: mock.externalId } },
        update: { ...mock, syncedAt: new Date() },
        create: { workspaceId, provider: 'GOOGLE_ADS', ...mock, syncedAt: new Date() },
      });
      campaigns.push(campaign);
    }
    return { synced: campaigns.length, campaigns };
  }

  async sendOfflineConversion(workspaceId: string, dto: OfflineConversionDto) {
    // Simula envio de conversão offline para o Google Ads
    this.logger.log(`Offline conversion: gclid=${dto.gclid} value=${dto.value} workspace=${workspaceId}`);
    return { sent: true, gclid: dto.gclid, value: dto.value, conversionName: dto.conversionName ?? 'Deal Fechado' };
  }

  async processLeadWebhook(workspaceId: string, body: Record<string, unknown>) {
    // Extrai lead de formulário de extensão do Google Ads
    const userColumnData = (body.user_column_data as Record<string, unknown>[]) ?? [];
    const getName = (col: string) => (userColumnData.find(c => c.column_id === col)?.string_value as string) ?? '';

    const name = getName('FULL_NAME') || 'Lead Google';
    const email = getName('EMAIL');
    const phone = getName('PHONE_NUMBER');
    const gclid = (body.gclid as string) ?? '';
    const campaignName = (body.campaign_name as string) ?? 'google-ads';

    const pipeline = await this.prisma.pipeline.findFirst({ where: { workspaceId } });

    const contact = await this.prisma.contact.create({
      data: {
        workspaceId,
        name,
        email: email || null,
        phone: phone || null,
        type: 'PERSON',
        origin: 'GOOGLE_ADS',
        utmSource: 'google',
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
            title: `Lead Google — ${name}`,
            contactId: contact.id,
            pipelineId: pipeline.id,
            stageId: firstStage.id,
            utmSource: 'google',
            utmCampaign: campaignName,

            customFields: gclid ? { gclid } : {},
          },
        });
      }
    }

    this.logger.log(`Lead Google processado: gclid=${gclid}`);
    return { received: true, contactId: contact.id, dealId: deal?.id };
  }
}
