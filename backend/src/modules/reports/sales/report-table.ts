// Fase 7 — formato único dos relatórios (tabela) e exportação Excel e PDF.

import * as ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type ColType = 'text' | 'money' | 'int' | 'pct' | 'date' | 'days';
export interface ReportColumn { key: string; label: string; type: ColType }
export interface ReportTable {
  key: string;
  title: string;
  subtitle?: string;
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | null>>;
  totals?: Record<string, string | number | null>;
  summary?: Array<{ label: string; value: string | number | null; type?: ColType }>;
  notes?: string[];
}

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

export function formatCell(v: unknown, t: ColType): string {
  if (v === null || v === undefined || v === '') return '—';
  switch (t) {
    case 'money': return brl(Number(v));
    case 'pct': return `${Number(v).toFixed(1).replace('.', ',')}%`;
    case 'int': return String(Math.round(Number(v)));
    case 'days': return `${Number(v).toFixed(0)} dia(s)`;
    case 'date': return new Date(String(v)).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    default: return String(v);
  }
}

export async function tableToXlsx(t: ReportTable): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Estou em Casa';
  const ws = wb.addWorksheet(t.title.slice(0, 31));
  ws.addRow([t.title]).font = { bold: true, size: 13 };
  if (t.subtitle) ws.addRow([t.subtitle]);
  for (const s of t.summary ?? []) ws.addRow([s.label, s.type ? formatCell(s.value, s.type) : s.value]);
  ws.addRow([]);
  ws.addRow(t.columns.map((c) => c.label)).font = { bold: true };
  for (const r of t.rows) {
    ws.addRow(t.columns.map((c) => {
      const v = r[c.key];
      if (v === null || v === undefined) return '';
      if (c.type === 'money' || c.type === 'int' || c.type === 'days') return Number(v);
      if (c.type === 'pct') return Number(v) / 100;
      if (c.type === 'date') return new Date(String(v));
      return v;
    }));
  }
  if (t.totals) ws.addRow(t.columns.map((c, i) => (i === 0 ? 'Total' : t.totals![c.key] ?? ''))).font = { bold: true };
  for (const n of t.notes ?? []) ws.addRow([n]);
  t.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = c.type === 'text' ? 30 : 16;
    if (c.type === 'money') col.numFmt = '"R$" #,##0.00';
    if (c.type === 'pct') col.numFmt = '0.0%';
    if (c.type === 'date') col.numFmt = 'dd/mm/yyyy';
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function tableToPdf(t: ReportTable, workspaceName: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const safe = (s: string) => s.replace(/[^\x20-\xFF—–‘’“”•…]/g, '?');
  const W = 842; const H = 595; const M = 30; const size = 8;
  const colW = (W - 2 * M) / t.columns.length;
  const fit = (s: string, f = font) => {
    let x = safe(s);
    while (x.length > 1 && f.widthOfTextAtSize(x, size) > colW - 4) x = x.slice(0, -2) + '…';
    return x;
  };
  let page = pdf.addPage([W, H]);
  let y = H - M;
  const header = () => {
    page.drawText(safe(`${workspaceName} — ${t.title}`), { x: M, y, size: 12, font: bold }); y -= 14;
    if (t.subtitle) { page.drawText(safe(t.subtitle), { x: M, y, size: 8, font }); y -= 12; }
    y -= 4;
    t.columns.forEach((c, i) => page.drawText(fit(c.label, bold), { x: M + i * colW, y, size, font: bold }));
    y -= 4;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
    y -= 11;
  };
  header();
  for (const s of t.summary ?? []) {
    page.drawText(safe(`${s.label}: ${s.type ? formatCell(s.value, s.type) : s.value ?? '—'}`), { x: M, y, size, font }); y -= 11;
  }
  if (t.summary?.length) y -= 4;
  const rows = [...t.rows, ...(t.totals ? [{ ...t.totals, __total: 1 }] : [])];
  for (const r of rows) {
    if (y < M + 20) { page = pdf.addPage([W, H]); y = H - M; header(); }
    const f = (r as Record<string, unknown>).__total ? bold : font;
    t.columns.forEach((c, i) => {
      const raw = (r as Record<string, unknown>)[c.key];
      const text = i === 0 && (r as Record<string, unknown>).__total ? 'Total' : formatCell(raw, c.type);
      page.drawText(fit(text, f), { x: M + i * colW, y, size, font: f });
    });
    y -= 11;
  }
  if (!t.rows.length) { page.drawText('Nenhum registro no período.', { x: M, y, size, font }); y -= 11; }
  for (const n of t.notes ?? []) { y -= 4; if (y < M) { page = pdf.addPage([W, H]); y = H - M; } page.drawText(safe(n).slice(0, 190), { x: M, y, size: 7, font }); y -= 10; }
  page.drawText(`Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, { x: M, y: 12, size: 7, font });
  return Buffer.from(await pdf.save());
}
