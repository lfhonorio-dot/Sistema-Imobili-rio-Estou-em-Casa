// Serviço de Assinatura Eletrônica Nativa
import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../hub/email/email.service';
import { ContractTemplateService } from '../contracts/contract-template.service';
import {
  CreateEnvelopeDto, EnvelopeQueryDto, ValidateOtpDto, RejectSignatureDto,
} from './esignature.dto';

@Injectable()
export class EsignatureService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private contractTemplate: ContractTemplateService,
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
    // Hash SHA-256 do CONTEÚDO real do documento (garantia de imutabilidade).
    // Antes era um hash de "documentUrl + Date.now()" — decorativo, nunca
    // detectava alteração nenhuma no conteúdo do contrato/documento.
    const documentHash = await this.computeDocumentHash(workspaceId, dto.contractId, dto.documentUrl);

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

    // Envia o e-mail com o link de assinatura para cada signatário (mesmo
    // padrão de requestSignature() em contracts.service.ts e de requestOtp()
    // abaixo). Antes, este método só simulava o envio — marcava tudo como
    // SENT e gravava um evento de auditoria fabricado, sem nunca chamar o
    // EmailService, então nenhum e-mail saía de fato.
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const deadlineDate = envelope.deadline
      ? new Date(envelope.deadline).toLocaleDateString('pt-BR')
      : null;

    let sentCount = 0;
    for (const sig of envelope.signatories) {
      if (envelope.order === 'SEQUENTIAL' && sig.order > 0) continue;

      const signLink = `${appUrl}/sign/${sig.token}`;
      const emailBody = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#1d4ed8">Assinatura Eletrônica Solicitada</h2>
          <p>Olá, <strong>${sig.name}</strong>!</p>
          <p>Você foi solicitado(a) a assinar o seguinte documento:</p>
          <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:16px 0">
            <strong>${envelope.title}</strong><br/>
            ${envelope.message ?? ''}
          </div>
          ${deadlineDate ? `<p><strong>Prazo para assinatura:</strong> ${deadlineDate}</p>` : ''}
          <p style="margin:24px 0">
            <a href="${signLink}"
               style="background:#1d4ed8;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
              Assinar Documento
            </a>
          </p>
          <p style="color:#6b7280;font-size:13px">
            Ou acesse pelo link: <a href="${signLink}">${signLink}</a>
          </p>
        </div>
      `;

      let emailSent = false;
      try {
        await this.emailService.sendEmail(workspaceId, {
          to: sig.email,
          subject: `[Assinatura Pendente] ${envelope.title}`,
          body: emailBody,
        });
        emailSent = true;
      } catch (e) {
        console.error(`[EsignatureService] Falha ao enviar e-mail de assinatura para ${sig.email}:`, (e as Error).message);
      }

      if (emailSent) {
        sentCount++;
        await this.prisma.signatureSignatory.update({
          where: { id: sig.id },
          data: { status: 'SENT' },
        });
      }
      await this.prisma.signatureAuditEvent.create({
        data: {
          signatoryId: sig.id,
          event: emailSent ? 'LINK_SENT' : 'LINK_SEND_FAILED',
          metadata: { link: signLink, method: 'EMAIL', delivered: emailSent },
        },
      });
    }

    // Só marca o envelope como SENT se pelo menos um e-mail foi entregue de
    // verdade — senão fica DRAFT e o erro abaixo avisa o usuário, em vez de
    // fingir sucesso (mesma regra usada em requestSignature()).
    if (sentCount === 0) {
      throw new BadRequestException(
        'Nenhum e-mail de assinatura pôde ser enviado. Verifique a configuração de SMTP do servidor.',
      );
    }

    return this.prisma.signatureEnvelope.update({
      where: { id: envelopeId },
      data: { status: 'SENT' },
    });
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
    const signatory = await this.prisma.signatureSignatory.findUnique({
      where: { token },
      include: { envelope: { select: { workspaceId: true, title: true } } },
    });
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

    // Envia o código por e-mail ao signatário
    const otpEmail = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;text-align:center">
        <h2 style="color:#1d4ed8">Código de Assinatura</h2>
        <p>Olá, <strong>${signatory.name}</strong>! Use o código abaixo para concluir a assinatura de:</p>
        <p style="color:#374151"><strong>${signatory.envelope.title}</strong></p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#111827;background:#f3f4f6;border-radius:8px;padding:16px;margin:16px 0">
          ${otp}
        </div>
        <p style="color:#9ca3af;font-size:12px">Código válido por tempo limitado. Não compartilhe com ninguém.</p>
      </div>
    `;

    let emailSent = false;
    try {
      await this.emailService.sendEmail(signatory.envelope.workspaceId, {
        to: signatory.email,
        subject: `Seu código de assinatura: ${otp}`,
        body: otpEmail,
      });
      emailSent = true;
    } catch (e) {
      console.error(`[EsignatureService] Falha ao enviar OTP para ${signatory.email}:`, (e as Error).message);
    }

    // Em produção o código nunca é retornado na resposta — apenas por e-mail.
    // Em dev/homologação retorna otp_dev para facilitar os testes.
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd && !emailSent) {
      throw new BadRequestException('Não foi possível enviar o código por e-mail. Tente novamente mais tarde.');
    }

    return isProd
      ? { message: 'Código enviado para o seu e-mail.' }
      : { message: 'OTP enviado', otp_dev: otp };
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

  // Calcula o hash sobre o conteúdo real do documento, não sobre a URL:
  // - se o envelope está ligado a um contrato, usa o HTML gerado pelo
  //   template (mesmo conteúdo que será mostrado/assinado);
  // - senão, se documentUrl é um link http(s) de verdade, baixa o conteúdo
  //   e hasheia os bytes recebidos;
  // - como último recurso (documentUrl que não é uma URL buscável), hasheia
  //   a própria string — pior que os dois casos acima, mas ainda determinístico
  //   (sem timestamp misturado, que tornava o hash decorativo).
  private async computeDocumentHash(
    workspaceId: string,
    contractId?: string,
    documentUrl?: string,
  ): Promise<string> {
    if (contractId) {
      const html = await this.contractTemplate.generate(workspaceId, contractId);
      return this.hashString(html);
    }

    if (documentUrl && /^https?:\/\//i.test(documentUrl)) {
      try {
        const res = await fetch(documentUrl);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          return crypto.createHash('sha256').update(buf).digest('hex');
        }
      } catch {
        // Cai para o fallback abaixo se o download falhar.
      }
    }

    return this.hashString(documentUrl ?? '');
  }
}
