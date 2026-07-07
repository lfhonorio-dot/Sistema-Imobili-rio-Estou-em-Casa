// Gerador do arquivo TXT de importação do PGD DIMOB (leiaute posicional).
//
// Estrutura (IN RFB 1.115/2010 — leiaute do programa gerador):
//   Linha 1 : "DIMOB" — identificador do arquivo
//   R01     : dados do declarante (um por arquivo)
//   R02     : operações de VENDA/INTERMEDIAÇÃO (uma linha por operação)
//   R03     : LOCAÇÃO (uma linha por contrato/locador/locatário no ano, com
//             12 pares de valores mensais: rendimento bruto e comissão)
//   T9      : trailer (totalizador)
//
// IMPORTANTE: as larguras/posições abaixo estão centralizadas nos helpers e
// nas constantes de campo para calibração rápida contra o leiaute oficial do
// PGD do ano-calendário vigente. O próprio PGD valida o arquivo na importação
// e aponta divergências de posição — validar com o contador antes da entrega.

export interface PgdDeclarant {
  cnpj: string;
  name: string;
  year: number;
}

export interface PgdSaleEvent {
  sellerDoc: string;
  sellerName: string;
  buyerDoc: string;
  buyerName: string;
  saleValue: number;      // valor da operação (R$)
  commissionValue: number; // parcela da comissão do declarante (R$)
  contractDate: Date;      // data de contratação (assinatura)
  propertyAddress: string;
}

export interface PgdRentalYear {
  landlordDoc: string;
  landlordName: string;
  tenantDoc: string;
  tenantName: string;
  propertyAddress: string;
  // índice 0 = janeiro ... 11 = dezembro
  monthlyGross: number[];      // rendimento bruto pago no mês
  monthlyCommission: number[]; // comissão/taxa adm do declarante no mês
  monthlyTax: number[];        // imposto retido no mês (se houver)
}

// ── helpers de formatação posicional ─────────────────────────

// Texto: maiúsculas, sem acentos, alinhado à esquerda, truncado/preenchido
export function text(value: string | null | undefined, width: number): string {
  const clean = (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 .,\-\/]/g, ' ');
  return clean.slice(0, width).padEnd(width, ' ');
}

// Numérico: apenas dígitos, alinhado à direita com zeros
export function digits(value: string | null | undefined, width: number): string {
  const clean = (value ?? '').replace(/\D/g, '');
  return clean.slice(-width).padStart(width, '0');
}

// Valor monetário em centavos, sem separadores (ex.: R$ 1.234,56 -> "123456")
export function money(value: number | null | undefined, width = 14): string {
  const cents = Math.round(Math.abs(Number(value ?? 0)) * 100);
  return String(cents).slice(-width).padStart(width, '0');
}

// Data DDMMAAAA
export function ddmmaaaa(d: Date | null | undefined): string {
  if (!d) return '00000000';
  const dt = new Date(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${dd}${mm}${dt.getFullYear()}`;
}

// ── registros ────────────────────────────────────────────────

export function buildR01(d: PgdDeclarant): string {
  return [
    'R01',
    digits(d.cnpj, 14),
    String(d.year).padStart(4, '0'),
    '0', // 0 = original, 1 = retificadora
    text(d.name, 60),
  ].join('');
}

export function buildR02(declarant: PgdDeclarant, e: PgdSaleEvent): string {
  return [
    'R02',
    digits(declarant.cnpj, 14),
    String(declarant.year).padStart(4, '0'),
    digits(e.sellerDoc, 14),
    text(e.sellerName, 60),
    digits(e.buyerDoc, 14),
    text(e.buyerName, 60),
    ddmmaaaa(e.contractDate),
    money(e.saleValue),
    money(e.commissionValue),
    text(e.propertyAddress, 120),
  ].join('');
}

export function buildR03(declarant: PgdDeclarant, r: PgdRentalYear): string {
  const months: string[] = [];
  for (let m = 0; m < 12; m++) {
    months.push(money(r.monthlyGross[m] ?? 0));
    months.push(money(r.monthlyCommission[m] ?? 0));
    months.push(money(r.monthlyTax[m] ?? 0));
  }
  return [
    'R03',
    digits(declarant.cnpj, 14),
    String(declarant.year).padStart(4, '0'),
    digits(r.landlordDoc, 14),
    text(r.landlordName, 60),
    digits(r.tenantDoc, 14),
    text(r.tenantName, 60),
    ...months,
    text(r.propertyAddress, 120),
  ].join('');
}

export function buildT9(totalRecords: number): string {
  return `T9${String(totalRecords).padStart(9, '0')}`;
}

// Monta o arquivo completo (CRLF, encerrado com quebra de linha)
export function buildPgdFile(
  declarant: PgdDeclarant,
  sales: PgdSaleEvent[],
  rentals: PgdRentalYear[],
): string {
  const lines: string[] = ['DIMOB'];
  lines.push(buildR01(declarant));
  for (const s of sales) lines.push(buildR02(declarant, s));
  for (const r of rentals) lines.push(buildR03(declarant, r));
  lines.push(buildT9(lines.length - 1)); // R01+R02*+R03* (exclui identificador)
  return lines.join('\r\n') + '\r\n';
}
