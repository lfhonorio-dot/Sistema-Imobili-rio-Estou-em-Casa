import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  const passwordHash = await bcrypt.hash('senha123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'admin@investimentos.local' },
    update: {},
    create: { email: 'admin@investimentos.local', passwordHash, name: 'Investidor' },
  });
  console.log('✅ Usuário criado: admin@investimentos.local / senha123');

  // Limpar dados anteriores
  await prisma.dividendHistory.deleteMany();
  await prisma.investmentAsset.deleteMany();
  await prisma.property.deleteMany();
  await prisma.receivableMonthlyHistory.deleteMany();
  await prisma.receivablePortfolio.deleteMany();
  await prisma.cashFlowEntry.deleteMany();
  await prisma.retirementPlan.deleteMany();
  await prisma.monthlySnapshot.deleteMany();

  // Renda Fixa
  await prisma.investmentAsset.createMany({
    data: [
      { type: 'RENDA_FIXA', name: 'CDB EQI 115% CDI', issuer: 'EQI Investimentos', broker: 'EQI', investedAmount: 500000, currentValue: 547000, indexer: 'CDI', rate: 115, isIRExempt: false, liquidity: 'NO_VENCIMENTO', applicationDate: new Date('2023-03-01'), maturityDate: new Date('2025-03-01') },
      { type: 'RENDA_FIXA', name: 'LCA Bradesco IPCA+5,5%', issuer: 'Bradesco', broker: 'Bradesco', investedAmount: 300000, currentValue: 334000, indexer: 'IPCA', rate: 5.5, isIRExempt: true, liquidity: 'NO_VENCIMENTO', applicationDate: new Date('2023-06-01'), maturityDate: new Date('2025-12-01') },
      { type: 'RENDA_FIXA', name: 'LCI Itaú 95% CDI', issuer: 'Itaú', broker: 'Itaú', investedAmount: 200000, currentValue: 218000, indexer: 'CDI', rate: 95, isIRExempt: true, liquidity: 'NO_VENCIMENTO', applicationDate: new Date('2023-09-01'), maturityDate: new Date('2025-09-01') },
      { type: 'RENDA_FIXA', name: 'Tesouro IPCA+ 2035', issuer: 'Tesouro Nacional', broker: 'XP', investedAmount: 400000, currentValue: 452000, indexer: 'IPCA', rate: 5.8, isIRExempt: false, liquidity: 'D1', applicationDate: new Date('2022-01-15'), maturityDate: new Date('2035-05-15') },
      { type: 'RENDA_FIXA', name: 'CRI EQI Loteamento IPCA+7%', issuer: 'EQI Securitizadora', broker: 'EQI', investedAmount: 250000, currentValue: 278000, indexer: 'IPCA', rate: 7.0, isIRExempt: true, liquidity: 'NO_VENCIMENTO', applicationDate: new Date('2023-01-10'), maturityDate: new Date('2027-01-10') },
      { type: 'RENDA_FIXA', name: 'Debênture Incentivada IPCA+6%', issuer: 'Concessionária Rodoviária', broker: 'XP', investedAmount: 150000, currentValue: 163000, indexer: 'IPCA', rate: 6.0, isIRExempt: true, liquidity: 'D1', applicationDate: new Date('2023-04-20'), maturityDate: new Date('2028-04-20') },
    ],
  });

  // FIIs
  const fiis = [
    { ticker: 'MXRF11', name: 'Maxi Renda FII', segment: 'Papel', investedAmount: 180000, currentValue: 195000, quantity: 1500, averagePrice: 120, currentPrice: 130, monthlyDY: 1.1, pvp: 0.98 },
    { ticker: 'HGLG11', name: 'CSHG Logística FII', segment: 'Logística', investedAmount: 220000, currentValue: 245000, quantity: 600, averagePrice: 366.67, currentPrice: 408.33, monthlyDY: 0.75, pvp: 1.05 },
    { ticker: 'VISC11', name: 'Vinci Shopping Centers FII', segment: 'Shopping', investedAmount: 160000, currentValue: 172000, quantity: 1000, averagePrice: 160, currentPrice: 172, monthlyDY: 0.80, pvp: 0.95 },
    { ticker: 'XPML11', name: 'XP Malls FII', segment: 'Shopping', investedAmount: 140000, currentValue: 151000, quantity: 700, averagePrice: 200, currentPrice: 215.71, monthlyDY: 0.72, pvp: 0.97 },
    { ticker: 'KNRI11', name: 'Kinea Renda Imobiliária FII', segment: 'Lajes/Logística', investedAmount: 200000, currentValue: 218000, quantity: 800, averagePrice: 250, currentPrice: 272.5, monthlyDY: 0.65, pvp: 1.10 },
  ];
  for (const fii of fiis) {
    await prisma.investmentAsset.create({ data: { type: 'FII', broker: 'EQI', liquidity: 'D1', ...fii } });
  }

  // Ações
  await prisma.investmentAsset.createMany({
    data: [
      { type: 'ACAO', ticker: 'ITSA4', name: 'Itaúsa', issuer: 'Itaúsa S.A.', broker: 'EQI', investedAmount: 120000, currentValue: 138000, quantity: 5000, averagePrice: 24, currentPrice: 27.6, monthlyDY: 0.40, beta: 0.85, liquidity: 'D2' },
      { type: 'ACAO', ticker: 'WEGE3', name: 'WEG S.A.', issuer: 'WEG S.A.', broker: 'EQI', investedAmount: 80000, currentValue: 96000, quantity: 1000, averagePrice: 80, currentPrice: 96, monthlyDY: 0.20, beta: 0.70, liquidity: 'D2' },
      { type: 'ACAO', ticker: 'BBAS3', name: 'Banco do Brasil', issuer: 'Banco do Brasil S.A.', broker: 'EQI', investedAmount: 100000, currentValue: 118000, quantity: 2000, averagePrice: 50, currentPrice: 59, monthlyDY: 0.55, beta: 1.10, liquidity: 'D2' },
    ],
  });

  // Previdência
  await prisma.investmentAsset.create({
    data: { type: 'PREVIDENCIA', name: 'PGBL XP Regressivo', insurerName: 'XP Vida e Previdência', planType: 'PGBL', taxRegime: 'Regressivo', broker: 'XP', investedAmount: 350000, currentValue: 412000, monthlyContribution: 5000, beneficiaries: 'Cônjuge 50%, Filhos 50%', liquidity: 'ILIQUIDO' },
  });

  // Caixa
  await prisma.investmentAsset.createMany({
    data: [
      { type: 'CAIXA', name: 'Conta Corrente Bradesco', issuer: 'Bradesco', broker: 'Bradesco', investedAmount: 50000, currentValue: 50000, liquidity: 'D0' },
      { type: 'CAIXA', name: 'CDB Liquidez Diária EQI 100% CDI', issuer: 'EQI', broker: 'EQI', investedAmount: 150000, currentValue: 152000, indexer: 'CDI', rate: 100, liquidity: 'D0' },
    ],
  });

  console.log('✅ Ativos financeiros criados');

  // Imóveis
  await prisma.property.createMany({
    data: [
      { name: 'Apto Hisa', classification: 'PARA_RENDA', propertyType: 'APARTAMENTO', currentValuation: 1200000, rentAmount: 5500, rentStatus: 'ALUGADO', tenantName: 'Carlos Mendes', contractEndDate: new Date('2025-03-31'), adjustmentIndex: 'IPCA', lastValuationDate: new Date('2024-01-01') },
      { name: 'Apto Rifaina', classification: 'PARA_RENDA', propertyType: 'APARTAMENTO', currentValuation: 800000, rentAmount: 3200, rentStatus: 'ALUGADO', tenantName: 'Maria Santos', contractEndDate: new Date('2025-06-30'), adjustmentIndex: 'IGPM', lastValuationDate: new Date('2024-01-01') },
      { name: 'Arrendamento Sítio Rifaina', classification: 'PARA_RENDA', propertyType: 'SITIO', currentValuation: 2500000, rentAmount: 8000, rentStatus: 'ALUGADO', tenantName: 'Agropecuária Silva', contractEndDate: new Date('2026-12-31'), adjustmentIndex: 'IGPM', lastValuationDate: new Date('2024-01-01') },
      { name: 'Casa Filipinho de Lima', classification: 'PARA_RENDA', propertyType: 'CASA', currentValuation: 950000, rentAmount: 4200, rentStatus: 'ALUGADO', tenantName: 'Roberto Lima', contractEndDate: new Date('2025-09-30'), adjustmentIndex: 'IGPM', lastValuationDate: new Date('2024-01-01') },
      { name: 'Casa Morada do Verde', classification: 'PARA_RENDA', propertyType: 'CASA', currentValuation: 750000, rentAmount: 3500, rentStatus: 'ALUGADO', tenantName: 'Ana Paula Costa', contractEndDate: new Date('2025-12-31'), adjustmentIndex: 'IPCA', lastValuationDate: new Date('2024-01-01') },
      { name: 'Casa Mãe', classification: 'PARA_RENDA', propertyType: 'CASA', currentValuation: 650000, rentAmount: 2800, rentStatus: 'ALUGADO', tenantName: 'Família Oliveira', contractEndDate: new Date('2025-08-31'), adjustmentIndex: 'IGPM', lastValuationDate: new Date('2024-01-01') },
      { name: 'Sala Comercial Centro', classification: 'PARA_RENDA', propertyType: 'SALA_COMERCIAL', currentValuation: 500000, rentAmount: 0, rentStatus: 'VAGO', lastValuationDate: new Date('2024-01-01'), notes: 'Em reforma para locação' },
      { name: 'Residência Principal', classification: 'USO_PROPRIO', propertyType: 'CASA', currentValuation: 4500000, lastValuationDate: new Date('2024-01-01') },
      { name: 'Sítio Rifaina - Uso Pessoal', classification: 'USO_PROPRIO', propertyType: 'SITIO', currentValuation: 2200000, lastValuationDate: new Date('2024-01-01') },
      { name: 'Lotes Empreendimento Nobre', classification: 'A_COMERCIALIZAR', propertyType: 'LOTE', currentValuation: 3500000, lastValuationDate: new Date('2024-01-01'), notes: '25 lotes prontos para venda' },
      { name: 'Galpão Industrial', classification: 'A_COMERCIALIZAR', propertyType: 'GALPAO', currentValuation: 5600000, lastValuationDate: new Date('2024-01-01'), notes: 'Em processo de venda' },
    ],
  });
  console.log('✅ Imóveis criados');

  // Recebíveis
  const quinta = await prisma.receivablePortfolio.create({
    data: { name: 'Quinta dos Nobres', developmentName: 'Loteamento Quinta dos Nobres', presentValue: 9000000, futureTotalReceivable: 12500000, averageRemainingTerm: 84, impliedMonthlyRate: 0.008, monthlyReceivedAmount: 95000, expectedMonthlyAmount: 100000 },
  });
  const reserva = await prisma.receivablePortfolio.create({
    data: { name: 'Reserva de Santa Rita', developmentName: 'Loteamento Reserva de Santa Rita', presentValue: 2500000, futureTotalReceivable: 3800000, averageRemainingTerm: 60, impliedMonthlyRate: 0.007, monthlyReceivedAmount: 28000, expectedMonthlyAmount: 30000 },
  });

  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.getMonth() + 1; const year = d.getFullYear();
    await prisma.receivableMonthlyHistory.create({ data: { portfolioId: quinta.id, month, year, expectedAmount: 100000, receivedAmount: 90000 + Math.floor(Math.random() * 15000) } });
    await prisma.receivableMonthlyHistory.create({ data: { portfolioId: reserva.id, month, year, expectedAmount: 30000, receivedAmount: 25000 + Math.floor(Math.random() * 6000) } });
  }
  console.log('✅ Carteiras de recebíveis criadas');

  // Plano de aposentadoria
  await prisma.retirementPlan.create({
    data: { userId: user.id, desiredMonthlyIncome: 50000, estimatedMonthlyExpenses: 35000, expectedIpca: 4.5, expectedCdi: 10.5, lifeExpectancy: 90, targetFixedIncome: 50, targetFii: 22.5, targetStocks: 12.5, targetReceivables: 12.5, targetLiquidity: 7.5 },
  });

  // Fluxo de caixa (últimos 3 meses)
  const cfBase = [
    { type: 'RECEITA' as const, category: 'ALUGUEL' as const, description: 'Aluguel Apto Hisa', amount: 5500 },
    { type: 'RECEITA' as const, category: 'ALUGUEL' as const, description: 'Aluguel Apto Rifaina', amount: 3200 },
    { type: 'RECEITA' as const, category: 'ALUGUEL' as const, description: 'Arrendamento Sítio Rifaina', amount: 8000 },
    { type: 'RECEITA' as const, category: 'ALUGUEL' as const, description: 'Aluguel Casa Filipinho de Lima', amount: 4200 },
    { type: 'RECEITA' as const, category: 'ALUGUEL' as const, description: 'Aluguel Casa Morada do Verde', amount: 3500 },
    { type: 'RECEITA' as const, category: 'ALUGUEL' as const, description: 'Aluguel Casa Mãe', amount: 2800 },
    { type: 'RECEITA' as const, category: 'APOSENTADORIA' as const, description: 'Aposentadoria INSS', amount: 7786 },
    { type: 'RECEITA' as const, category: 'RENDIMENTO_FII' as const, description: 'Rendimentos FIIs (MXRF11 + HGLG11 + VISC11 + XPML11 + KNRI11)', amount: 9200 },
    { type: 'RECEITA' as const, category: 'RECEBIVEIS_LOTEAMENTO' as const, description: 'Recebimento Quinta dos Nobres', amount: 95000 },
    { type: 'RECEITA' as const, category: 'RECEBIVEIS_LOTEAMENTO' as const, description: 'Recebimento Reserva de Santa Rita', amount: 28000 },
    { type: 'DESPESA' as const, category: 'IPTU' as const, description: 'IPTU Imóveis', amount: 3200 },
    { type: 'DESPESA' as const, category: 'CONDOMINIO' as const, description: 'Condomínio Apto Hisa', amount: 1200 },
    { type: 'DESPESA' as const, category: 'IMPOSTOS_ESCRITORIO' as const, description: 'Impostos e Escritório', amount: 8500 },
    { type: 'DESPESA' as const, category: 'IR_DARF' as const, description: 'DARF IR Mensal', amount: 12000 },
    { type: 'DESPESA' as const, category: 'CUSTO_VIDA' as const, description: 'Custos de Vida', amount: 15000 },
    { type: 'DESPESA' as const, category: 'PLANO_SAUDE' as const, description: 'Plano de Saúde Família', amount: 3500 },
  ];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.getMonth() + 1; const year = d.getFullYear();
    await prisma.cashFlowEntry.createMany({ data: cfBase.map(e => ({ ...e, userId: user.id, month, year })) });
  }
  console.log('✅ Fluxo de caixa criado');

  // Import rules
  await prisma.importRule.createMany({
    data: [
      { userId: user.id, keyword: 'ALUGUEL', targetModule: 'CASH_FLOW', targetCategory: 'ALUGUEL' },
      { userId: user.id, keyword: 'FII', targetModule: 'CASH_FLOW', targetCategory: 'RENDIMENTO_FII' },
      { userId: user.id, keyword: 'APOSENTADORIA', targetModule: 'CASH_FLOW', targetCategory: 'APOSENTADORIA' },
      { userId: user.id, keyword: 'INSS', targetModule: 'CASH_FLOW', targetCategory: 'APOSENTADORIA' },
      { userId: user.id, keyword: 'LOTEAMENTO', targetModule: 'CASH_FLOW', targetCategory: 'RECEBIVEIS_LOTEAMENTO' },
      { userId: user.id, keyword: 'DARF', targetModule: 'CASH_FLOW', targetCategory: 'IR_DARF' },
      { userId: user.id, keyword: 'IPTU', targetModule: 'CASH_FLOW', targetCategory: 'IPTU' },
    ],
  });

  // Monthly snapshots (simulated last 6 months)
  const assetData = await prisma.investmentAsset.findMany();
  const propData = await prisma.property.findMany();
  const recData = await prisma.receivablePortfolio.findMany();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.getMonth() + 1; const year = d.getFullYear();
    const factor = 1 + (5 - i) * 0.005;
    const byType: Record<string, number> = {};
    for (const a of assetData) { byType[a.type] = (byType[a.type] || 0) + Number(a.currentValue) / factor; }
    const receivablesTotal = recData.reduce((s, r) => s + Number(r.presentValue), 0);
    const propertiesRentTotal = propData.filter(p => p.classification === 'PARA_RENDA').reduce((s, p) => s + Number(p.currentValuation), 0);
    const propertiesOwnTotal = propData.filter(p => p.classification === 'USO_PROPRIO').reduce((s, p) => s + Number(p.currentValuation), 0);
    const propertiesSaleTotal = propData.filter(p => p.classification === 'A_COMERCIALIZAR').reduce((s, p) => s + Number(p.currentValuation), 0);
    const totalPatrimony = Object.values(byType).reduce((s, v) => s + v, 0) + receivablesTotal + propertiesRentTotal + propertiesOwnTotal + propertiesSaleTotal;
    await prisma.monthlySnapshot.create({
      data: { userId: user.id, month, year, totalPatrimony, fixedIncomeTotal: byType['RENDA_FIXA'] || 0, fiiTotal: byType['FII'] || 0, stocksTotal: byType['ACAO'] || 0, pensionTotal: byType['PREVIDENCIA'] || 0, coeTotal: byType['COE'] || 0, cashTotal: byType['CAIXA'] || 0, receivablesTotal, propertiesRentTotal, propertiesOwnTotal, propertiesSaleTotal, monthlyPassiveIncome: 130000, monthlyExpenses: 43400 },
    });
  }

  console.log('\n🎉 Seed concluído!');
  console.log('   Login: admin@investimentos.local');
  console.log('   Senha: senha123');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
