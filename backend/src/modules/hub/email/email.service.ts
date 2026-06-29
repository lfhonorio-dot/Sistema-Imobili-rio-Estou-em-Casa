// Serviço de Email — templates e envio via nodemailer
import { Injectable, NotFoundException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
  SendEmailDto,
  EmailTemplateQueryDto,
} from './email.dto';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private prisma: PrismaService) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async findAllTemplates(workspaceId: string, query: EmailTemplateQueryDto) {
    const { page = 1, limit = 20, category } = query;
    const skip = (page - 1) * limit;

    const where = {
      workspaceId,
      deletedAt: null,
      ...(category && { category }),
    };

    const [items, total] = await Promise.all([
      this.prisma.emailTemplate.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.emailTemplate.count({ where }),
    ]);

    return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async findOneTemplate(workspaceId: string, id: string) {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!template) throw new NotFoundException('Template de email não encontrado');
    return template;
  }

  async createTemplate(workspaceId: string, dto: CreateEmailTemplateDto) {
    return this.prisma.emailTemplate.create({
      data: { ...dto, workspaceId },
    });
  }

  async updateTemplate(workspaceId: string, id: string, dto: UpdateEmailTemplateDto) {
    await this.findOneTemplate(workspaceId, id);
    return this.prisma.emailTemplate.update({
      where: { id },
      data: dto,
    });
  }

  async deleteTemplate(workspaceId: string, id: string) {
    await this.findOneTemplate(workspaceId, id);
    await this.prisma.emailTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Template removido com sucesso' };
  }

  async previewTemplate(workspaceId: string, id: string, variables: Record<string, string> = {}) {
    const template = await this.findOneTemplate(workspaceId, id);
    const subject = this.interpolate(template.subject, variables);
    const body = this.interpolate(template.body, variables);
    return { subject, body };
  }

  async sendEmail(workspaceId: string, dto: SendEmailDto) {
    let subject = dto.subject || '';
    let body = dto.body || '';

    if (dto.templateId) {
      const template = await this.findOneTemplate(workspaceId, dto.templateId);
      subject = this.interpolate(template.subject, dto.variables || {});
      body = this.interpolate(template.body, dto.variables || {});
    }

    if (!subject || !body) {
      throw new BadRequestException('Informe subject e body ou templateId');
    }

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    // Falha de SMTP é propagada para o chamador decidir (não engolir silenciosamente).
    // Sem isso, status de envio (ex.: assinatura SENT) ficava sempre verde sem entrega real.
    try {
      await this.transporter.sendMail({ from, to: dto.to, subject, html: body });
    } catch (err) {
      console.error('Falha ao enviar email (SMTP):', (err as Error).message);
      throw new ServiceUnavailableException(
        'Falha ao enviar e-mail. Verifique a configuração de SMTP do servidor.',
      );
    }

    // Registrar mensagem na conversa se fornecida (só após envio bem-sucedido)
    if (dto.conversationId) {
      await this.prisma.message.create({
        data: {
          workspaceId,
          conversationId: dto.conversationId,
          channel: 'EMAIL',
          direction: 'OUTBOUND',
          type: 'TEXT',
          body: `Assunto: ${subject}\n\n${body}`,
        },
      });
    }

    return { message: 'Email enviado com sucesso', to: dto.to, subject };
  }

  // Diagnóstico: verifica conectividade SMTP sem expor credenciais
  async verifySmtp() {
    const config = {
      host: process.env.SMTP_HOST || '(não configurado)',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER ? 'configurado' : 'NÃO configurado',
      from: process.env.SMTP_FROM ? 'configurado' : 'NÃO configurado',
    };
    try {
      await this.transporter.verify();
      return { ok: true, message: 'Conexão SMTP bem-sucedida.', config };
    } catch (err) {
      return { ok: false, message: (err as Error).message, config };
    }
  }

  private interpolate(text: string, vars: Record<string, string>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
  }
}
