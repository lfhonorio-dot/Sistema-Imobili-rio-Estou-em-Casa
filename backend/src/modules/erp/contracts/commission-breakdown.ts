// Cálculo da comissão de um contrato de venda/intermediação e do repasse
// aos corretores parceiros. Função pura (sem banco), em centavos inteiros
// para não acumular erro de arredondamento.
//
// Regras (as mesmas usadas no recebimento da comissão, FinancialService):
// - Comissão total = valor da negociação × taxa de comissão (%).
// - Parceiro com regra PERCENTAGE recebe % da COMISSÃO (não do imóvel).
// - Parceiro com regra FIXED recebe o valor fixo informado.
// - A imobiliária fica com o que sobra.
// - Quando a comissão já foi recebida, o repasse é calculado sobre o valor
//   efetivamente recebido (pode diferir do previsto, ex.: desconto).

export interface PartnerRuleInput {
  recipientId: string;
  name: string;
  type: string; // PERCENTAGE | FIXED
  value: number; // % ou R$
}

export interface CommissionBreakdown {
  baseValue: number;
  commissionRate: number;
  commissionTotal: number;
  /** Base do repasse: valor recebido (se houver) ou a comissão prevista. */
  splitBase: number;
  splitBaseSource: 'PREVISTO' | 'RECEBIDO';
  partners: Array<{
    recipientId: string;
    name: string;
    type: string;
    percentage: number | null;
    amount: number;
  }>;
  partnersTotal: number;
  agencyAmount: number;
  agencyPercentage: number;
}

const toCents = (v: number) => Math.round(v * 100);
const fromCents = (c: number) => c / 100;

export function calcCommissionBreakdown(input: {
  baseValue: number;
  commissionRate: number;
  receivedValue?: number | null;
  /** Fase 4: comissão total combinada na ativação (substitui valor × taxa). */
  commissionTotalOverride?: number | null;
  partners: PartnerRuleInput[];
}): CommissionBreakdown {
  const baseValue = Number(input.baseValue) || 0;
  const commissionRate = Number(input.commissionRate) || 0;
  const commissionCents = input.commissionTotalOverride != null
    ? toCents(Number(input.commissionTotalOverride))
    : Math.round((toCents(baseValue) * commissionRate) / 100);

  const received = input.receivedValue != null ? Number(input.receivedValue) : null;
  const splitBaseCents = received != null ? toCents(received) : commissionCents;

  const partners = input.partners.map((p) => {
    const isFixed = p.type === 'FIXED';
    const amountCents = isFixed
      ? toCents(Number(p.value))
      : Math.round((splitBaseCents * Number(p.value)) / 100);
    return {
      recipientId: p.recipientId,
      name: p.name,
      type: isFixed ? 'FIXED' : 'PERCENTAGE',
      percentage: isFixed ? null : Number(p.value),
      amount: fromCents(amountCents),
      _cents: amountCents,
    };
  });

  const partnersCents = partners.reduce((s, p) => s + p._cents, 0);
  const agencyCents = splitBaseCents - partnersCents;

  return {
    baseValue,
    commissionRate,
    commissionTotal: fromCents(commissionCents),
    splitBase: fromCents(splitBaseCents),
    splitBaseSource: received != null ? 'RECEBIDO' : 'PREVISTO',
    partners: partners.map(({ _cents, ...p }) => p),
    partnersTotal: fromCents(partnersCents),
    agencyAmount: fromCents(agencyCents),
    agencyPercentage: splitBaseCents > 0 ? Math.round((agencyCents / splitBaseCents) * 10000) / 100 : 0,
  };
}
