import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as XLSX from 'xlsx';

// Normaliza datas BR (dd/mm/aaaa), ISO (aaaa-mm-dd) e serial do Excel para aaaa-mm-dd
function normalizeDate(raw: any): string {
  if (raw === null || raw === undefined || raw === '') return '';
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw.toISOString().slice(0, 10);
  if (typeof raw === 'number') {
    // Serial de data do Excel (dias desde 30/12/1899)
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return '';
}

// Converte valores BR ("1.234,56") e internacionais ("1234.56") para número
function parseAmount(raw: any): number {
  if (typeof raw === 'number') return raw;
  const s = String(raw || '0').replace(/[R$\s]/g, '');
  if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  return parseFloat(s) || 0;
}

@Injectable()
export class ImportService {
  constructor(private prisma: PrismaService) {}

  async getLogs(userId: string) {
    return this.prisma.importLog.findMany({
      where: { userId },
      orderBy: { importedAt: 'desc' },
      take: 20,
    });
  }

  async getRules(userId: string) {
    return this.prisma.importRule.findMany({ where: { userId }, orderBy: { keyword: 'asc' } });
  }

  async createRule(userId: string, data: any) {
    return this.prisma.importRule.create({ data: { ...data, userId } });
  }

  async deleteRule(id: string) {
    return this.prisma.importRule.delete({ where: { id } });
  }

  async processUpload(userId: string, file: Express.Multer.File, source?: string) {
    if (!file) return { error: 'Arquivo não enviado' };

    let entries: any[] = [];
    let format: 'OFX' | 'CSV' | 'JSON' | 'XLS' = 'CSV';
    const lowerName = file.originalname.toLowerCase();

    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      format = 'XLS';
      entries = this.parseExcel(file.buffer);
    } else {
      const content = file.buffer.toString('utf-8');
      if (content.includes('<OFX>') || content.includes('<ofx>') || content.includes('OFXHEADER')) {
        format = 'OFX';
        entries = this.parseOFX(content);
      } else if (lowerName.endsWith('.json')) {
        format = 'JSON';
        try { entries = JSON.parse(content); } catch { entries = []; }
      } else {
        format = 'CSV';
        entries = this.parseCSV(content);
      }
    }

    const rules = await this.prisma.importRule.findMany({ where: { userId, isActive: true } });
    for (const entry of entries) {
      entry.category = this.autoClassify(entry.description, rules);
    }

    // O banco/origem é só um rótulo — se vier um valor fora do enum, não pode
    // travar a importação. Cai para OUTRO quando não reconhecido.
    const validSources = ['EQI', 'BRADESCO', 'ITAU', 'SANTANDER', 'BB', 'CAIXA', 'XP', 'BTG', 'RICO', 'NUINVEST', 'B3', 'OUTRO'];
    const safeSource = source && validSources.includes(source) ? source : (source ? 'OUTRO' : undefined);

    const log = await this.prisma.importLog.create({
      data: {
        userId,
        fileName: file.originalname,
        format,
        source: safeSource as any,
        recordsTotal: entries.length,
      },
    });

    return { logId: log.id, format, entries, total: entries.length };
  }

  private parseOFX(content: string) {
    const entries: any[] = [];
    const re = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match;
    while ((match = re.exec(content)) !== null) {
      const block = match[1];
      const g = (tag: string) => { const m = new RegExp(`<${tag}>([^<]+)`, 'i').exec(block); return m ? m[1].trim() : ''; };
      const amount = parseFloat(g('TRNAMT') || '0');
      const raw = g('DTPOSTED');
      const date = raw.length >= 8 ? `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}` : '';
      entries.push({ date, description: g('MEMO') || g('NAME'), amount: Math.abs(amount), entryType: amount >= 0 ? 'CREDITO' : 'DEBITO', category: null });
    }
    return entries;
  }

  private parseCSV(content: string) {
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    // Separador mais provável (bancos BR usam ; com frequência)
    const sepCount = (s: string, c: string) => (s.match(new RegExp('\\' + c, 'g')) || []).length;
    const sample = lines.slice(0, 10).join('\n');
    const sep = sepCount(sample, ';') >= sepCount(sample, ',') ? ';' : (sepCount(sample, '\t') > 0 ? '\t' : ',');

    const split = (line: string) => line.split(sep).map(c => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

    // Procura a linha de cabeçalho (tem Data + Valor/Histórico), ignorando
    // linhas de título no topo comuns em extratos (banco, conta, período)
    let headerIdx = -1;
    for (let i = 0; i < Math.min(lines.length, 40); i++) {
      const cells = split(lines[i]).map(c => c.toLowerCase());
      const hasDate = cells.some(c => c === 'data' || c.startsWith('data') || c === 'dt');
      const hasValueOrDesc = cells.some(c => /valor|hist|lan[çc]|descr|cr[eé]dito|d[eé]bito|value|amount|documento/.test(c));
      if (hasDate && hasValueOrDesc) { headerIdx = i; break; }
    }
    if (headerIdx === -1) headerIdx = 0; // sem título: assume 1ª linha
    const headers = split(lines[headerIdx]).map(h => h.toLowerCase());

    return lines.slice(headerIdx + 1).map(line => {
      const cols = split(line);
      const obj: any = {};
      headers.forEach((h, i) => { if (h) obj[h] = cols[i] || ''; });
      return this.rowToEntry(obj);
    }).filter(e => e.description && e.date);
  }

  // Lê TODAS as abas da planilha — cada aba pode ser um extrato diferente.
  // Extratos de banco costumam ter linhas de título antes da tabela, então
  // procuramos a linha de cabeçalho real (que tem Data + Valor/Histórico).
  private parseExcel(buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const entries: any[] = [];
    const isHeaderCell = (c: string) =>
      /^data|data$|hist|lan[çc]|descr|valor|cr[eé]dito|d[eé]bito|value|amount/.test(c);
    for (const sheetName of workbook.SheetNames) {
      const grid: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false });
      // localiza a linha de cabeçalho: tem uma coluna de "data" E uma de valor/histórico
      let headerIdx = -1;
      for (let i = 0; i < Math.min(grid.length, 40); i++) {
        const cells = grid[i].map((c: any) => String(c).trim().toLowerCase());
        const hasDate = cells.some(c => c === 'data' || c.startsWith('data') || c === 'dt');
        const hasValueOrDesc = cells.some(c => /valor|hist|lan[çc]|descr|cr[eé]dito|d[eé]bito|value|amount/.test(c));
        if (hasDate && hasValueOrDesc) { headerIdx = i; break; }
      }
      if (headerIdx === -1) continue;
      const headers = grid[headerIdx].map((c: any) => String(c).trim().toLowerCase());
      for (let i = headerIdx + 1; i < grid.length; i++) {
        const obj: any = {};
        headers.forEach((h: string, idx: number) => { if (h) obj[h] = grid[i][idx] ?? ''; });
        const entry = this.rowToEntry(obj);
        if (entry.description && entry.date) entries.push(entry);
      }
    }
    return entries;
  }

  // Mapeia uma linha (CSV ou Excel) para lançamento, aceitando cabeçalhos comuns
  // de bancos brasileiros: data, descricao/histórico/lançamento, valor
  private rowToEntry(obj: any) {
    // Procura a primeira chave cujo nome contenha um dos termos (tolerante a
    // variações de cabeçalho entre bancos)
    const pick = (terms: string[]) => {
      for (const [k, v] of Object.entries(obj)) {
        const key = k.toLowerCase();
        if (terms.some(t => key.includes(t)) && v !== '' && v != null) return v;
      }
      return '';
    };

    const rawDate = pick(['data', 'date', 'dt']);
    const description = String(
      pick(['descr', 'hist', 'lan', 'memo', 'lançamento', 'name']) || ''
    ).trim();

    // Valor único, ou colunas separadas de crédito/débito
    let val = parseAmount(pick(['valor', 'value', 'amount', 'montante']) || 0);
    if (!val) {
      const credito = parseAmount(pick(['crédito', 'credito', 'entrada']) || 0);
      const debito = parseAmount(pick(['débito', 'debito', 'saída', 'saida']) || 0);
      if (credito || debito) val = credito - Math.abs(debito);
    }

    return {
      date: normalizeDate(rawDate),
      description,
      amount: Math.abs(val),
      entryType: val >= 0 ? 'CREDITO' : 'DEBITO',
      category: null,
    };
  }

  private autoClassify(description: string, rules: any[]) {
    const desc = (description || '').toUpperCase();
    const defaults = [
      { keyword: 'ALUGUEL', category: 'ALUGUEL' }, { keyword: 'ALUG', category: 'ALUGUEL' },
      { keyword: 'RENDIMENTO FII', category: 'RENDIMENTO_FII' }, { keyword: ' FII', category: 'RENDIMENTO_FII' },
      { keyword: 'DIVIDENDO', category: 'DIVIDENDO' },
      { keyword: 'LOTEAMENTO', category: 'RECEBIVEIS_LOTEAMENTO' }, { keyword: 'CARTEIRA', category: 'RECEBIVEIS_LOTEAMENTO' },
      { keyword: 'APOSENTADORIA', category: 'APOSENTADORIA' }, { keyword: 'INSS', category: 'APOSENTADORIA' }, { keyword: 'BENEFICIO', category: 'APOSENTADORIA' },
      { keyword: 'IPTU', category: 'IPTU' }, { keyword: 'CONDOMINIO', category: 'CONDOMINIO' },
      { keyword: 'DARF', category: 'IR_DARF' }, { keyword: ' IR ', category: 'IR_DARF' },
      { keyword: 'SALARIO', category: 'SALARIO' }, { keyword: 'SALÁRIO', category: 'SALARIO' },
      { keyword: 'PRO LABORE', category: 'PRO_LABORE' }, { keyword: 'PRO-LABORE', category: 'PRO_LABORE' },
      { keyword: 'DIVIDENDOS', category: 'DIVIDENDO' },
      { keyword: 'CEMIG', category: 'ENERGIA' }, { keyword: 'ENERGIA', category: 'ENERGIA' }, { keyword: 'ELETRIC', category: 'ENERGIA' },
      { keyword: 'SANEAMENTO', category: 'AGUA' }, { keyword: 'SABESP', category: 'AGUA' }, { keyword: 'COPASA', category: 'AGUA' },
      { keyword: 'VIVO', category: 'TELEFONE_INTERNET' }, { keyword: 'CLARO', category: 'TELEFONE_INTERNET' }, { keyword: 'TIM', category: 'TELEFONE_INTERNET' }, { keyword: 'OI ', category: 'TELEFONE_INTERNET' }, { keyword: 'INTERNET', category: 'TELEFONE_INTERNET' },
      { keyword: 'POSTO', category: 'COMBUSTIVEL' }, { keyword: 'COMBUSTIVEL', category: 'COMBUSTIVEL' }, { keyword: 'IPIRANGA', category: 'COMBUSTIVEL' }, { keyword: 'SHELL', category: 'COMBUSTIVEL' },
      { keyword: 'UBER', category: 'TRANSPORTE' }, { keyword: '99 ', category: 'TRANSPORTE' }, { keyword: 'ESTACIONAMENTO', category: 'TRANSPORTE' },
      { keyword: 'SUPERMERCADO', category: 'ALIMENTACAO' }, { keyword: 'MERCADO', category: 'ALIMENTACAO' }, { keyword: 'PADARIA', category: 'ALIMENTACAO' }, { keyword: 'IFOOD', category: 'ALIMENTACAO' }, { keyword: 'RESTAURANTE', category: 'ALIMENTACAO' },
      { keyword: 'DROGARIA', category: 'FARMACIA' }, { keyword: 'FARMACIA', category: 'FARMACIA' }, { keyword: 'DROGA', category: 'FARMACIA' },
      { keyword: 'ESCOLA', category: 'EDUCACAO' }, { keyword: 'FACULDADE', category: 'EDUCACAO' }, { keyword: 'CURSO', category: 'EDUCACAO' }, { keyword: 'MENSALIDADE', category: 'EDUCACAO' },
      { keyword: 'NETFLIX', category: 'ASSINATURAS' }, { keyword: 'SPOTIFY', category: 'ASSINATURAS' }, { keyword: 'AMAZON PRIME', category: 'ASSINATURAS' },
      { keyword: 'TARIFA', category: 'TARIFAS_BANCARIAS' }, { keyword: 'PACOTE DE SERVICOS', category: 'TARIFAS_BANCARIAS' }, { keyword: 'ANUIDADE', category: 'TARIFAS_BANCARIAS' },
      { keyword: 'APLICACAO', category: 'APORTE_INVESTIMENTO' }, { keyword: 'INVESTIMENTO', category: 'APORTE_INVESTIMENTO' }, { keyword: 'CDB', category: 'APORTE_INVESTIMENTO' }, { keyword: 'TESOURO', category: 'APORTE_INVESTIMENTO' },
      { keyword: 'SEGURO', category: 'SEGURO' },
      { keyword: 'PLANO DE SAUDE', category: 'PLANO_SAUDE' }, { keyword: 'UNIMED', category: 'PLANO_SAUDE' }, { keyword: 'AMIL', category: 'PLANO_SAUDE' },
    ];
    const all = [...rules.map((r: any) => ({ keyword: r.keyword, category: r.targetCategory })), ...defaults];
    for (const r of all) {
      if (r.category && desc.includes(r.keyword.toUpperCase())) return r.category;
    }
    return null;
  }

  async confirmImport(userId: string, logId: string, entries: any[]) {
    let cashFlowCount = 0;
    const receitas = ['ALUGUEL','RECEBIVEIS_LOTEAMENTO','APOSENTADORIA','RENDIMENTO_FII','RENDIMENTO_RENDA_FIXA','DIVIDENDO','SALARIO','PRO_LABORE','VENDA_IMOVEL','JUROS_RECEBIDOS','RESTITUICAO_IMPOSTO','OUTRAS_RECEITAS'];
    for (const entry of entries) {
      if (!entry.category || !entry.date) continue;
      try {
        const d = new Date(entry.date);
        if (isNaN(d.getTime())) continue;
        await this.prisma.cashFlowEntry.create({
          data: {
            userId, type: receitas.includes(entry.category) ? 'RECEITA' : 'DESPESA',
            category: entry.category, description: entry.description,
            amount: Number(entry.amount), month: d.getMonth() + 1, year: d.getFullYear(), date: d,
          },
        });
        cashFlowCount++;
      } catch { /* skip duplicates */ }
    }
    await this.prisma.importLog.update({ where: { id: logId }, data: { recordsUpdatedCashFlow: cashFlowCount } });
    return { success: true, recordsUpdatedCashFlow: cashFlowCount };
  }

  async rollback(logId: string) {
    await this.prisma.importLog.update({ where: { id: logId }, data: { rollbackAvailable: false } });
    return { success: true };
  }
}
