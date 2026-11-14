// Fase 5 — motor de baixas (recebimentos e pagamentos).
//
// Tudo que liquida um lançamento passa por aqui: baixa manual, webhook do
// gateway (boleto/PIX) e conciliação bancária. Cada baixa vira um registro em
// financial_payments, numa transação atômica com o lançamento travado
// (SELECT ... FOR UPDATE), para dois recebimentos simultâneos não baixarem o
// mesmo saldo duas vezes.
//
// FinancialEntry.paidAmount = soma do PRINCIPAL das baixas ativas (quanto do
// valor já foi quitado). O dinheiro que entrou/saiu (com juros/multa/desconto)
// está em FinancialPayment.total — é ele que alimenta o fluxo de caixa e o DRE.

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService, UploadedFileInput } from '../../files/files.service';
import { entryStatusAfter, fromCents, paymentTotal, suggestLateCharges, toCents } from './settlement-math';

type Tx = Prisma.TransactionClient;

export interface RegisterPaymentInput {
  principal?: number;
  interest?: number;
  fine?: number;
  discount?: number;
  paidAt?: string | Date;
  method?: string;
  bankAccountId?: string | null;
  receiptFileId?: string | null;
  notes?: string;
  source?: 'MANUAL' | 'GATEWAY' | 'RECONCILIATION';
  gatewayPaymentId?: string;
}

export const OPEN_STATUSES = ['PENDING', 'OVERDUE'];

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private files: FilesService,
  ) {}

  /** Saldo em aberto (valor − principal já baixado). */
  static openAmount(entry: { amount: unknown; paidAmount: unknown }): number {
    return fromCents(Math.max(0, toCents(entry.amount as number) - toCents(entry.paidAmount as number)));
  }

  private async run<T>(db: Tx | undefined, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return db ? fn(db) : this.prisma.$transaction(fn);
  }

  /** Trava o lançamento até o fim da transação e devolve o registro atual. */
  private async lockEntry(tx: Tx, workspaceId: string, entryId: string) {
    await tx.$queryRaw`SELECT id FROM "financial_entries" WHERE id = ${entryId} AND "workspaceId" = ${workspaceId} FOR UPDATE`;
    const entry = await tx.financialEntry.findFirst({ where: { id: entryId, workspaceId, deletedAt: null } });
    if (!entry) throw new NotFoundException('Lançamento não encontrado.');
    return entry;
  }

  /** Recalcula paidAmount/paidAt/status a partir das baixas ativas. */
  async recompute(tx: Tx, entryId: string) {
    const entry = await tx.financialEntry.findUnique({ where: { id: entryId } });
    if (!entry) return;
    const pays = await tx.financialPayment.findMany({
      where: { entryId, reversedAt: null },
      orderBy: { paidAt: 'asc' },
    });
    const principalCents = pays.reduce((s, p) => s + toCents(p.principal as unknown as number), 0);
    const last = pays[pays.length - 1];
    const status = entry.status === 'CANCELLED' || entry.status === 'EXEMPT'
      ? entry.status
      : entryStatusAfter(Number(entry.amount), fromCents(principalCents), entry.dueDate);
    await tx.financialEntry.update({
      where: { id: entryId },
      data: {
        paidAmount: principalCents > 0 ? fromCents(principalCents) : null,
        paidAt: last ? last.paidAt : null,
        paymentMethod: last?.method ?? entry.paymentMethod,
        status,
      },
    });
  }

  /** Multa/juros sugeridos para quitar o saldo hoje (ou na data informada). */
  async suggestion(workspaceId: string, entryId: string, paidAt?: string) {
    const entry = await this.prisma.financialEntry.findFirst({ where: { id: entryId, workspaceId, deletedAt: null } });
    if (!entry) throw new NotFoundException('Lançamento não encontrado.');
    const settings = await this.prisma.workspaceFinancialSettings.findUnique({ where: { workspaceId } });
    const open = PaymentsService.openAmount(entry);
    const when = paidAt ? new Date(paidAt) : new Date();
    const s = suggestLateCharges(open, entry.dueDate, when, Number(settings?.finePct ?? 2), Number(settings?.interestMonthlyPct ?? 1));
    return { openAmount: open, ...s, total: fromCents(toCents(open) + toCents(s.fine) + toCents(s.interest)) };
  }

  async register(workspaceId: string, entryId: string, input: RegisterPaymentInput, userId?: string, db?: Tx) {
    // validações fora da trava (vínculos do workspace)
    if (input.bankAccountId) {
      const acc = await (db ?? this.prisma).bankAccount.findFirst({
        where: { id: input.bankAccountId, workspaceId, deletedAt: null }, select: { id: true },
      });
      if (!acc) throw new BadRequestException('Conta bancária não encontrada neste workspace.');
    }
    if (input.receiptFileId) {
      const f = await (db ?? this.prisma).storedFile.findFirst({
        where: { id: input.receiptFileId, workspaceId, deletedAt: null }, select: { id: true },
      });
      if (!f) throw new BadRequestException('Comprovante não encontrado neste workspace.');
    }
    const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
    if (Number.isNaN(paidAt.getTime())) throw new BadRequestException('Data de pagamento inválida.');
    if (paidAt.getTime() > Date.now() + 86_400_000) throw new BadRequestException('A data do pagamento não pode ser no futuro.');

    return this.run(db, async (tx) => {
      const entry = await this.lockEntry(tx, workspaceId, entryId);
      if (entry.status === 'CANCELLED') throw new BadRequestException('Este lançamento está cancelado.');
      if (entry.status === 'EXEMPT') throw new BadRequestException('Este lançamento está isento.');
      const open = PaymentsService.openAmount(entry);
      if (toCents(open) <= 0 || entry.status === 'PAID') throw new BadRequestException('Este lançamento já está quitado.');

      const principal = input.principal ?? open;
      let total: number;
      try {
        total = paymentTotal({ principal, interest: input.interest, fine: input.fine, discount: input.discount }, open);
      } catch (e) {
        throw new BadRequestException((e as Error).message);
      }

      const payment = await tx.financialPayment.create({
        data: {
          workspaceId, entryId,
          principal, interest: input.interest ?? 0, fine: input.fine ?? 0, discount: input.discount ?? 0, total,
          paidAt, method: input.method ?? null,
          bankAccountId: input.bankAccountId ?? null,
          receiptFileId: input.receiptFileId ?? null,
          notes: input.notes?.trim() || null,
          source: input.source ?? 'MANUAL',
          gatewayPaymentId: input.gatewayPaymentId ?? null,
          createdById: userId ?? null,
        },
      });
      await this.recompute(tx, entryId);
      const updated = await tx.financialEntry.findUnique({ where: { id: entryId } });
      return { payment, entry: updated };
    });
  }

  async reverse(workspaceId: string, paymentId: string, reason: string, userId?: string, db?: Tx) {
    const why = reason?.trim();
    if (!why) throw new BadRequestException('Informe o motivo do estorno.');
    return this.run(db, async (tx) => {
      const p = await tx.financialPayment.findFirst({ where: { id: paymentId, workspaceId } });
      if (!p) throw new NotFoundException('Baixa não encontrada.');
      await this.lockEntry(tx, workspaceId, p.entryId);
      const flip = await tx.financialPayment.updateMany({
        where: { id: paymentId, reversedAt: null },
        data: { reversedAt: new Date(), reversalReason: why, reversedById: userId ?? null },
      });
      if (flip.count !== 1) throw new BadRequestException('Esta baixa já foi estornada.');
      // extrato conciliado com esta baixa volta a ficar pendente de conciliação
      await tx.bankTransaction.updateMany({
        where: { workspaceId, paymentId },
        data: { paymentId: null, reconciled: false, financialEntryId: null },
      });
      await this.recompute(tx, p.entryId);
      return tx.financialPayment.findUnique({ where: { id: paymentId } });
    });
  }

  async list(workspaceId: string, entryId: string) {
    const entry = await this.prisma.financialEntry.findFirst({ where: { id: entryId, workspaceId, deletedAt: null }, select: { id: true } });
    if (!entry) throw new NotFoundException('Lançamento não encontrado.');
    const pays = await this.prisma.financialPayment.findMany({ where: { workspaceId, entryId }, orderBy: { paidAt: 'asc' } });
    const accIds = [...new Set(pays.map((p) => p.bankAccountId).filter((v): v is string => !!v))];
    const accounts = accIds.length
      ? await this.prisma.bankAccount.findMany({ where: { workspaceId, id: { in: accIds } }, select: { id: true, name: true } })
      : [];
    const accById = new Map(accounts.map((a) => [a.id, a.name]));
    return pays.map((p) => ({
      ...p,
      bankAccountName: p.bankAccountId ? accById.get(p.bankAccountId) ?? null : null,
      receiptUrl: p.receiptFileId ? this.files.signedPath(p.receiptFileId) : null,
    }));
  }

  async attachReceipt(workspaceId: string, paymentId: string, file: UploadedFileInput | undefined, userId?: string) {
    const p = await this.prisma.financialPayment.findFirst({ where: { id: paymentId, workspaceId } });
    if (!p) throw new NotFoundException('Baixa não encontrada.');
    const stored = await this.files.store(workspaceId, file as UploadedFileInput, 'DOCUMENT', userId);
    await this.prisma.financialPayment.update({ where: { id: paymentId }, data: { receiptFileId: stored.id } });
    return { ...stored, url: this.files.signedPath(stored.id) };
  }

  /** Comprovante enviado antes da baixa (o id vai junto no registro da baixa). */
  async uploadReceipt(workspaceId: string, file: UploadedFileInput | undefined, userId?: string) {
    const stored = await this.files.store(workspaceId, file as UploadedFileInput, 'DOCUMENT', userId);
    return { ...stored, url: this.files.signedPath(stored.id) };
  }
}
