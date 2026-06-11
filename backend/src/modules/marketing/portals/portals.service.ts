// Serviço de Portais Imobiliários — publicação, leads e sincronização
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { SavePortalIntegrationDto, PublishPropertyDto, PortalType } from './portals.dto';

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
export class PortalsService {
  private readonly logger = new Logger(PortalsService.name);

  constructor(private prisma: PrismaService) {}

  async getIntegrations(workspaceId: string) {
    const integrations = await this.prisma.portalIntegration.findMany({
      where: { workspaceId },
      include: { _count: { select: { publications: true } } },
    });
    return integrations.map(i => ({ ...i, apiKey: i.apiKey ? '***' : null }));
  }

  async saveIntegration(workspaceId: string, dto: SavePortalIntegrationDto) {
    const encKey = encrypt(dto.apiKey);
    const existing = await this.prisma.portalIntegration.findFirst({
      where: { workspaceId, portal: dto.portal },
    });
    if (existing) {
      return this.prisma.portalIntegration.update({
        where: { id: existing.id },
        data: { apiKey: encKey, status: 'ACTIVE' },
      });
    }
    return this.prisma.portalIntegration.create({
      data: { workspaceId, portal: dto.portal, apiKey: encKey, status: 'ACTIVE' },
    });
  }

  async deleteIntegration(workspaceId: string, portal: PortalType) {
    const existing = await this.prisma.portalIntegration.findFirst({
      where: { workspaceId, portal },
    });
    if (!existing) return { deleted: false };
    // Remove publicações vinculadas antes de excluir a integração (FK constraint)
    await this.prisma.portalPublication.deleteMany({ where: { portalId: existing.id } });
    await this.prisma.portalIntegration.delete({ where: { id: existing.id } });
    return { deleted: true };
  }

  async publishProperty(workspaceId: string, dto: PublishPropertyDto) {
    const property = await this.prisma.property.findFirst({
      where: { id: dto.propertyId, workspaceId },
    });
    if (!property) throw new NotFoundException('Imóvel não encontrado');

    const results = [];
    for (const portalName of dto.portals) {
      let portalIntegration = await this.prisma.portalIntegration.findFirst({
        where: { workspaceId, portal: portalName },
      });
      if (!portalIntegration) {
        // Cria integração de placeholder se não existir
        portalIntegration = await this.prisma.portalIntegration.create({
          data: { workspaceId, portal: portalName, status: 'ACTIVE' },
        });
      }

      const pub = await this.prisma.portalPublication.upsert({
        where: { portalId_propertyId: { portalId: portalIntegration.id, propertyId: dto.propertyId } },
        update: { status: 'PUBLISHED', publishedAt: new Date(), externalId: `${portalName.toLowerCase()}_${uuidv4().slice(0, 8)}` },
        create: {
          workspaceId,
          portalId: portalIntegration.id,
          propertyId: dto.propertyId,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          externalId: `${portalName.toLowerCase()}_${uuidv4().slice(0, 8)}`,
        },
      });
      results.push(pub);
    }

    this.logger.log(`Imóvel ${dto.propertyId} publicado em ${dto.portals.join(', ')}`);
    return { published: results.length, publications: results };
  }

  async unpublishProperty(workspaceId: string, propertyId: string, portal: PortalType) {
    const portalIntegration = await this.prisma.portalIntegration.findFirst({
      where: { workspaceId, portal },
    });
    if (!portalIntegration) throw new NotFoundException('Integração de portal não encontrada');

    const pub = await this.prisma.portalPublication.findFirst({
      where: { portalId: portalIntegration.id, propertyId },
    });
    if (!pub) throw new NotFoundException('Publicação não encontrada');

    return this.prisma.portalPublication.update({
      where: { id: pub.id },
      data: { status: 'UNPUBLISHED', unpublishedAt: new Date() },
    });
  }

  async getPublications(workspaceId: string, propertyId?: string) {
    return this.prisma.portalPublication.findMany({
      where: { workspaceId, ...(propertyId && { propertyId }) },
      include: { portal: true, property: { select: { id: true, code: true, street: true, city: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async processPortalLead(workspaceId: string, portal: string, body: Record<string, unknown>) {
    const name = (body.name as string) || (body.nome as string) || 'Lead Portal';
    const email = (body.email as string) || null;
    const phone = (body.phone as string) || (body.telefone as string) || null;
    const portalTag = portal.toLowerCase();

    const pipeline = await this.prisma.pipeline.findFirst({ where: { workspaceId } });

    const contact = await this.prisma.contact.create({
      data: {
        workspaceId,
        name,
        email,
        phone,
        type: 'PERSON',
        origin: portal.toUpperCase(),
        utmSource: portalTag,
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
            title: `Lead ${portal} — ${name}`,
            contactId: contact.id,
            pipelineId: pipeline.id,
            stageId: firstStage.id,
            utmSource: portalTag,

          },
        });
      }
    }

    this.logger.log(`Lead portal ${portal} processado`);
    return { received: true, contactId: contact.id, dealId: deal?.id };
  }
}
