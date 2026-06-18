import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

    const content = file.buffer.toString('utf-8');
    let entries: any[] = [];
    let format: 'OFX' | 'CSV' | 'JSON' = 'CSV';

    if (content.includes('<OFX>') || content.includes('<ofx>') || content.includes('OFXHEADER')) {
      format = 'OFX';
      entries = this.parseOFX(content);
    } else if (file.originalname.endsWith('.json')) {
      format = 'JSON';
      try { entries = JSON.parse(content); } catch { entries = []; }
    } else {
      format = 'CSV';
      entries = this.parseCSV(content);
    }

    const rules = await this.prisma.importRule.findMany({ where: { userId, isActive: true } });
    for (const entry of entries) {
      entry.category = this.autoClassify(entry.description, rules);
    }

    const log = await this.prisma.importLog.create({
      data: {
        userId,
        fileName: file.originalname,
        format,
        source: source as any,
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
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/"/g, ''));
    return lines.slice(1).map(line => {
      const cols = line.split(sep).map(c => c.trim().replace(/"/g, ''));
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = cols[i] || ''; });
      const val = parseFloat((obj.valor || obj.value || obj.amount || '0').replace(',', '.'));
      return { date: obj.data || obj.date || '', description: obj.descricao || obj.description || obj.historico || obj.memo || '', amount: Math.abs(val), entryType: val >= 0 ? 'CREDITO' : 'DEBITO', category: null };
    }).filter(e => e.description);
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
    ];
    const all = [...rules.map((r: any) => ({ keyword: r.keyword, category: r.targetCategory })), ...defaults];
    for (const r of all) {
      if (r.category && desc.includes(r.keyword.toUpperCase())) return r.category;
    }
    return null;
  }

  async confirmImport(userId: string, logId: string, entries: any[]) {
    let cashFlowCount = 0;
    const receitas = ['ALUGUEL','RECEBIVEIS_LOTEAMENTO','APOSENTADORIA','RENDIMENTO_FII','RENDIMENTO_RENDA_FIXA','DIVIDENDO','SALARIO','OUTRAS_RECEITAS'];
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
