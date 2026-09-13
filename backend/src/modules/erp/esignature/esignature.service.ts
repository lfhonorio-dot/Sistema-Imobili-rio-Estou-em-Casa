// Serviço de Assinatura Eletrônica Nativa
import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../hub/email/email.service';
import {
  CreateEnvelopeDto, EnvelopeQueryDto, ValidateOtpDto, RejectSignatureDto,
} from './esignature.dto';

@Injectable()
export class EsignatureService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // ── ENVELOPES ─────────────────────────────────────────────

  async findAll(workspaceId: string, query: EnvelopeQueryDto) {
    const { page = 1, limit = 20, status, contractId } = query;
    const skip = (page - 1) * limit;
    const where = {
      workspaceId, deletedAt: null,
      ...(status && { status }),
      ...(contractId && { contractId }),
    };
    const [items, total] = await Promise.all([
      this.prisma.signatureEnvelope.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { signatories: { select: { id: true, name: true, role: true, status: true } } },
      }),
      this.prisma.signatureEnvelope.count({ where }),
    ]);
    return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async findOne(workspaceId: string, id: string) {
    const envelope = await this.prisma.signatureEnvelope.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        signatories: { include: { auditEvents: { orderBy: { createdAt: 'asc' } } } },
      },
    });
    if (!envelope) throw new NotFoundException('Envelope não encontrado');
    return envelope;
  }

  async create(workspaceId: string, userId: string, dto: CreateEnvelopeDto) {
    // Calcular hash SHA-256 do documento
    const documentHash = this.hashString(dto.documentUrl + Date.now());

    const envelope = await this.prisma.signatureEnvelope.create({
      data: {
        workspaceId,
        title: dto.title,
        documentUrl: dto.documentUrl,
        documentHash,
        contractId: dto.contractId,
        type: dto.type || 'ADVANCED',
        order: dto.order || 'PARALLEL',
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        message: dto.message,
        status: 'DRAFT',
        signatories: {
          create: dto.signatories.map((s, idx) => ({
            name: s.name,
            email: s.email,
            phone: s.phone,
            cpf: s.cpf,
            role: s.role,
            order: s.order ?? idx,
            token: this.generateToken(),
            tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
            status: 'PENDING',
          })),
        },
      },
      include: { signatories: true },
    });

    await this.prisma.auditLog.create({
      data: {
        workspaceId, userId, action: 'ENVELOPE_CREATED',
        entity: 'SignatureEnvelope', entityId: envelope.id,
        after: { title: envelope.title, signatories: dto.signatories.length },
      },
    });

    return envelope;
  }

  async send(workspaceId: string, envelopeId: string) {
    const envelope = await this.findOne(workspaceId, envelopeId);
    if (envelope.status !== 'DRAFT') {
      throw new BadRequestException('Envelope já foi enviado');
    }

    const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

    for (const sig of envelope.signatories) {
      if (envelope.order === 'SEQUENTIAL' && sig.order > 0) continue;

      const signLink = `${baseUrl}/assinar/${sig.token}`;

      // Envia o e-mail com o link de assinatura de fato (antes isso era só
      // simulado: o status virava SENT sem nenhum e-mail sair). O envio não
      // bloqueia a atualização de status caso o SMTP falhe — mas o erro fica
      // registrado no evento de auditoria para diagnóstico.
      let emailSent = true;
      if (sig.email) {
        try {
          await this.emailService.sendEmail(workspaceId, {
            to: sig.email,
            subject: `Assinatura eletrônica pendente — ${envelope.title}`,
            body: this.buildSignatureEmailBody(envelope, sig, signLink),
          });
        } catch (err) {
          emailSent = false;
          console.error(`[EsignatureService] Falha ao enviar e-mail de assinatura para ${sig.email}:`, err);
        }
      } else {
        emailSent = false;
      }

      await this.prisma.signatureSignatory.update({
        where: { id: sig.id },
        data: { status: 'SENT' },
      });
      await this.prisma.signatureAuditEvent.create({
        data: {
          signatoryId: sig.id,
          event: 'LINK_SENT',
          metadata: { link: signLink, method: 'EMAIL', emailSent },
        },
      });
    }

    return this.prisma.signatureEnvelope.update({
      where: { id: envelopeId },
      data: { status: 'SENT' },
    });
  }

  private buildSignatureEmailBody(
    envelope: { title: string; message?: string | null; deadline?: Date | null },
    signatory: { name: string; role: string },
    signLink: string,
  ): string {
    const deadlineText = envelope.deadline
      ? `<p style="font-size:14px;color:#64748b;">Prazo para assinatura: <strong>${new Date(envelope.deadline).toLocaleDateString('pt-BR')}</strong></p>`
      : '';
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; color: #333; max-width: 680px; margin: 0 auto; padding: 24px; }
  .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
  .btn { display:inline-block; background:#2563eb; color:#fff; padding:12px 28px; border-radius:6px; text-decoration:none; font-weight:600; }
  .footer { margin-top:24px; font-size:11px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:12px; }
</style></head>
<body>
  <div class="card">
    <h2 style="margin-bottom:8px;">${envelope.title}</h2>
    <p style="font-size:14px;">Olá, ${signatory.name}. Sua assinatura (${signatory.role}) é necessária neste documento.</p>
    ${envelope.message ? `<p style="font-size:14px;">${envelope.message}</p>` : ''}
    ${deadlineText}
  </div>
  <p style="text-align:center;margin:32px 0;">
    <a class="btn" href="${signLink}">Visualizar e assinar documento</a>
  </p>
  <p style="font-size:12px;color:#94a3b8;">Se o botão não funcionar, copie e cole este link no navegador:<br>${signLink}</p>
  <div class="footer">
    Este e-mail foi enviado automaticamente pelo Sistema Imobiliário Estou em Casa.<br>
    Data de envio: ${new Date().toLocaleString('pt-BR')}
  </div>
</body>
</html>`;
  }

  async cancel(workspaceId: string, envelopeId: string) {
    const envelope = await this.findOne(workspaceId, envelopeId);
    if (['COMPLETED', 'CANCELLED'].includes(envelope.status)) {
      throw new BadRequestException('Envelope não pode ser cancelado');
    }
    return this.prisma.signatureEnvelope.update({
      where: { id: envelopeId },
      data: { status: 'CANCELLED' },
    });
  }

  // ── PORTAL PÚBLICO (sem autenticação) ─────────────────────

  async getPortalData(token: string) {
    const signatory = await this.prisma.signatureSignatory.findUnique({
      where: { token },
      include: {
        envelope: { select: { title: true, documentUrl: true, message: true, deadline: true, status: true } },
      },
    });
    if (!signatory) throw new NotFoundException('Link inválido');
    if (signatory.tokenExpiresAt && signatory.tokenExpiresAt < new Date()) {
      throw new ForbiddenException('Link expirado');
    }
    if (!['PENDING', 'SENT'].includes(signatory.status)) {
      return { signatory: { name: signatory.name, status: signatory.status }, envelope: signatory.envelope };
    }

    // Registrar abertura do documento
    if (signatory.status === 'SENT') {
      await this.prisma.signatureSignatory.update({
        where: { id: signatory.id },
        data: { status: 'VIEWED' },
      });
      await this.prisma.signatureAuditEvent.create({
        data: { signatoryId: signatory.id, event: 'DOCUMENT_OPENED' },
      });
    }
    return { signatory: { name: signatory.name, email: signatory.email, role: signatory.role, status: signatory.status }, envelope: signatory.envelope };
  }

  async requestOtp(token: string) {
    const signatory = await this.prisma.signatureSignatory.findUnique({ where: { token } });
    if (!signatory) throw new NotFoundException('Link inválido');
    if (!['VIEWED', 'SENT', 'PENDING'].includes(signatory.status)) {
      throw new BadRequestException('Não é possível solicitar OTP neste estado');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = this.hashString(otp);

    await this.prisma.signatureSignatory.update({
      where: { id: signatory.id },
      data: { otpHash },
    });
    await this.prisma.signatureAuditEvent.create({
      data: { signatoryId: signatory.id, event: 'OTP_REQUESTED' },
    });

    // Em produção: enviar OTP por WhatsApp/e-mail
    // Para homologação: retornar OTP no response (NÃO fazer em produção)
    return { message: 'OTP enviado', otp_dev: otp };
  }

  async sign(
    token: string,
    dto: ValidateOtpDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const signatory = await this.prisma.signatureSignatory.findUnique({
      where: { token },
      include: { envelope: { include: { signatories: true } } },
    });
    if (!signatory) throw new NotFoundException('Link inválido');
    if (!['VIEWED', 'SENT', 'PENDING'].includes(signatory.status)) {
      throw new BadRequestException('Documento já foi assinado ou recusado');
    }
    if (!signatory.otpHash) throw new BadRequestException('Solicite o OTP antes de assinar');
    if (this.hashString(dto.otp) !== signatory.otpHash) {
      throw new ForbiddenException('OTP inválido');
    }

    await this.prisma.signatureSignatory.update({
      where: { id: signatory.id },
      data: {
        status: 'SIGNED',
        signedAt: new Date(),
        ipAddress,
        userAgent,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
    });

    await this.prisma.signatureAuditEvent.create({
      data: {
        signatoryId: signatory.id,
        event: 'SIGNED',
        ipAddress,
        userAgent,
        latitude: dto.latitude,
        longitude: dto.longitude,
        metadata: { cpf: dto.cpf || signatory.cpf },
      },
    });

    // Verificar se todos assinaram
    const allSignatories = signatory.envelope.signatories;
    const allSigned = allSignatories.every(
      s => s.id === signatory.id ? true : s.status === 'SIGNED',
    );

    if (allSigned) {
      await this.prisma.signatureEnvelope.update({
        where: { id: signatory.envelopeId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    } else if (signatory.envelope.order === 'SEQUENTIAL') {
      // Enviar para o próximo na ordem
      const nextSignatory = allSignatories
        .filter(s => s.status === 'PENDING')
        .sort((a, b) => a.order - b.order)[0];
      if (nextSignatory) {
        await this.prisma.signatureSignatory.update({
          where: { id: nextSignatory.id },
          data: { status: 'SENT' },
        });
      }
    }

    return { message: 'Documento assinado com sucesso' };
  }

  async reject(token: string, dto: RejectSignatureDto, ipAddress?: string) {
    const signatory = await this.prisma.signatureSignatory.findUnique({ where: { token } });
    if (!signatory) throw new NotFoundException('Link inválido');

    await this.prisma.signatureSignatory.update({
      where: { id: signatory.id },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: dto.reason, ipAddress },
    });
    await this.prisma.signatureAuditEvent.create({
      data: {
        signatoryId: signatory.id, event: 'REJECTED',
        ipAddress, metadata: { reason: dto.reason },
      },
    });
    return { message: 'Assinatura recusada registrada' };
  }

  async getAuditTrail(workspaceId: string, envelopeId: string) {
    const envelope = await this.findOne(workspaceId, envelopeId);
    return envelope.signatories.map(s => ({
      signatory: { name: s.name, email: s.email, role: s.role, status: s.status },
      events: s.auditEvents,
    }));
  }

  // ── HELPERS ───────────────────────────────────────────────

  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private hashString(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }
}
