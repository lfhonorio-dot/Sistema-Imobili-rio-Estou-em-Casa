// Serviço Bancário — Contas, OFX, Conciliação e Open Finance
import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateBankAccountDto, ImportOfxDto, BankTransactionQueryDto,
  ReconcileDto, ManualTransactionDto,
} from './banking.dto';

@Injectable()
export class BankingService {
  private readonly logger = new Logger(BankingService.name);

  constructor(private prisma: PrismaService) {}

  // ── CONTAS BANCÁRIAS ──────────────────────────────────────

  async findAccounts(workspaceId: string) {
    return this.prisma.bankAccount.findMany({
      where: { workspaceId, deletedAt: null },
      include: { _count: { select: { transactions: true } } },
      orderBy: { isDefault: 'desc' },
    });
  }

  async findOneAccount(workspaceId: string, id: string) {
    const acc = await this.prisma.bankAccount.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!acc) throw new NotFoundException('Conta bancária não encontrada');
    return acc;
  }

  async createAccount(workspaceId: string, dto: CreateBankAccountDto) {
    if (dto.isDefault) {
      await this.prisma.bankAccount.updateMany({
        where: { workspaceId }, data: { isDefault: false },
      });
    }
    return this.prisma.bankAccount.create({
      data: {
        workspaceId,
        name: dto.name,
        bankCode: dto.bankCode,
        bankName: dto.bankName,
        agency: dto.agency,
        accountNumber: dto.accountNumber,
        accountType: dto.accountType ?? 'CHECKING',
        pixKey: dto.pixKey,
        isDefault: dto.isDefault ?? false,
        balance: 0,
      },
    });
  }

  async updateAccount(workspaceId: string, id: string, dto: Partial<CreateBankAccountDto>) {
    await this.findOneAccount(workspaceId, id);
    if (dto.isDefault) {
      await this.prisma.bankAccount.updateMany({
        where: { workspaceId }, data: { isDefault: false },
      });
    }
    return this.prisma.bankAccount.update({ where: { id }, data: dto });
  }

  async deleteAccount(workspaceId: string, id: string) {
    await this.findOneAccount(workspaceId, id);
    await this.prisma.bankAccount.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Conta bancária removida com sucesso' };
  }

  // ── IMPORTAÇÃO OFX ────────────────────────────────────────

  async importOfx(workspaceId: string, dto: ImportOfxDto) {
    await this.findOneAccount(workspaceId, dto.bankAccountId);
    const content = Buffer.from(dto.content, 'base64').toString('utf-8');
    const transactions = this.parseOfx(content);

    let imported = 0;
    let duplicates = 0;

    for (const tx of transactions) {
      const exists = await this.prisma.bankTransaction.findFirst({
        where: { bankAccountId: dto.bankAccountId, externalId: tx.externalId },
      });
      if (exists) { duplicates++; continue; }

      await this.prisma.bankTransaction.create({
        data: {
          workspaceId,
          bankAccountId: dto.bankAccountId,
          externalId: tx.externalId,
          amount: tx.amount,
          date: tx.date,
          description: tx.memo,
          importSource: 'OFX',
          reconciled: false,
        },
      });
      imported++;
    }

    this.logger.log(`OFX importado: conta=${dto.bankAccountId} novas=${imported} duplicatas=${duplicates}`);
    return { imported, duplicates, total: transactions.length };
  }

  // ── TRANSAÇÕES ────────────────────────────────────────────

  async findTransactions(workspaceId: string, query: BankTransactionQueryDto) {
    const { page = 1, limit = 20, bankAccountId, reconciled, startDate, endDate } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {
      workspaceId,
      ...(bankAccountId && { bankAccountId }),
      ...(reconciled !== undefined && { reconciled }),
      ...((startDate || endDate) && {
        date: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      }),
    };
    const [items, total] = await Promise.all([
      this.prisma.bankTransaction.findMany({
        where, skip, take: limit,
        orderBy: { date: 'desc' },
        include: {
          bankAccount: { select: { id: true, bankName: true, accountNumber: true } },
        },
      }),
      this.prisma.bankTransaction.count({ where }),
    ]);
    return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async createManualTransaction(workspaceId: string, dto: ManualTransactionDto) {
    await this.findOneAccount(workspaceId, dto.bankAccountId);
    const tx = await this.prisma.bankTransaction.create({
      data: {
        workspaceId,
        bankAccountId: dto.bankAccountId,
        externalId: `MANUAL_${Date.now()}`,
        amount: dto.amount,
        date: new Date(dto.date),
        description: dto.description,
        type: dto.type,
        financialEntryId: dto.financialEntryId,
        importSource: 'MANUAL',
        reconciled: !!dto.financialEntryId,
      },
    });

    await this.prisma.bankAccount.update({
      where: { id: dto.bankAccountId },
      data: { balance: { increment: dto.amount } },
    });

    return tx;
  }

  // ── CONCILIAÇÃO ───────────────────────────────────────────

  async findReconciliations(workspaceId: string) {
    return this.prisma.bankReconciliation.findMany({
      where: { workspaceId },
      include: {
        bankAccount: { select: { id: true, bankName: true, accountNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async reconcileTransaction(workspaceId: string, dto: ReconcileDto) {
    const tx = await this.prisma.bankTransaction.findFirst({
      where: { id: dto.bankTransactionId, workspaceId },
    });
    if (!tx) throw new NotFoundException('Transação bancária não encontrada');
    if (tx.reconciled) throw new BadRequestException('Transação já conciliada');

    await this.prisma.bankTransaction.update({
      where: { id: dto.bankTransactionId },
      data: {
        reconciled: true,
        financialEntryId: dto.financialEntryId,
      },
    });

    await this.prisma.bankReconciliation.create({
      data: {
        workspaceId,
        bankAccountId: tx.bankAccountId,
        bankTransactionId: tx.id,
        financialEntryId: dto.financialEntryId,
        status: 'MANUAL',
        confidence: 1.0,
        notes: dto.notes,
        reconciledAt: new Date(),
      },
    });

    if (dto.financialEntryId) {
      await this.prisma.financialEntry.update({
        where: { id: dto.financialEntryId },
        data: { status: 'PAID', paidAt: tx.date },
      });
    }

    return { message: 'Transação conciliada com sucesso' };
  }

  async autoReconcile(workspaceId: string, bankAccountId: string) {
    await this.findOneAccount(workspaceId, bankAccountId);

    const pendingTx = await this.prisma.bankTransaction.findMany({
      where: { workspaceId, bankAccountId, reconciled: false },
    });

    let matched = 0;
    for (const tx of pendingTx) {
      const dateFrom = new Date(tx.date);
      dateFrom.setDate(dateFrom.getDate() - 3);
      const dateTo = new Date(tx.date);
      dateTo.setDate(dateTo.getDate() + 3);

      const amount = Math.abs(tx.amount);
      const entry = await this.prisma.financialEntry.findFirst({
        where: {
          workspaceId,
          amount,
          status: { in: ['PENDING', 'OVERDUE'] },
          dueDate: { gte: dateFrom, lte: dateTo },
        },
      });

      if (entry) {
        await this.reconcileTransaction(workspaceId, {
          bankTransactionId: tx.id,
          financialEntryId: entry.id,
          notes: 'Conciliação automática',
        });
        matched++;
      }
    }

    this.logger.log(`Conciliação automática: conta=${bankAccountId} casadas=${matched}/${pendingTx.length}`);
    return { matched, total: pendingTx.length };
  }

  // ── SALDO ─────────────────────────────────────────────────

  async getAccountSummary(workspaceId: string, bankAccountId: string) {
    const account = await this.findOneAccount(workspaceId, bankAccountId);

    const pending = await this.prisma.bankTransaction.count({
      where: { workspaceId, bankAccountId, reconciled: false },
    });

    return {
      balance: account.balance,
      pendingReconciliation: pending,
    };
  }

  // ── OPEN FINANCE (stub) ───────────────────────────────────

  async getOpenFinanceConsent(workspaceId: string) {
    return {
      message: 'Open Finance em implementação',
      consentUrl: null,
      status: 'NOT_CONFIGURED',
    };
  }

  // ── PARSER OFX ────────────────────────────────────────────

  private parseOfx(content: string): Array<{ externalId: string; amount: number; date: Date; memo: string }> {
    const transactions: Array<{ externalId: string; amount: number; date: Date; memo: string }> = [];
    const stmttrn = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];

    for (const block of stmttrn) {
      const externalId = (block.match(/<FITID>([^<\n]+)/) || [])[1]?.trim();
      const amtStr = (block.match(/<TRNAMT>([^<\n]+)/) || [])[1]?.trim();
      const dtposted = (block.match(/<DTPOSTED>([^<\n]+)/) || [])[1]?.trim();
      const memo = (block.match(/<MEMO>([^<\n]+)/) || [])[1]?.trim() || '';

      if (!externalId || !amtStr || !dtposted) continue;

      const amount = parseFloat(amtStr.replace(',', '.'));
      const year = dtposted.slice(0, 4);
      const month = dtposted.slice(4, 6);
      const day = dtposted.slice(6, 8);
      const date = new Date(`${year}-${month}-${day}`);

      transactions.push({ externalId, amount, date, memo });
    }
    return transactions;
  }
}
