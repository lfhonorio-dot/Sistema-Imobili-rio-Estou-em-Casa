// Fase 6 — PDF "espelho" da NFS-e autorizada (resumo legível para o tomador
// e o contador). O documento oficial é o da prefeitura; o PDF traz o número,
// o código de verificação e o endereço de consulta.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface NfsePdfData {
  environment: string;
  numero: string;
  codigoVerificacao?: string | null;
  dataEmissao: Date;
  rps: string;
  prestador: { nome: string; cnpj: string; inscricaoMunicipal: string; municipio: string };
  tomador: { nome: string; documento: string; email?: string | null };
  discriminacao: string;
  itemListaServico: string;
  valores: {
    servicos: number; issAliquota: number; iss: number; issRetido: boolean;
    ir: number; pis: number; cofins: number; csll: number; issRetidoValor: number; totalRetido: number; liquido: number;
  };
  portalUrl: string;
}

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
const fmtDoc = (d: string) => {
  const x = d.replace(/\D/g, '');
  return x.length === 14 ? x.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    : x.length === 11 ? x.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : d;
};

/** Quebra o texto em linhas que cabem na largura (fonte Helvetica). */
function wrap(text: string, max: number, size: number, measure: (t: string, s: number) => number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const t = line ? `${line} ${word}` : word;
      if (measure(t, size) > max && line) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}

export async function buildNfsePdf(d: NfsePdfData): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const measure = (t: string, s: number) => font.widthOfTextAtSize(t, s);
  let y = 800;
  // a fonte padrão do PDF só tem o alfabeto latino: troca o resto (ex.: emoji) por '?'
  const safe = (t: string) => t.replace(/[^\x20-\xFF—–‘’“”•…]/g, '?');
  const text = (t: string, x: number, size = 10, f = font) => page.drawText(safe(t), { x, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
  const line = () => { page.drawLine({ start: { x: 40, y: y + 6 }, end: { x: 555, y: y + 6 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) }); y -= 8; };

  text('NOTA FISCAL DE SERVIÇO ELETRÔNICA — NFS-e', 40, 14, bold); y -= 18;
  text(`Prefeitura de ${d.prestador.municipio} · espelho da nota (documento oficial no portal da prefeitura)`, 40, 8); y -= 16;
  if (d.environment !== 'PRODUCTION') {
    text('AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL', 40, 12, bold); y -= 18;
  }
  text(`Número: ${d.numero}`, 40, 11, bold); text(`Emissão: ${d.dataEmissao.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, 300, 10); y -= 14;
  text(`Código de verificação: ${d.codigoVerificacao ?? '—'}`, 40); text(`RPS: ${d.rps}`, 300); y -= 18; line();

  text('PRESTADOR', 40, 9, bold); y -= 13;
  text(d.prestador.nome, 40); y -= 13;
  text(`CNPJ ${fmtDoc(d.prestador.cnpj)} · Inscrição municipal ${d.prestador.inscricaoMunicipal}`, 40); y -= 18; line();

  text('TOMADOR', 40, 9, bold); y -= 13;
  text(d.tomador.nome, 40); y -= 13;
  text(`${d.tomador.documento.replace(/\D/g, '').length === 14 ? 'CNPJ' : 'CPF'} ${fmtDoc(d.tomador.documento)}${d.tomador.email ? ` · ${d.tomador.email}` : ''}`, 40); y -= 18; line();

  text(`DISCRIMINAÇÃO DO SERVIÇO (item ${d.itemListaServico})`, 40, 9, bold); y -= 13;
  for (const l of wrap(d.discriminacao.replace(/[^\x20-\xFF—–‘’“”•…\n]/g, '?'), 515, 10, measure).slice(0, 18)) { text(l, 40); y -= 13; }
  y -= 6; line();

  const v = d.valores;
  const rows: Array<[string, string]> = [
    ['Valor dos serviços', brl(v.servicos)],
    [`ISS (${v.issAliquota.toFixed(2).replace('.', ',')}%)${v.issRetido ? ' — retido pelo tomador' : ''}`, brl(v.iss)],
    ['IR retido', brl(v.ir)], ['PIS retido', brl(v.pis)], ['COFINS retido', brl(v.cofins)], ['CSLL retido', brl(v.csll)],
    ['ISS retido', brl(v.issRetidoValor)], ['Total de retenções', brl(v.totalRetido)],
  ];
  text('VALORES', 40, 9, bold); y -= 13;
  for (const [k, val] of rows) { text(k, 40); text(val, 420); y -= 13; }
  text('Valor líquido', 40, 11, bold); text(brl(v.liquido), 420, 11, bold); y -= 20; line();
  text(`Consulte a autenticidade em: ${d.portalUrl}`, 40, 8);

  return Buffer.from(await pdf.save());
}
