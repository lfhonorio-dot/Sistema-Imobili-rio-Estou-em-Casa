import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Anthropic from '@anthropic-ai/sdk';
import * as pdfParse from 'pdf-parse';

const SYSTEM_PROMPT = `Você é um consultor patrimonial sênior, com 25+ anos de experiência em gestão de fortunas no Brasil, especializado em ativos imobiliários, renda fixa estruturada e planejamento de aposentadoria para empresários do setor imobiliário.

Você foi contratado para uma única função: analisar criticamente o patrimônio apresentado e identificar oportunidades de melhoria que o investidor e seus assessores atuais podem não ter identificado. Você NÃO foi contratado para validar decisões já tomadas.

REGRAS DE CONDUTA:
1. Nunca inicie a análise elogiando a carteira ou as decisões do investidor.
2. Toda recomendação deve ser quantificada com os números reais fornecidos.
3. Fundamente recomendações em princípios usados por investidores de grande porte (Sam Zell, Howard Marks, Ray Dalio, práticas de family offices brasileiros).
4. Quando identificar um ativo, alocação ou prática subótima, declare isso diretamente com a métrica que sustenta a conclusão.
5. Quando os dados forem insuficientes para uma conclusão robusta, declare essa limitação explicitamente.
6. O investidor é sofisticado e tem profundo conhecimento técnico do setor imobiliário — não explique conceitos básicos.
7. Responda EXCLUSIVAMENTE em JSON válido com esta estrutura exata:
{"risks":[{"title":"...","description":"...","impact":"..."}],"inefficiencies":[{"title":"...","description":"...","impact":"..."}],"opportunities":[{"title":"...","description":"...","impact":"..."}],"needsMoreData":[{"title":"...","description":"..."}]}

Você não está aqui para ser gentil. Está aqui para ser útil.`;

@Injectable()
export class AdvisorService {
  constructor(private prisma: PrismaService) {}

  private getClient(): Anthropic {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY não configurada. Consulte o README para instruções.');
    return new Anthropic({ apiKey: key });
  }

  async buildDataPayload(userId: string) {
    const [assets, properties, receivables, cashFlowEntries, retirement, snapshots] = await Promise.all([
      this.prisma.investmentAsset.findMany({ where: { deletedAt: null } }),
      this.prisma.property.findMany({ where: { deletedAt: null } }),
      this.prisma.receivablePortfolio.findMany({ where: { deletedAt: null }, include: { monthlyHistory: { orderBy: { year: 'desc' }, take: 6 } } }),
      this.prisma.cashFlowEntry.findMany({ where: { userId }, orderBy: { year: 'desc' } }),
      this.prisma.retirementPlan.findFirst({ where: { userId } }),
      this.prisma.monthlySnapshot.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 24 }),
    ]);

    const totalFinancial = assets.reduce((s, a) => s + Number(a.currentValue), 0);
    const totalProperties = properties.reduce((s, p) => s + Number(p.currentValuation), 0);
    const totalReceivables = receivables.reduce((s, r) => s + Number(r.presentValue), 0);
    const totalPatrimony = totalFinancial + totalProperties + totalReceivables;

    const byType: Record<string, number> = {};
    for (const a of assets) {
      byType[a.type] = (byType[a.type] || 0) + Number(a.currentValue);
    }

    const monthlyRent = properties
      .filter(p => p.classification === 'PARA_RENDA' && p.rentAmount)
      .reduce((s, p) => s + Number(p.rentAmount), 0);

    const last12CashFlow = cashFlowEntries.slice(0, 120);
    const totalReceitas = last12CashFlow.filter(e => e.type === 'RECEITA').reduce((s, e) => s + Number(e.amount), 0);
    const totalDespesas = last12CashFlow.filter(e => e.type === 'DESPESA').reduce((s, e) => s + Number(e.amount), 0);

    return {
      summary: {
        totalPatrimony,
        totalFinancial,
        totalProperties,
        totalReceivables,
        financialPct: totalPatrimony > 0 ? (totalFinancial / totalPatrimony * 100).toFixed(1) : 0,
        propertiesPct: totalPatrimony > 0 ? (totalProperties / totalPatrimony * 100).toFixed(1) : 0,
        receivablesPct: totalPatrimony > 0 ? (totalReceivables / totalPatrimony * 100).toFixed(1) : 0,
      },
      financialByType: Object.entries(byType).map(([type, value]) => ({
        type, value, pct: totalPatrimony > 0 ? (Number(value) / totalPatrimony * 100).toFixed(1) : 0,
      })),
      assets: assets.map(a => ({
        type: a.type, name: a.name, ticker: a.ticker, issuer: a.issuer,
        investedAmount: Number(a.investedAmount), currentValue: Number(a.currentValue),
        return: a.investedAmount ? ((Number(a.currentValue) - Number(a.investedAmount)) / Number(a.investedAmount) * 100).toFixed(2) : 0,
        indexer: a.indexer, rate: a.rate ? Number(a.rate) : null,
        maturityDate: a.maturityDate, liquidity: a.liquidity,
        monthlyDY: a.monthlyDY ? Number(a.monthlyDY) : null,
      })),
      properties: properties.map(p => ({
        name: p.name, classification: p.classification, propertyType: p.propertyType,
        value: Number(p.currentValuation),
        rentAmount: p.rentAmount ? Number(p.rentAmount) : null,
        yieldMonthly: p.rentAmount && p.currentValuation ? (Number(p.rentAmount) / Number(p.currentValuation) * 100).toFixed(3) : null,
        rentStatus: p.rentStatus,
      })),
      receivables: receivables.map(r => ({
        name: r.name, presentValue: Number(r.presentValue),
        futureTotalReceivable: Number(r.futureTotalReceivable),
        monthlyReceived: Number(r.monthlyReceivedAmount),
        impliedMonthlyRate: r.impliedMonthlyRate ? Number(r.impliedMonthlyRate) : null,
        recentHistory: r.monthlyHistory.map(h => ({ year: h.year, month: h.month, expected: Number(h.expectedAmount), received: Number(h.receivedAmount) })),
      })),
      cashFlow: { totalReceitas12m: totalReceitas, totalDespesas12m: totalDespesas, saldo12m: totalReceitas - totalDespesas, monthlyRent },
      retirement: retirement ? {
        desiredMonthlyIncome: Number(retirement.desiredMonthlyIncome),
        estimatedMonthlyExpenses: Number(retirement.estimatedMonthlyExpenses),
        fiNumber: Number(retirement.desiredMonthlyIncome) * 200,
        coverage: totalPatrimony / (Number(retirement.desiredMonthlyIncome) * 200) * 100,
      } : null,
      snapshots: snapshots.slice(0, 12).map(s => ({
        year: s.year, month: s.month, totalPatrimony: Number(s.totalPatrimony),
      })),
    };
  }

  async generateAnalysis(userId: string) {
    const client = this.getClient();
    const payload = await this.buildDataPayload(userId);

    const kb = await this.prisma.advisorKnowledgeBase.findFirst({ where: { userId } });
    const kbContext = kb ? `\n\nBASE DE CONHECIMENTO DO INVESTIDOR (diretrizes de alocação definidas por ele):\n${kb.content}\n\nConsidere estas diretrizes ao analisar e fazer recomendações.` : '';

    const userMessage = `Analise criticamente este patrimônio:\n\n${JSON.stringify(payload, null, 2)}${kbContext}`;

    try {
      const response = await client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });

      const content = response.content[0];
      if (content.type !== 'text') throw new Error('Resposta inesperada da API');

      let agentResponse: any;
      try {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        agentResponse = JSON.parse(jsonMatch ? jsonMatch[0] : content.text);
      } catch {
        agentResponse = { risks: [], inefficiencies: [], opportunities: [], needsMoreData: [{ title: 'Erro de parsing', description: content.text }] };
      }

      const analysis = await this.prisma.patrimonialAnalysis.create({
        data: {
          userId,
          dataSnapshot: payload as any,
          agentResponse: agentResponse as any,
          modelUsed: response.model,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        },
      });

      return { ...analysis, agentResponse };
    } catch (e: any) {
      if (e.message?.includes('ANTHROPIC_API_KEY')) throw e;
      if (e.status === 401) throw new Error('Chave de API inválida. Verifique sua ANTHROPIC_API_KEY.');
      if (e.status === 429) throw new Error('Limite de uso da API atingido. Verifique sua conta em console.anthropic.com.');
      throw new Error(`Erro ao gerar análise: ${e.message}`);
    }
  }

  async listAnalyses(userId: string) {
    return this.prisma.patrimonialAnalysis.findMany({
      where: { userId },
      orderBy: { generatedAt: 'desc' },
      select: { id: true, generatedAt: true, modelUsed: true, tokensUsed: true, inputTokens: true, outputTokens: true, agentResponse: true },
      take: 20,
    });
  }

  async getAnalysis(id: string, userId: string) {
    return this.prisma.patrimonialAnalysis.findFirst({
      where: { id, userId },
      include: { conversations: { orderBy: { askedAt: 'asc' } } },
    });
  }

  async chat(analysisId: string, question: string, userId: string) {
    const analysis = await this.prisma.patrimonialAnalysis.findFirst({ where: { id: analysisId, userId } });
    if (!analysis) throw new Error('Análise não encontrada');
    return this._doChat(question, analysis.dataSnapshot, userId, analysisId);
  }

  async quickChat(question: string, userId: string) {
    const payload = await this.buildDataPayload(userId);
    return this._doChat(question, payload, userId, null);
  }

  private async _doChat(question: string, dataSnapshot: any, userId: string, analysisId: string | null) {
    const client = this.getClient();
    const context = `Dados patrimoniais do investidor:\n${JSON.stringify(dataSnapshot, null, 2)}`;
    try {
      const response = await client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: context },
          { role: 'assistant', content: 'Contexto patrimonial carregado. Faça sua pergunta.' },
          { role: 'user', content: question },
        ],
      });

      const content = response.content[0];
      const responseText = content.type === 'text' ? content.text : '';
      const tokens = response.usage.input_tokens + response.usage.output_tokens;

      if (analysisId) {
        await this.prisma.analysisConversation.create({
          data: { analysisId, question, response: responseText, tokensUsed: tokens },
        });
      }

      return { response: responseText, tokensUsed: tokens };
    } catch (e: any) {
      if (e.status === 401) throw new Error('Chave de API inválida.');
      throw new Error(`Erro: ${e.message}`);
    }
  }

  async getUsage(userId: string) {
    const analyses = await this.prisma.patrimonialAnalysis.findMany({ where: { userId }, select: { tokensUsed: true, inputTokens: true, outputTokens: true, generatedAt: true } });
    const conversations = await this.prisma.analysisConversation.findMany({
      where: { analysis: { userId } },
      select: { tokensUsed: true },
    });
    const totalTokens = [...analyses.map(a => a.tokensUsed), ...conversations.map(c => c.tokensUsed)].reduce((s, t) => s + t, 0);
    return {
      totalAnalyses: analyses.length,
      totalConversations: conversations.length,
      totalTokens,
      estimatedCostUSD: (totalTokens / 1000000 * 15).toFixed(2),
      lastAnalysis: analyses[0]?.generatedAt || null,
    };
  }

  async uploadKnowledgeBase(file: Express.Multer.File, userId: string) {
    if (!file) throw new Error('Nenhum arquivo enviado');

    let content = '';
    const mime = file.mimetype;

    if (mime === 'application/pdf') {
      try {
        const pdfData = await pdfParse(file.buffer);
        content = pdfData.text;
      } catch (e) {
        throw new Error('Erro ao processar PDF. Tente converter para .txt ou cole o texto manualmente.');
      }
    } else if (mime === 'text/plain' || mime === 'text/csv') {
      content = file.buffer.toString('utf-8');
    } else if (mime.includes('word') || mime.includes('officedocument')) {
      content = file.buffer.toString('utf-8').replace(/[^\x20-\x7E\xC0-\xFF\n\r\t]/g, ' ').replace(/\s{3,}/g, '\n');
      if (content.trim().length < 50) {
        throw new Error('Não foi possível extrair texto do Word. Por favor, salve como PDF e tente novamente.');
      }
    } else {
      throw new Error('Formato não suportado. Use PDF, Word ou TXT.');
    }

    if (!content || content.trim().length < 20) {
      throw new Error('Não foi possível extrair texto do arquivo. Tente um formato diferente.');
    }

    const existing = await this.prisma.advisorKnowledgeBase.findFirst({ where: { userId } });
    if (existing) {
      return this.prisma.advisorKnowledgeBase.update({
        where: { id: existing.id },
        data: { fileName: file.originalname, content: content.slice(0, 100000), updatedAt: new Date() },
      });
    }
    return this.prisma.advisorKnowledgeBase.create({
      data: { userId, fileName: file.originalname, content: content.slice(0, 100000) },
    });
  }

  async getKnowledgeBase(userId: string) {
    const kb = await this.prisma.advisorKnowledgeBase.findFirst({ where: { userId } });
    if (!kb) return null;
    return { id: kb.id, fileName: kb.fileName, contentLength: kb.content.length, updatedAt: kb.updatedAt };
  }

  async deleteKnowledgeBase(userId: string) {
    const kb = await this.prisma.advisorKnowledgeBase.findFirst({ where: { userId } });
    if (kb) await this.prisma.advisorKnowledgeBase.delete({ where: { id: kb.id } });
    return { deleted: true };
  }
}
