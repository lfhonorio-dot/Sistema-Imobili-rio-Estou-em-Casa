// Fase 5 — leitura de extrato bancário: OFX, CSV e planilha Excel (.xlsx).
// Funções puras (exceto o Excel, que usa o exceljs), testadas em spec.

import * as crypto from 'crypto';
import * as ExcelJS from 'exceljs';

export interface StatementLine {
  externalId: string;
  date: Date;
  amount: number; // positivo = crédito (entrada), negativo = débito (saída)
  description: string;
}

const hashId = (parts: string[]) => crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 32);

/** Gera ids estáveis para linhas sem identificador (reimportar o mesmo arquivo não duplica). */
function withStableIds(rows: Array<Omit<StatementLine, 'externalId'>>, prefix: string): StatementLine[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const base = `${r.date.toISOString().slice(0, 10)}|${r.amount.toFixed(2)}|${r.description.trim().toUpperCase()}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { ...r, externalId: `${prefix}_${hashId([base, String(n)])}` };
  });
}

/** "1.234,56" / "-1234.56" / "R$ 1.234,56" / "(150,00)" → número. */
export function parseMoney(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  let s = String(raw ?? '').trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/R\$|\s/gi, '');
  if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
  if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
  if (s.startsWith('+')) s = s.slice(1);
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.'); // 1.234,56
  else s = s.replace(/,/g, ''); // 1,234.56
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const v = Number(s);
  return neg ? -v : v;
}

/** "31/12/2026", "2026-12-31", "31-12-2026", Date → Date (meio-dia UTC). */
export function parseDate(raw: unknown): Date | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate(), 12));
  const s = String(raw ?? '').trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const d = new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1]), 12));
    return d.getUTCDate() === Number(m[1]) ? d : null;
  }
  m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
    return d.getUTCDate() === Number(m[3]) ? d : null;
  }
  return null;
}

export function parseOfx(content: string): StatementLine[] {
  const out: StatementLine[] = [];
  const blocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  for (const block of blocks) {
    const tag = (name: string) => (block.match(new RegExp(`<${name}>([^<\\r\\n]+)`, 'i')) || [])[1]?.trim();
    const fitid = tag('FITID');
    const amount = parseMoney(tag('TRNAMT')?.replace(',', '.'));
    const dt = tag('DTPOSTED');
    if (!fitid || amount === null || !dt) continue;
    const date = parseDate(dt.slice(0, 8));
    if (!date) continue;
    out.push({ externalId: fitid, amount, date, description: tag('MEMO') || tag('NAME') || '' });
  }
  return out;
}

const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const DATE_COLS = ['data', 'date', 'data lancamento', 'data do lancamento', 'dt', 'data mov', 'data movimento'];
const DESC_COLS = ['descricao', 'historico', 'description', 'memo', 'lancamento', 'detalhes', 'descricao do lancamento'];
const AMOUNT_COLS = ['valor', 'amount', 'valor (r$)', 'valor r$', 'quantia'];
const CREDIT_COLS = ['credito', 'entrada', 'credit', 'credito (r$)'];
const DEBIT_COLS = ['debito', 'saida', 'debit', 'debito (r$)'];

/** Converte uma tabela (linhas de células) em lançamentos de extrato. */
export function rowsToStatement(rows: unknown[][], prefix: string): StatementLine[] {
  const headerIdx = rows.findIndex((r) => r.some((c) => DATE_COLS.includes(norm(c))));
  if (headerIdx < 0) {
    throw new Error('Não encontrei o cabeçalho do extrato. A planilha precisa de colunas "Data", "Descrição" e "Valor" (ou "Crédito"/"Débito").');
  }
  const header = rows[headerIdx].map(norm);
  const col = (names: string[]) => header.findIndex((h) => names.includes(h));
  const iDate = col(DATE_COLS);
  const iDesc = col(DESC_COLS);
  const iAmt = col(AMOUNT_COLS);
  const iCred = col(CREDIT_COLS);
  const iDeb = col(DEBIT_COLS);
  if (iAmt < 0 && iCred < 0 && iDeb < 0) {
    throw new Error('Não encontrei a coluna de valor. Use "Valor" (com sinal) ou "Crédito" e "Débito".');
  }
  const out: Array<Omit<StatementLine, 'externalId'>> = [];
  const errors: number[] = [];
  rows.slice(headerIdx + 1).forEach((r, i) => {
    if (!r || r.every((c) => String(c ?? '').trim() === '')) return;
    const date = parseDate(r[iDate]);
    let amount: number | null = null;
    if (iAmt >= 0) amount = parseMoney(r[iAmt]);
    else {
      const c = iCred >= 0 ? parseMoney(r[iCred]) ?? 0 : 0;
      const d = iDeb >= 0 ? parseMoney(r[iDeb]) ?? 0 : 0;
      amount = Math.abs(c) - Math.abs(d);
    }
    if (!date || amount === null || amount === 0) {
      if (date || amount) errors.push(headerIdx + i + 2);
      return;
    }
    out.push({ date, amount: Math.round(amount * 100) / 100, description: String(iDesc >= 0 ? r[iDesc] ?? '' : '').trim() });
  });
  if (errors.length && !out.length) {
    throw new Error(`Não consegui ler as linhas do extrato (linhas ${errors.slice(0, 5).join(', ')}). Confira datas (dd/mm/aaaa) e valores.`);
  }
  return withStableIds(out, prefix);
}

/** CSV com ; ou , (detecta), aspas opcionais. */
export function parseCsv(content: string): StatementLine[] {
  const text = content.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const delim = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
      } else if (ch === delim && !q) { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    rows.push(cells.map((c) => c.trim()));
  }
  return rowsToStatement(rows, 'CSV');
}

export async function parseXlsx(buffer: Buffer): Promise<StatementLine[]> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as any);
  } catch {
    throw new Error('Não consegui abrir a planilha. Envie um arquivo .xlsx (Excel).');
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('A planilha está vazia.');
  const rows: unknown[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals = (row.values as unknown[]).slice(1).map((v) => {
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        const o = v as { result?: unknown; text?: unknown; richText?: Array<{ text: string }> };
        return o.result ?? o.text ?? o.richText?.map((t) => t.text).join('') ?? '';
      }
      return v;
    });
    rows.push(vals);
  });
  return rowsToStatement(rows, 'XLSX');
}
