// Serviço de Conversas — inbox unificado multicanal
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../email/email.service';
import {
  CreateConversationDto, UpdateConversationDto, ConversationQueryDto,
  ChangeStatusDto, AssignDto, SendMessageDto,
} from './conversations.dto';

@Injectable()
export class ConversationsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private whatsAppService: WhatsAppService,
    private emailService: EmailService,
  ) {}

  async findAll(workspaceId: string, query: ConversationQueryDto) {
    const { page = 1, limit = 20, channel, status, assigneeId, contactId, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ConversationWhereInput = {
      workspaceId,
      deletedAt: null,
      ...(channel && { channel }),
      ...(status && { status }),
      ...(assigneeId && { assigneeId }),
      ...(contactId && { contactId }),
      ...(search && {
        OR: [
          { subject: { contains: search, mode: 'insensitive' } },
          { contact: { name: { contains: search, mode: 'insensitive' } } },
          { messages: { some: { body: { contains: search, mode: 'insensitive' } } } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          contact: { select: { id: true, name: true, phone: true, email: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async findOne(workspaceId: string, id: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        contact: true,
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada');
    return conv;
  }

  async create(workspaceId: string, userId: string, dto: CreateConversationDto) {
    const conv = await this.prisma.conversation.create({
      data: {
        workspaceId,
        channel: dto.channel,
        contactId: dto.contactId,
        subject: dto.subject,
        externalId: dto.externalId,
        tags: dto.tags ?? [],
        lastMessageAt: new Date(),
      },
    });

    await this.auditService.log({
      workspaceId, userId, action: 'CONVERSATION_CREATED',
      entity: 'Conversation', entityId: conv.id, after: conv,
    });

    return conv;
  }

  async update(workspaceId: string, id: string, dto: UpdateConversationDto) {
    const existing = await this.prisma.conversation.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Conversa não encontrada');

    return this.prisma.conversation.update({
      where: { id },
      data: {
        ...(dto.subject !== undefined && { subject: dto.subject }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
      },
    });
  }

  async changeStatus(workspaceId: string, userId: string, id: string, dto: ChangeStatusDto) {
    const existing = await this.prisma.conversation.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Conversa não encontrada');

    return this.prisma.conversation.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async assign(workspaceId: string, id: string, dto: AssignDto) {
    const existing = await this.prisma.conversation.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Conversa não encontrada');

    return this.prisma.conversation.update({
      where: { id },
      data: { assigneeId: dto.assigneeId ?? null },
    });
  }

  async getMessages(workspaceId: string, conversationId: string, page = 1, limit = 50) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, workspaceId, deletedAt: null },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada');

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId, workspaceId },
        skip, take: limit,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.message.count({ where: { conversationId, workspaceId } }),
    ]);

    return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  // Responder pelo Inbox precisa realmente entregar a mensagem no canal —
  // antes, este método só gravava status:'SENT' no banco sem nunca chamar a
  // API do WhatsApp ou o SMTP (o cliente nunca recebia nada, apesar do
  // atendente ver "enviado" na tela). Agora cada canal aciona o serviço real
  // e só grava a mensagem depois de confirmar o envio — falha do WhatsApp/SMTP
  // propaga como erro visível em vez de fingir sucesso.
  async sendMessage(workspaceId: string, userId: string, conversationId: string, dto: SendMessageDto) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, workspaceId, deletedAt: null },
      include: { contact: true },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada');

    if (conv.channel === 'WHATSAPP') {
      if (!conv.contact?.phone) {
        throw new BadRequestException('Esta conversa não tem um telefone de contato para enviar WhatsApp');
      }
      // Envia de verdade via Graph API; lança erro (inclusive de janela de 24h
      // se o provedor recusar) em vez de deixar essa camada fingir sucesso.
      await this.whatsAppService.sendMessage(workspaceId, userId, {
        to: conv.contact.phone,
        type: (dto.type ?? 'TEXT') as any,
        body: dto.body,
        mediaUrl: dto.mediaUrl,
      });
    } else if (conv.channel === 'EMAIL') {
      if (!conv.contact?.email) {
        throw new BadRequestException('Esta conversa não tem um e-mail de contato para enviar');
      }
      await this.emailService.sendEmail(workspaceId, {
        to: conv.contact.email,
        subject: conv.subject || 'Nova mensagem',
        body: dto.body || '',
      });
    } else if (conv.channel !== 'CHAT_INTERNO') {
      // Canal sem integração de envio real implementada — não finge sucesso.
      throw new BadRequestException(
        `Envio pelo canal ${conv.channel} ainda não está implementado neste sistema.`,
      );
    }

    // Só grava a mensagem (e marca como SENT) depois do envio real confirmar
    // sucesso — para WHATSAPP/EMAIL a chamada acima já teria lançado erro antes
    // daqui se a entrega tivesse falhado.
    const msg = await this.prisma.message.create({
      data: {
        workspaceId,
        conversationId,
        direction: 'OUTBOUND',
        channel: conv.channel,
        type: dto.type ?? 'TEXT',
        body: dto.body,
        mediaUrl: dto.mediaUrl,
        status: 'SENT',
        senderId: userId,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date(), status: 'OPEN' },
    });

    return msg;
  }

  async searchMessages(workspaceId: string, q: string) {
    return this.prisma.message.findMany({
      where: {
        workspaceId,
        body: { contains: q, mode: 'insensitive' },
      },
      include: { conversation: { select: { id: true, channel: true, contactId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async getUnreadCount(workspaceId: string) {
    const count = await this.prisma.conversation.count({
      where: { workspaceId, deletedAt: null, status: 'OPEN' },
    });
    return { count };
  }
}
