// Régua de cobrança — job diário que:
//  1. Marca como OVERDUE os recebíveis PENDING vencidos.
//  2. Envia lembrete de vencimento (3 dias antes e no dia).
//  3. Envia cobrança de atraso (1, 7 e 15 dias após o vencimento).
// Inclui a linha digitável/PIX do boleto vinculado, quando existir.
// O cron roda 1x ao dia; o disparo manual (endpoint) reenvia — usar para teste.

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../hub/email/email.service';

const OVERDUE_NOTICE_DAYS = [1, 7, 15];

function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.round(ms / 86_400_000);
}
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function brl(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

@Injectable()
export class DunningService {
  private readonly logger = new Logger(DunningService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // Todos os dias às 08:00 (America/Sao_Paulo via TZ do container)
  @Cron('0 8 * * *')
  async runDailyDunning() {
    return this.run();
  }

  async run() {
    const today = startOfDay(new Date());

    // 1) Marca vencidos como OVERDUE
    const overdueMarked = await this.prisma.financialEntry.updateMany({
      where: {
        type: 'RECEIVABLE',
        status: 'PENDING',
        deletedAt: null,
        dueDate: { lt: today },
      },
      data: { status: 'OVERDUE' },
    });

    // 2) Candidatos a notificação: a vencer nos próximos 3 dias ou vencidos há <= 15
    const from = new Date(today.getTime() - 16 * 86_400_000);
    const to = new Date(today.getTime() + 4 * 86_400_000);
    const entries = await this.prisma.financialEntry.findMany({
      where: {
        type: 'RECEIVABLE',
        status: { in: ['PENDING', 'OVERDUE'] },
        deletedAt: null,
        dueDate: { gte: from, lte: to },
        contactId: { not: null },
      },
    });

    // FinancialEntry não tem relação com Contact no schema — busca em lote
    const contactIds = [...new Set(entries.map((e) => e.contactId).filter(Boolean))] as string[];
    const contacts = await this.prisma.contact.findMany({
      where: { id: { in: contactIds } },
      select: { id: true, name: true, email: true },
    });
    const contactById = new Map(contacts.map((c) => [c.id, c]));

    let reminders = 0;
    let notices = 0;

    for (const entry of entries) {
      const contact = entry.contactId ? contactById.get(entry.contactId) : undefined;
      const email = contact?.email ?? null;
      if (!email) continue;

      const diff = daysBetween(startOfDay(entry.dueDate), today); // >0 a vencer, <0 vencido
      const isReminder = diff === 3 || diff === 0;
      const isOverdueNotice = diff < 0 && OVERDUE_NOTICE_DAYS.includes(-diff);
      if (!isReminder && !isOverdueNotice) continue;

      const boleto = await this.prisma.boleto.findFirst({
        where: { financialEntryId: entry.id, deletedAt: null, status: { notIn: ['CANCELLED', 'PAID'] } },
        select: { linhaDigitavel: true, pixCopiaECola: true, bankSlipUrl: true },
      });

      const dueStr = entry.dueDate.toLocaleDateString('pt-BR');
      const valorStr = brl(Number(entry.amount));
      const subject = isReminder
        ? diff === 0
          ? `Vence hoje: ${entry.description ?? 'cobrança'} — ${valorStr}`
          : `Lembrete: ${entry.description ?? 'cobrança'} vence em 3 dias`
        : `Pagamento em atraso (${-diff} dia${-diff > 1 ? 's' : ''}): ${entry.description ?? 'cobrança'}`;

      const paymentBlock = boleto
        ? `${boleto.linhaDigitavel ? `<p><strong>Linha digitável:</strong><br/><code>${boleto.linhaDigitavel}</code></p>` : ''}
           ${boleto.pixCopiaECola ? `<p><strong>PIX copia e cola:</strong><br/><code style="word-break:break-all">${boleto.pixCopiaECola}</code></p>` : ''}
           ${boleto.bankSlipUrl ? `<p><a href="${boleto.bankSlipUrl}">Abrir boleto (PDF)</a></p>` : ''}`
        : '';

      const body = `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <h2 style="color:${isOverdueNotice ? '#b91c1c' : '#1d4ed8'}">${isOverdueNotice ? 'Pagamento em atraso' : 'Lembrete de vencimento'}</h2>
          <p>Olá, <strong>${contact?.name ?? ''}</strong>!</p>
          <p>${entry.description ?? 'Cobrança'}</p>
          <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:16px 0">
            <p style="margin:0"><strong>Valor:</strong> ${valorStr}</p>
            <p style="margin:0"><strong>Vencimento:</strong> ${dueStr}</p>
          </div>
          ${paymentBlock}
          <p style="color:#9ca3af;font-size:12px">Se o pagamento já foi efetuado, por favor desconsidere este aviso.</p>
        </div>`;

      try {
        await this.emailService.sendEmail(entry.workspaceId, { to: email, subject, body });
        if (isReminder) reminders++;
        else notices++;
      } catch (e) {
        this.logger.warn(`Falha ao enviar cobrança do lançamento ${entry.id}: ${(e as Error).message}`);
      }
    }

    const summary = { overdueMarked: overdueMarked.count, reminders, overdueNotices: notices };
    this.logger.log(`Régua de cobrança: ${JSON.stringify(summary)}`);
    return summary;
  }
}
