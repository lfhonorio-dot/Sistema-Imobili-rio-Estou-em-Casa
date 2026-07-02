// Lógica pura de rateio DIMOB entre declarantes (imobiliária + corretores parceiros).
// Regras (IN RFB 1.115/2010 + COSIT 237/2019):
//  - Cada PJ participante (imobiliária + parceiro com CNPJ) tem seu PRÓPRIO registro,
//    com valores proporcionais à sua participação.
//  - Corretor parceiro pessoa física autônoma (CPF, sem CNPJ) NÃO é declarante: sua
//    parcela é atribuída ao registro da imobiliária.

export interface PartnerShareInput {
  name: string;
  document: string | null; // CPF ou CNPJ
  documentType: string | null; // 'CPF' | 'CNPJ'
  percentage: number; // % da comissão destinado a este parceiro
}

export interface ImobiliariaInput {
  name: string;
  cnpj: string | null;
}

export interface DimobDeclarant {
  declarantDoc: string;
  declarantName: string;
  declarantType: 'PJ' | 'PF';
  participationPct: number; // % da comissão que ESTE declarante reporta
  commissionAmount: number; // valor da comissão atribuído a este declarante
}

// Retorna a lista de declarantes DIMOB com valores proporcionais.
export function computeDimobDeclarants(
  imobiliaria: ImobiliariaInput,
  partners: PartnerShareInput[],
  commissionTotal: number,
): DimobDeclarant[] {
  const isCnpj = (p: PartnerShareInput) =>
    (p.documentType ?? '').toUpperCase() === 'CNPJ' && !!p.document;

  const pjPartners = partners.filter(isCnpj);
  const pfPartners = partners.filter((p) => !isCnpj(p)); // PF autônomo ou sem doc

  const partnersPct = partners.reduce((s, p) => s + Number(p.percentage), 0);
  const pfPct = pfPartners.reduce((s, p) => s + Number(p.percentage), 0);
  const agencyBasePct = Math.max(0, 100 - partnersPct);

  // Imobiliária declara sua parte + a parte dos parceiros PF autônomos
  const imobiliariaPct = agencyBasePct + pfPct;

  const declarants: DimobDeclarant[] = [];

  declarants.push({
    declarantDoc: imobiliaria.cnpj ?? '',
    declarantName: imobiliaria.name,
    declarantType: 'PJ',
    participationPct: round2(imobiliariaPct),
    commissionAmount: round2((commissionTotal * imobiliariaPct) / 100),
  });

  for (const p of pjPartners) {
    declarants.push({
      declarantDoc: p.document as string,
      declarantName: p.name,
      declarantType: 'PJ',
      participationPct: round2(Number(p.percentage)),
      commissionAmount: round2((commissionTotal * Number(p.percentage)) / 100),
    });
  }

  return declarants;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
