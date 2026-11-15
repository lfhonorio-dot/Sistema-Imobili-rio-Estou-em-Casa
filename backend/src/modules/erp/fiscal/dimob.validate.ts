// Fase 7 — validação da DIMOB de vendas antes de entregar:
//  1. PARTES: cada venda precisa de vendedor e comprador identificados
//     (CPF/CNPJ com dígitos verificadores válidos e nome), valor, data dentro
//     do ano e endereço do imóvel; o declarante precisa de CNPJ válido.
//  2. ARQUIVO: identificador "DIMOB", um R01, registros R02 (locação) /
//     R04 (intermediação de venda) com tamanho fixo e campos numéricos só
//     com dígitos, trailer T9 com a contagem certa, linhas terminadas em CR+LF.
// O programa da Receita (PGD) faz a validação final na importação.

import { RECORD_LENGTHS, type PgdSaleEvent } from './dimob.pgd';

export function validCpf(v: string | null | undefined): boolean {
  const d = (v ?? '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function validCnpj(v: string | null | undefined): boolean {
  const d = (v ?? '').replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (n: number) => {
    const w = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = w.reduce((acc, wi, i) => acc + Number(d[i]) * wi, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

export const validDoc = (v: string | null | undefined) => validCpf(v) || validCnpj(v);

export interface DimobIssue { level: 'ERROR' | 'WARNING'; where: string; message: string }

export function validateSaleParties(year: number, declarantDoc: string, sales: Array<PgdSaleEvent & { ref?: string }>): DimobIssue[] {
  const issues: DimobIssue[] = [];
  if (!validCnpj(declarantDoc)) issues.push({ level: 'ERROR', where: 'Declarante', message: 'CNPJ do declarante inválido.' });
  sales.forEach((s, i) => {
    const w = s.ref ?? `Venda ${i + 1}`;
    if (!s.sellerName?.trim()) issues.push({ level: 'ERROR', where: w, message: 'Vendedor sem nome.' });
    if (!validDoc(s.sellerDoc)) issues.push({ level: 'ERROR', where: w, message: `CPF/CNPJ do vendedor inválido ou ausente (${s.sellerName || 'sem nome'}).` });
    if (!s.buyerName?.trim()) issues.push({ level: 'ERROR', where: w, message: 'Comprador sem nome.' });
    if (!validDoc(s.buyerDoc)) issues.push({ level: 'ERROR', where: w, message: `CPF/CNPJ do comprador inválido ou ausente (${s.buyerName || 'sem nome'}).` });
    if (!(s.saleValue > 0)) issues.push({ level: 'ERROR', where: w, message: 'Valor da operação não informado.' });
    if (!(s.commissionValue >= 0)) issues.push({ level: 'ERROR', where: w, message: 'Valor da comissão inválido.' });
    if (!s.contractDate || new Date(s.contractDate).getFullYear() !== year) {
      issues.push({ level: 'ERROR', where: w, message: `Data do contrato fora do ano-calendário ${year}.` });
    }
    if (!s.propertyAddress?.trim() || s.propertyAddress.trim().length < 8) issues.push({ level: 'WARNING', where: w, message: 'Endereço do imóvel incompleto.' });
    if (s.sellerDoc && s.buyerDoc && s.sellerDoc.replace(/\D/g, '') === s.buyerDoc.replace(/\D/g, '')) {
      issues.push({ level: 'ERROR', where: w, message: 'Vendedor e comprador com o mesmo documento.' });
    }
  });
  return issues;
}

/** Confere a estrutura do arquivo gerado. */
export function validatePgdFile(content: string): DimobIssue[] {
  const issues: DimobIssue[] = [];
  if (!content.endsWith('\r\n')) issues.push({ level: 'ERROR', where: 'Arquivo', message: 'O arquivo deve terminar com quebra de linha CR+LF.' });
  if (/[^\r]\n/.test(content)) issues.push({ level: 'ERROR', where: 'Arquivo', message: 'Há linhas sem CR+LF.' });
  const lines = content.replace(/\r\n$/, '').split('\r\n');
  if (lines[0] !== 'DIMOB') issues.push({ level: 'ERROR', where: 'Linha 1', message: 'O arquivo deve começar com "DIMOB".' });
  const r01 = lines.filter((l) => l.startsWith('R01'));
  if (r01.length !== 1) issues.push({ level: 'ERROR', where: 'R01', message: `Deve haver exatamente um registro R01 (há ${r01.length}).` });
  const trailer = lines[lines.length - 1];
  const body = lines.slice(1, -1);
  if (!/^T9\d{9}$/.test(trailer ?? '')) issues.push({ level: 'ERROR', where: 'T9', message: 'Trailer T9 ausente ou mal formado.' });
  else if (Number(trailer.slice(2)) !== body.length) {
    issues.push({ level: 'ERROR', where: 'T9', message: `O trailer informa ${Number(trailer.slice(2))} registros, mas há ${body.length}.` });
  }
  body.forEach((l, i) => {
    const type = l.slice(0, 3);
    const where = `Linha ${i + 2} (${type})`;
    if (!RECORD_LENGTHS[type]) { issues.push({ level: 'ERROR', where, message: 'Tipo de registro desconhecido.' }); return; }
    if (l.length !== RECORD_LENGTHS[type]) issues.push({ level: 'ERROR', where, message: `Tamanho ${l.length}, esperado ${RECORD_LENGTHS[type]}.` });
    if (!/^\d{18}$/.test(l.slice(3, 21))) issues.push({ level: 'ERROR', where, message: 'CNPJ/ano do declarante com caracteres não numéricos.' });
    if (/[^\x20-\x7E]/.test(l)) issues.push({ level: 'ERROR', where, message: 'Caractere especial não permitido (use só letras sem acento, números e pontuação simples).' });
  });
  return issues;
}
