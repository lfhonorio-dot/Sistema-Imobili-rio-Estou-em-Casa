// Serviço de WhatsApp — configuração e envio via Cloud API
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SaveWhatsAppConfigDto, SendWhatsAppMessageDto } from './whatsapp.dto';

@Injectable()
export class WhatsAppService {
  constructor(private prisma: PrismaService) {}

  async getConfig(workspaceId: string) {
    const config = await this.prisma.whatsAppConfig.findUnique({ where: { workspaceId } });
    if (!config) throw new NotFoundException('Configuração do WhatsApp não encontrada');
    // Ocultar token completo por segurança
    return { ...config, accessToken: '***' };
  }

  async saveConfig(workspaceId: string, dto: SaveWhatsAppConfigDto) {
    return this.prisma.whatsAppConfig.upsert({
      where: { workspaceId },
      create: { workspaceId, ...dto },
      update: dto,
    });
  }

  async sendMessage(workspaceId: string, userId: string, dto: SendWhatsAppMessageDto) {
    const config = await this.prisma.whatsAppConfig.findUnique({ where: { workspaceId } });
    if (!config) throw new NotFoundException('Configure o WhatsApp antes de enviar mensagens');

    const payload = this.buildPayload(dto, config.phoneNumberId);

    // Falha na Meta é propagada — não reportar sucesso sem entrega real.
    let wamid: string | undefined;
    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) {
        const msg = json?.error?.message ?? `WhatsApp API HTTP ${res.status}`;
        throw new Error(msg);
      }
      wamid = json?.messages?.[0]?.id;
    } catch (err) {
      console.error('Falha ao enviar mensagem WhatsApp:', (err as Error).message);
      throw new BadRequestException(`Envio WhatsApp falhou: ${(err as Error).message}`);
    }

    // Registrar na conversa se fornecida
    if (dto.conversationId) {
      await this.prisma.message.create({
        data: {
          workspaceId,
          conversationId: dto.conversationId,
          channel: 'WHATSAPP',
          direction: 'OUTBOUND',
          type: dto.type,
          body: dto.body || dto.mediaUrl || '',
          mediaUrl: dto.mediaUrl,
        },
      });

      await this.prisma.conversation.update({
        where: { id: dto.conversationId },
        data: { lastMessageAt: new Date() },
      });
    }

    return { message: 'Mensagem enviada', to: dto.to, wamid };
  }

  async handleWebhook(workspaceId: string, body: any) {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value?.messages?.length) return { received: true };

    for (const msg of value.messages) {
      const from = msg.from;
      const type = msg.type?.toUpperCase() || 'TEXT';
      const text = msg.text?.body || msg.caption || '';
      const mediaUrl = msg.image?.link || msg.document?.link || msg.audio?.link || msg.video?.link;

      // Buscar ou criar contato pelo número
      let contact = await this.prisma.contact.findFirst({
        where: { workspaceId, phone: from, deletedAt: null },
      });

      if (!contact) {
        const profileName = value.contacts?.[0]?.profile?.name || from;
        contact = await this.prisma.contact.create({
          data: { workspaceId, type: 'PERSON', name: profileName, phone: from },
        });
      }

      // Buscar ou criar conversa aberta para este contato
      let conversation = await this.prisma.conversation.findFirst({
        where: {
          workspaceId,
          contactId: contact.id,
          channel: 'WHATSAPP',
          status: 'OPEN',
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!conversation) {
        conversation = await this.prisma.conversation.create({
          data: {
            workspaceId,
            contactId: contact.id,
            channel: 'WHATSAPP',
            status: 'OPEN',
          },
        });
      }

      await this.prisma.message.create({
        data: {
          workspaceId,
          conversationId: conversation.id,
          channel: 'WHATSAPP',
          direction: 'INBOUND',
          type,
          body: text,
          mediaUrl,
          externalId: msg.id,
        },
      });

      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });
    }

    return { received: true };
  }

  verifyWebhook(mode: string, token: string, challenge: string, verifyToken: string): string | null {
    if (mode === 'subscribe' && token === verifyToken) return challenge;
    return null;
  }

  private buildPayload(dto: SendWhatsAppMessageDto, phoneNumberId: string) {
    const base = { messaging_product: 'whatsapp', to: dto.to };

    if (dto.type === 'TEXT') {
      return { ...base, type: 'text', text: { body: dto.body } };
    }

    if (dto.type === 'TEMPLATE') {
      return {
        ...base,
        type: 'template',
        template: {
          name: dto.templateName,
          language: { code: 'pt_BR' },
          components: dto.variables
            ? [{ type: 'body', parameters: Object.values(dto.variables).map(v => ({ type: 'text', text: v })) }]
            : [],
        },
      };
    }

    const mediaType = dto.type.toLowerCase();
    return { ...base, type: mediaType, [mediaType]: { link: dto.mediaUrl } };
  }
}
