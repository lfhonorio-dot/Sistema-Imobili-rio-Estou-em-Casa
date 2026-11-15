// Fase 7 — notificações reais (sino + e-mail).
//
// Uma rotina a cada 5 minutos procura os acontecimentos abaixo e avisa as
// pessoas certas. Cada aviso tem uma chave anti-duplicação (dedupeKey): o
// mesmo acontecimento nunca gera dois avisos para a mesma pessoa.
//
//   LEAD_NEW            lead novo (negócio criado)        → corretor do negócio (ou gerência)
//   VISIT_TODAY         visita marcada para hoje           → corretor da visita
//   TASK_DUE            tarefa vencendo (24h) ou vencida   → dono da tarefa
//   PROPOSAL_STALE      proposta sem resposta há 3+ dias   → corretor do negócio
//   INSTALLMENT_OVERDUE parcela a receber vencida          → financeiro e dono
//   AUTH_EXPIRING       autorização de venda vence em 15d  → captador e gerência
//   NFSE_REJECTED       nota fiscal rejeitada / com falha  → financeiro e dono
//
// E-mail: só quando a pessoa deixou ligado (geral e por tipo). A situação do
// envio fica gravada no aviso (SENT / FAILED com o motivo / SKIPPED).

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { roleKeyOf, type RoleKey } from '../../../common/access/access';

export const NOTIFICATION_TYPES = {
  LEAD_NEW: 'Lead novo',
  VISIT_TODAY: 'Visita no dia',
  TASK_DUE: 'Tarefa vencendo',
  PROPOSAL_STALE: 'Proposta sem resposta',
  INSTALLMENT_OVERDUE: 'Parcela vencida',
  AUTH_EXPIRING: 'Autorização de venda expirando',
  NFSE_REJECTED: 'Nota fiscal rejeitada',
} as const;
export type NotificationType = keyof typeof NOTIFICATION_TYPES;

interface Member { memberId: string; userId: string; roleKey: RoleKey; email: string; name: string; emailOn: boolean }

export interface NotifyInput {
  workspaceId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  entityType?: string;
  entityId?: string;
  dedupeKey: string;
}

const TZ = 'America/Sao_Paulo';
const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ }); // AAAA-MM-DD no fuso de SP
const dmy = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: TZ });
const hm = (d: Date) => d.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Início e fim do "hoje" no fuso de São Paulo (em UTC). */
export function todayRange(now = new Date()) {
  const k = dayKey(now);
  // SP não tem horário de verão desde 2019: UTC-3
  const start = new Date(`${k}T03:00:00.000Z`);
  return { start, end: new Date(start.getTime() + 86_400_000 - 1), key: k };
}

@Injectable()
export class NotificationRulesService {
  private readonly logger = new Logger(NotificationRulesService.name);
  private running = false;

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  private async members(workspaceId: string): Promise<Member[]> {
    const ms = await this.prisma.workspaceUser.findMany({
      where: { workspaceId, user: { deletedAt: null } },
      select: { id: true, userId: true, isOwner: true, emailNotifications: true, role: { select: { systemKey: true } }, user: { select: { email: true, name: true } } },
    });
    return ms.map((m) => ({ memberId: m.id, userId: m.userId, roleKey: roleKeyOf(m.role, m.isOwner), email: m.user.email, name: m.user.name, emailOn: m.emailNotifications }));
  }

  /** Cria o aviso (uma vez) e envia o e-mail quando a pessoa quer. Devolve true se criou. */
  async notify(input: NotifyInput, member?: Member): Promise<boolean> {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { workspaceId_userId_type: { workspaceId: input.workspaceId, userId: input.userId, type: input.type } },
    });
    if (pref && !pref.inApp && !pref.email) return false;
    let created;
    try {
      created = await this.prisma.notification.create({
        data: {
          workspaceId: input.workspaceId, userId: input.userId, type: input.type, title: input.title, body: input.body,
          link: input.link, entityType: input.entityType, entityId: input.entityId, dedupeKey: input.dedupeKey,
          // aviso só por e-mail (sino desligado) fica marcado como lido
          ...(pref && !pref.inApp && { readAt: new Date() }),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return false; // já avisado
      throw e;
    }
    const wantsEmail = (member?.emailOn ?? true) && (pref ? pref.email : true);
    let emailStatus = 'SKIPPED';
    let emailError: string | null = null;
    if (wantsEmail && member?.email) {
      if (!process.env.SMTP_HOST && !process.env.SMTP_USER) {
        emailError = 'E-mail do sistema (SMTP) não configurado.';
      } else {
        try {
          await this.email.sendEmail(input.workspaceId, {
            to: member.email,
            subject: `${input.title}`,
            body: `<p>${input.body}</p>${input.link ? `<p>Abra no sistema: ${input.link}</p>` : ''}<p style="color:#888">Você pode desligar este aviso em Configurações → Notificações.</p>`,
          } as never);
          emailStatus = 'SENT';
        } catch (e) {
          emailStatus = 'FAILED';
          emailError = (e as Error).message;
        }
      }
    }
    await this.prisma.notification.update({ where: { id: created.id }, data: { emailStatus, emailError } });
    return true;
  }

  private async notifyMany(workspaceId: string, targets: Member[], base: Omit<NotifyInput, 'workspaceId' | 'userId'>) {
    let n = 0;
    const seen = new Set<string>();
    for (const m of targets) {
      if (seen.has(m.userId)) continue;
      seen.add(m.userId);
      if (await this.notify({ ...base, workspaceId, userId: m.userId }, m)) n++;
    }
    return n;
  }

  @Cron('*/5 * * * *', { name: 'notification-rules' })
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const workspaces = await this.prisma.workspace.findMany({ where: { deletedAt: null }, select: { id: true } });
      let total = 0;
      for (const w of workspaces) total += await this.runFor(w.id);
      if (total) this.logger.log(`Notificações: ${total} aviso(s) criado(s).`);
    } catch (e) {
      this.logger.error(`Rotina de notificações falhou: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /** Roda todas as regras para uma imobiliária. Devolve quantos avisos criou. */
  async runFor(workspaceId: string, now = new Date()): Promise<number> {
    const ms = await this.members(workspaceId);
    if (!ms.length) return 0;
    const byMember = new Map(ms.map((m) => [m.memberId, m]));
    const byUser = new Map(ms.map((m) => [m.userId, m]));
    const role = (...keys: RoleKey[]) => ms.filter((m) => keys.includes(m.roleKey));
    const today = todayRange(now);
    let n = 0;

    // 1. Lead novo (últimas 24h)
    const deals = await this.prisma.deal.findMany({
      where: { workspaceId, deletedAt: null, createdAt: { gte: new Date(now.getTime() - 86_400_000) } },
      select: { id: true, title: true, assigneeId: true, contact: { select: { name: true } } },
    });
    for (const d of deals) {
      const owner = d.assigneeId ? byMember.get(d.assigneeId) : undefined;
      n += await this.notifyMany(workspaceId, owner ? [owner] : role('ADMIN', 'MANAGER'), {
        type: 'LEAD_NEW', title: `Lead novo: ${d.contact?.name ?? d.title}`,
        body: owner ? `O negócio "${d.title}" foi atribuído a você.` : `O negócio "${d.title}" entrou sem corretor responsável.`,
        link: `/deals/${d.id}`, entityType: 'Deal', entityId: d.id, dedupeKey: `lead:${d.id}`,
      });
    }

    // 2. Visitas de hoje
    const visits = await this.prisma.visit.findMany({
      where: { workspaceId, deletedAt: null, status: 'SCHEDULED', scheduledAt: { gte: today.start, lte: today.end }, brokerId: { not: null } },
      select: { id: true, scheduledAt: true, brokerId: true, property: { select: { code: true, street: true } }, contact: { select: { name: true } } },
    });
    for (const v of visits) {
      const b = byMember.get(v.brokerId!);
      if (!b) continue;
      n += await this.notifyMany(workspaceId, [b], {
        type: 'VISIT_TODAY', title: `Visita hoje às ${hm(v.scheduledAt)}`,
        body: `Imóvel ${v.property?.code ?? ''}${v.property?.street ? ` (${v.property.street})` : ''}${v.contact?.name ? ` com ${v.contact.name}` : ''}.`,
        link: '/visits', entityType: 'Visit', entityId: v.id, dedupeKey: `visit:${v.id}:${today.key}`,
      });
    }

    // 3. Tarefas vencendo nas próximas 24h ou vencidas (avisa uma vez por dia)
    const tasks = await this.prisma.activity.findMany({
      where: { workspaceId, deletedAt: null, doneAt: null, userId: { not: null }, type: { not: 'VISIT' }, dueAt: { lte: new Date(now.getTime() + 86_400_000) } },
      select: { id: true, title: true, dueAt: true, userId: true },
      take: 500,
    });
    for (const t of tasks) {
      const u = byUser.get(t.userId!);
      if (!u || !t.dueAt) continue;
      const late = t.dueAt < now;
      n += await this.notifyMany(workspaceId, [u], {
        type: 'TASK_DUE', title: late ? `Tarefa vencida: ${t.title}` : `Tarefa vence ${dmy(t.dueAt) === dmy(now) ? 'hoje' : 'amanhã'}: ${t.title}`,
        body: `Prazo: ${dmy(t.dueAt)} ${hm(t.dueAt)}.`, link: '/tasks', entityType: 'Activity', entityId: t.id, dedupeKey: `task:${t.id}:${today.key}`,
      });
    }

    // 4. Propostas sem resposta há 3 dias ou mais
    const proposals = await this.prisma.proposal.findMany({
      where: { workspaceId, deletedAt: null, status: 'OPEN', updatedAt: { lte: new Date(now.getTime() - 3 * 86_400_000) } },
      select: { id: true, amount: true, dealId: true, deal: { select: { title: true, assigneeId: true } } },
    });
    for (const p of proposals) {
      const owner = p.deal.assigneeId ? byMember.get(p.deal.assigneeId) : undefined;
      n += await this.notifyMany(workspaceId, owner ? [owner] : role('ADMIN', 'MANAGER'), {
        type: 'PROPOSAL_STALE', title: `Proposta sem resposta: ${p.deal.title}`,
        body: `Proposta de ${brl(Number(p.amount ?? 0))} parada há 3 dias ou mais.`, link: `/deals/${p.dealId}`,
        entityType: 'Proposal', entityId: p.id, dedupeKey: `proposal:${p.id}`,
      });
    }

    // 5. Parcelas a receber vencidas
    const overdue = await this.prisma.financialEntry.findMany({
      where: { workspaceId, deletedAt: null, type: 'RECEIVABLE', status: { in: ['PENDING', 'OVERDUE'] }, dueDate: { lt: today.start } },
      select: { id: true, description: true, amount: true, paidAmount: true, dueDate: true },
      take: 200,
    });
    for (const e of overdue) {
      n += await this.notifyMany(workspaceId, role('ADMIN', 'FINANCE'), {
        type: 'INSTALLMENT_OVERDUE', title: `Parcela vencida: ${e.description}`,
        body: `${brl(Number(e.amount) - Number(e.paidAmount ?? 0))} venceu em ${dmy(e.dueDate)}.`, link: '/financial?tab=overdue',
        entityType: 'FinancialEntry', entityId: e.id, dedupeKey: `overdue:${e.id}`,
      });
    }

    // 6. Autorizações de venda vencendo em até 15 dias
    const auths = await this.prisma.propertyAuthorization.findMany({
      where: { workspaceId, deletedAt: null, status: 'ACTIVE', validUntil: { gte: today.start, lte: new Date(now.getTime() + 15 * 86_400_000) } },
      select: { id: true, validUntil: true, captorUserId: true, propertyId: true, property: { select: { code: true, status: true } } },
    });
    for (const a of auths) {
      if (['SOLD', 'INACTIVE'].includes(a.property.status)) continue;
      const captor = a.captorUserId ? byMember.get(a.captorUserId) : undefined;
      n += await this.notifyMany(workspaceId, [...(captor ? [captor] : []), ...role('ADMIN', 'MANAGER')], {
        type: 'AUTH_EXPIRING', title: `Autorização de venda vence em ${dmy(a.validUntil)}`,
        body: `Imóvel ${a.property.code}: renove a autorização com o proprietário.`, link: `/properties/${a.propertyId}`,
        entityType: 'PropertyAuthorization', entityId: a.id, dedupeKey: `auth:${a.id}:${a.validUntil.toISOString().slice(0, 10)}`,
      });
    }

    // 7. Notas fiscais rejeitadas / com falha
    const nfs = await this.prisma.nfseRecord.findMany({
      where: { workspaceId, deletedAt: null, status: { in: ['REJECTED', 'ERROR'] }, updatedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } },
      select: { id: true, takerName: true, rejectionReason: true, retryCount: true, status: true, createdById: true, updatedAt: true },
    });
    for (const nf of nfs) {
      const creator = nf.createdById ? byUser.get(nf.createdById) : undefined;
      n += await this.notifyMany(workspaceId, [...(creator ? [creator] : []), ...role('ADMIN', 'FINANCE')], {
        type: 'NFSE_REJECTED', title: `Nota fiscal ${nf.status === 'ERROR' ? 'com falha' : 'rejeitada'}: ${nf.takerName}`,
        body: (nf.rejectionReason ?? 'Veja o motivo na tela de notas fiscais.').slice(0, 400), link: '/fiscal?tab=nfse',
        entityType: 'NfseRecord', entityId: nf.id, dedupeKey: `nfse:${nf.id}:${nf.status}:${nf.updatedAt.toISOString()}`,
      });
    }
    return n;
  }
}
