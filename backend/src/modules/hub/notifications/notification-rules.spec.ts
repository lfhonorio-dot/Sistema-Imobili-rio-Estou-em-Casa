import { Prisma } from '@prisma/client';
import { NotificationRulesService, todayRange } from './notification-rules.service';

// Fase 7 — avisos: um por acontecimento, e-mail com situação gravada.

function setup(opts: { pref?: Record<string, boolean> | null; createError?: Error; emailError?: Error } = {}) {
  const updates: Array<Record<string, unknown>> = [];
  const prisma = {
    notificationPreference: { findUnique: jest.fn().mockResolvedValue(opts.pref ?? null) },
    notification: {
      create: opts.createError ? jest.fn().mockRejectedValue(opts.createError) : jest.fn().mockResolvedValue({ id: 'n1' }),
      update: jest.fn((a: { data: Record<string, unknown> }) => { updates.push(a.data); return Promise.resolve({}); }),
    },
  };
  const email = { sendEmail: opts.emailError ? jest.fn().mockRejectedValue(opts.emailError) : jest.fn().mockResolvedValue({}) };
  return { svc: new NotificationRulesService(prisma as never, email as never), prisma, email, updates };
}
const input = { workspaceId: 'w', userId: 'u', type: 'LEAD_NEW' as const, title: 'Lead novo: Ana', body: 'x', dedupeKey: 'lead:1' };
const member = { memberId: 'm', userId: 'u', roleKey: 'BROKER' as const, email: 'a@b.c', name: 'A', emailOn: true };

describe('notificações (Fase 7)', () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });

  it('"hoje" no fuso de São Paulo', () => {
    const r = todayRange(new Date('2026-11-14T02:00:00Z')); // 23h do dia 13 em SP
    expect(r.key).toBe('2026-11-13');
    expect(r.start.toISOString()).toBe('2026-11-13T03:00:00.000Z');
  });

  it('mesmo acontecimento não gera aviso duplicado', async () => {
    const { svc, email } = setup({ createError: new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }) });
    expect(await svc.notify(input, member)).toBe(false);
    expect(email.sendEmail).not.toHaveBeenCalled();
  });

  it('envia e-mail e grava SENT', async () => {
    process.env.SMTP_HOST = 'smtp.teste';
    const { svc, updates, email } = setup();
    expect(await svc.notify(input, member)).toBe(true);
    expect(email.sendEmail).toHaveBeenCalled();
    expect(updates[0]).toEqual({ emailStatus: 'SENT', emailError: null });
  });

  it('falha de e-mail fica registrada (FAILED com motivo), o aviso no sino continua', async () => {
    process.env.SMTP_HOST = 'smtp.teste';
    const { svc, updates } = setup({ emailError: new Error('Falha ao enviar e-mail.') });
    expect(await svc.notify(input, member)).toBe(true);
    expect(updates[0]).toEqual({ emailStatus: 'FAILED', emailError: 'Falha ao enviar e-mail.' });
  });

  it('sem SMTP configurado: não finge que enviou', async () => {
    delete process.env.SMTP_HOST; delete process.env.SMTP_USER;
    const { svc, updates, email } = setup();
    await svc.notify(input, member);
    expect(email.sendEmail).not.toHaveBeenCalled();
    expect(updates[0]).toMatchObject({ emailStatus: 'SKIPPED', emailError: expect.stringMatching(/SMTP/) });
  });

  it('respeita preferências: tipo desligado não gera aviso; e-mail desligado não envia', async () => {
    const off = setup({ pref: { inApp: false, email: false } });
    expect(await off.svc.notify(input, member)).toBe(false);
    process.env.SMTP_HOST = 'smtp.teste';
    const noMail = setup({ pref: { inApp: true, email: false } });
    await noMail.svc.notify(input, member);
    expect(noMail.email.sendEmail).not.toHaveBeenCalled();
    expect(noMail.updates[0]).toMatchObject({ emailStatus: 'SKIPPED' });
  });
});
