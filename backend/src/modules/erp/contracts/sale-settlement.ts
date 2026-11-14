// Fase 4 — liquidação financeira da venda (função pura, em centavos).
//
// A partir da comissão total da imobiliária e das parcelas combinadas, monta:
//  - as contas A RECEBER (uma por parcela da comissão);
//  - as contas A PAGAR de cada beneficiário (corretor vendedor, captador,
//    parceiros), proporcionais a cada parcela: o corretor recebe quando a
//    imobiliária recebe. A soma por beneficiário fecha exatamente
//    comissão × % (a sobra de centavos vai na última parcela).

export type BeneficiaryKind = 'SELLER_BROKER' | 'CAPTOR' | 'PARTNER';

export interface BeneficiaryInput {
  kind: BeneficiaryKind;
  label: string;
  pct: number; // % da comissão da imobiliária
  userId?: string | null; // WorkspaceUser (corretores internos)
  contactId?: string | null; // contato (parceiros)
}

export interface InstallmentInput {
  dueDate: Date;
  amount: number;
}

export interface SettlementPlan {
  commissionTotal: number;
  receivables: Array<{ installment: number; totalInstallments: number; dueDate: Date; amount: number }>;
  payables: Array<{
    beneficiary: number; // índice em beneficiaries
    kind: BeneficiaryKind;
    label: string;
    userId?: string | null;
    contactId?: string | null;
    installment: number;
    totalInstallments: number;
    dueDate: Date;
    amount: number;
  }>;
  perBeneficiary: Array<{ kind: BeneficiaryKind; label: string; pct: number; amount: number }>;
  agencyNet: number;
}

const toC = (v: number) => Math.round(Number(v) * 100);
const fromC = (c: number) => c / 100;

/** Divide o total em N parcelas mensais iguais (sobra de centavos na última). */
export function equalInstallments(total: number, count: number, firstDueDate: Date): InstallmentInput[] {
  const totalC = toC(total);
  const base = Math.floor(totalC / count);
  const out: InstallmentInput[] = [];
  for (let i = 0; i < count; i++) {
    const due = new Date(firstDueDate);
    due.setUTCMonth(due.getUTCMonth() + i);
    out.push({ dueDate: due, amount: fromC(i === count - 1 ? totalC - base * (count - 1) : base) });
  }
  return out;
}

export function buildSettlement(input: {
  commissionTotal: number;
  installments: InstallmentInput[];
  beneficiaries: BeneficiaryInput[];
}): SettlementPlan {
  const totalC = toC(input.commissionTotal);
  if (totalC <= 0) throw new Error('A comissão total precisa ser maior que zero.');
  const n = input.installments.length;
  if (n < 1 || n > 60) throw new Error('Informe de 1 a 60 parcelas para a comissão.');
  const instC = input.installments.map((i) => toC(i.amount));
  if (instC.some((c) => c <= 0)) throw new Error('Todas as parcelas precisam ter valor maior que zero.');
  if (input.installments.some((i) => Number.isNaN(new Date(i.dueDate).getTime()))) {
    throw new Error('Há parcela com data de vencimento inválida.');
  }
  const sumC = instC.reduce((s, c) => s + c, 0);
  if (sumC !== totalC) {
    throw new Error(`A soma das parcelas (${fromC(sumC).toFixed(2)}) é diferente da comissão total (${fromC(totalC).toFixed(2)}).`);
  }
  const pctSum = input.beneficiaries.reduce((s, b) => s + Number(b.pct), 0);
  if (input.beneficiaries.some((b) => b.pct < 0 || b.pct > 100)) throw new Error('Percentual de repasse inválido.');
  if (pctSum > 100.0001) throw new Error('A soma dos repasses aos corretores passa de 100% da comissão.');

  const receivables = input.installments.map((i, idx) => ({
    installment: idx + 1, totalInstallments: n, dueDate: new Date(i.dueDate), amount: fromC(instC[idx]),
  }));

  const payables: SettlementPlan['payables'] = [];
  const perBeneficiary: SettlementPlan['perBeneficiary'] = [];
  let paidOutC = 0;
  input.beneficiaries.forEach((b, bi) => {
    if (!b.pct) return;
    const targetC = Math.round((totalC * b.pct) / 100);
    let soFar = 0;
    instC.forEach((ic, idx) => {
      const share = idx === n - 1 ? targetC - soFar : Math.round((ic * b.pct) / 100);
      soFar += share;
      if (share <= 0) return;
      payables.push({
        beneficiary: bi, kind: b.kind, label: b.label, userId: b.userId, contactId: b.contactId,
        installment: idx + 1, totalInstallments: n, dueDate: new Date(input.installments[idx].dueDate), amount: fromC(share),
      });
    });
    paidOutC += targetC;
    perBeneficiary.push({ kind: b.kind, label: b.label, pct: b.pct, amount: fromC(targetC) });
  });

  return { commissionTotal: fromC(totalC), receivables, payables, perBeneficiary, agencyNet: fromC(totalC - paidOutC) };
}

/** Itens padrão do checklist de pós-venda (prazo em dias após a ativação). */
export const DEFAULT_CHECKLIST: Array<{ key: string; title: string; days: number; financingOnly?: boolean }> = [
  { key: 'DOCS_PARTIES', title: 'Documentos das partes (comprador, vendedor e cônjuges)', days: 7 },
  { key: 'CREDIT_APPROVAL', title: 'Aprovação de crédito do comprador', days: 30, financingOnly: true },
  { key: 'BANK_APPRAISAL', title: 'Avaliação do imóvel pelo banco', days: 30, financingOnly: true },
  { key: 'ITBI', title: 'Guia e pagamento do ITBI', days: 45 },
  { key: 'DEED', title: 'Escritura (ou contrato de financiamento assinado)', days: 60 },
  { key: 'REGISTRY', title: 'Registro na matrícula (cartório de registro de imóveis)', days: 90 },
  { key: 'KEYS', title: 'Entrega das chaves', days: 90 },
];

/** Valor a partir do qual o pagamento em espécie merece atenção especial (COAF). */
export const CASH_ATTENTION_THRESHOLD = 100000;
