import { ReportsService } from './reports.service';

// Fase 1 — painel de venda. Trava as regras de cada número do dashboard
// e garante que toda consulta filtra pelo workspace.

class DecimalStub {
  constructor(private raw: string) {}
  toString() { return this.raw; }
}

function agg(sum: Record<string, unknown>, count = 0) {
  return { _sum: sum, _count: count };
}

function makePrisma() {
  return {
    deal: { count: jest.fn().mockResolvedValue(4), aggregate: jest.fn().mockResolvedValue(agg({ value: new DecimalStub('950000.00') }, 3)) },
    activity: { count: jest.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(2) },
    contract: { aggregate: jest.fn().mockResolvedValue(agg({ saleValue: new DecimalStub('420000.00') }, 1)) },
    commission: { aggregate: jest.fn().mockResolvedValue(agg({ amount: new DecimalStub('25200.00') }, 2)) },
    splitTransaction: { aggregate: jest.fn().mockResolvedValue(agg({ amount: new DecimalStub('1000.00') }, 1)) },
    // Fase 5: saldo = saldo inicial + extrato (duas contas: 4000 + 6000,50)
    bankAccount: { findMany: jest.fn().mockResolvedValue([
      { id: 'a1', openingBalance: new DecimalStub('3000.00'), openingDate: null },
      { id: 'a2', openingBalance: new DecimalStub('6000.50'), openingDate: new Date('2026-01-01') },
    ]) },
    bankTransaction: { aggregate: jest.fn()
      .mockResolvedValueOnce(agg({ amount: new DecimalStub('1000.00') }))
      .mockResolvedValueOnce(agg({ amount: null })) },
    proposal: { count: jest.fn().mockResolvedValue(2) },
    financialEntry: {
      aggregate: jest
        .fn()
        // 1ª: comissões a pagar (PAYABLE/COMMISSION)
        .mockResolvedValueOnce(agg({ amount: new DecimalStub('3000.00') }, 2))
        // 2ª: a receber em 30 dias
        .mockResolvedValueOnce(agg({ amount: new DecimalStub('8000.25') }))
        // 3ª: a pagar em 30 dias
        .mockResolvedValueOnce(agg({ amount: new DecimalStub('5000.00') }))
        // 4ª: comissão a receber em parcelas (Fase 4), 1.000 já baixados (Fase 5)
        .mockResolvedValueOnce(agg({ amount: new DecimalStub('12700.00'), paidAmount: new DecimalStub('1000.00') }, 1)),
    },
  };
}

describe('ReportsService.getSalesDashboard', () => {
  // Quinta-feira, 12/11/2026 15:00 (horário local do processo)
  const now = new Date(2026, 10, 12, 15, 0, 0);

  it('calcula os indicadores de venda convertendo Decimal com Number', async () => {
    const prisma = makePrisma();
    const service = new ReportsService(prisma as any);

    const r = await service.getSalesDashboard('ws-1', now);

    expect(r.newLeads7d).toBe(4);
    expect(r.visitsThisWeek).toEqual({ total: 5, done: 2 });
    expect(r.vgvInNegotiation).toEqual({ amount: 950000, deals: 3 });
    expect(r.salesThisMonth).toEqual({ amount: 420000, count: 1 });
    // comissão a receber = modelo antigo (sem parcelas) + parcelas lançadas na ativação
    expect(r.commissionsReceivable).toEqual({ amount: 36900, count: 3 });
    // comissão a pagar = lançamentos PAYABLE de comissão + repasses a parceiros pendentes
    expect(r.commissionsPayable).toEqual({ amount: 4000, count: 3 });
    // saldo projetado = saldo bancário + a receber 30d - a pagar 30d
    expect(r.projectedBalance30d!.amount).toBe(13000.75);
  });

  it('propostas em aberto: conta só as abertas e dentro da validade (Fase 3)', async () => {
    const prisma = makePrisma();
    const service = new ReportsService(prisma as any);
    const r = await service.getSalesDashboard('ws-1', now);
    expect(r.openProposals).toEqual({ available: true, count: 2 });
    const where = prisma.proposal.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ workspaceId: 'ws-1', status: 'OPEN', deletedAt: null });
    expect(where.validUntil.gte).toBeInstanceOf(Date);
  });

  it('vendas do mês contam pela data de ativação (Fase 4)', async () => {
    const prisma = makePrisma();
    const service = new ReportsService(prisma as any);
    await service.getSalesDashboard('ws-1', now);
    const where = prisma.contract.aggregate.mock.calls[0][0].where;
    expect(where.OR[0].activatedAt.gte).toBeInstanceOf(Date);
    expect(where.OR[1]).toMatchObject({ activatedAt: null });
  });

  it('a semana vai de segunda 00:00 a domingo 23:59', async () => {
    const service = new ReportsService(makePrisma() as any);
    const r = await service.getSalesDashboard('ws-1', now);
    const start = new Date(r.period.weekStart);
    const end = new Date(r.period.weekEnd);
    expect(start.getDay()).toBe(1);
    expect(start.getDate()).toBe(9);
    expect(start.getHours()).toBe(0);
    expect(end.getDay()).toBe(0);
    expect(end.getDate()).toBe(15);
    expect(end.getHours()).toBe(23);
  });

  it('toda consulta filtra pelo workspace informado', async () => {
    const prisma = makePrisma();
    const service = new ReportsService(prisma as any);
    await service.getSalesDashboard('ws-1', now);

    const calls = [
      ...prisma.deal.count.mock.calls,
      ...prisma.deal.aggregate.mock.calls,
      ...prisma.activity.count.mock.calls,
      ...prisma.contract.aggregate.mock.calls,
      ...prisma.commission.aggregate.mock.calls,
      ...prisma.splitTransaction.aggregate.mock.calls,
      ...prisma.bankAccount.findMany.mock.calls,
      ...prisma.financialEntry.aggregate.mock.calls,
      ...prisma.proposal.count.mock.calls,
    ];
    expect(calls.length).toBe(13);
    for (const [args] of calls) {
      expect(args.where.workspaceId).toBe('ws-1');
    }
  });

  it('VGV ignora negócios ganhos/perdidos e funis de locação', async () => {
    const prisma = makePrisma();
    const service = new ReportsService(prisma as any);
    await service.getSalesDashboard('ws-1', now);
    const where = prisma.deal.aggregate.mock.calls[0][0].where;
    expect(where.stage).toEqual({ isWon: false, isLost: false });
    expect(where.pipeline).toEqual({ type: { not: 'RENTAL' } });
    expect(where.deletedAt).toBeNull();
  });
});
