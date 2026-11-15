// Fase 6 — cálculo do ISS e das retenções na fonte da NFS-e (funções puras,
// em centavos). Nenhuma alíquota fixa: tudo vem da configuração fiscal.
//
// Retenções federais (IR, PIS, COFINS, CSLL) só quando o tomador é pessoa
// jurídica e as retenções estão ligadas. Regra de dispensa configurável
// (retMinAmount): IR abaixo do mínimo não é retido; PIS+COFINS+CSLL somados
// abaixo do mínimo também não.

export interface NfseTaxConfig {
  issRatePct: number;
  retentionsEnabled: boolean;
  retIrPct: number;
  retPisPct: number;
  retCofinsPct: number;
  retCsllPct: number;
  retMinAmount: number;
  retainIssWhenPj: boolean;
}

export interface NfseTaxes {
  base: number;
  issRatePct: number;
  issDue: number;
  issRetained: boolean;
  issRetainedAmount: number;
  irRetained: number;
  pisRetained: number;
  cofinsRetained: number;
  csllRetained: number;
  totalRetained: number;
  netAmount: number;
}

const c = (v: number) => Math.round(v * 100);
const r = (cents: number) => Math.round(cents) / 100;
const pct = (baseCents: number, p: number) => Math.round((baseCents * p) / 100);

export function computeNfseTaxes(amount: number, takerIsPj: boolean, cfg: NfseTaxConfig): NfseTaxes {
  if (!(amount > 0)) throw new Error('Valor da nota deve ser maior que zero.');
  if (cfg.issRatePct < 0 || cfg.issRatePct > 5) throw new Error('Alíquota de ISS inválida (de 0% a 5%).');
  const base = c(amount);
  const iss = pct(base, cfg.issRatePct);
  const min = c(cfg.retMinAmount);
  const retainFederal = takerIsPj && cfg.retentionsEnabled;

  let ir = retainFederal ? pct(base, cfg.retIrPct) : 0;
  if (ir > 0 && ir < min) ir = 0;

  let pis = retainFederal ? pct(base, cfg.retPisPct) : 0;
  let cofins = retainFederal ? pct(base, cfg.retCofinsPct) : 0;
  let csll = retainFederal ? pct(base, cfg.retCsllPct) : 0;
  if (pis + cofins + csll > 0 && pis + cofins + csll < min) { pis = 0; cofins = 0; csll = 0; }

  const issRetained = takerIsPj && cfg.retainIssWhenPj && iss > 0;
  const issRet = issRetained ? iss : 0;
  const total = ir + pis + cofins + csll + issRet;

  return {
    base: r(base),
    issRatePct: cfg.issRatePct,
    issDue: r(iss),
    issRetained,
    issRetainedAmount: r(issRet),
    irRetained: r(ir),
    pisRetained: r(pis),
    cofinsRetained: r(cofins),
    csllRetained: r(csll),
    totalRetained: r(total),
    netAmount: r(base - total),
  };
}

/** Documento só com dígitos; PF (11) ou PJ (14). */
export function takerKind(doc: string | null | undefined): 'PF' | 'PJ' | null {
  const d = (doc ?? '').replace(/\D/g, '');
  if (d.length === 11) return 'PF';
  if (d.length === 14) return 'PJ';
  return null;
}
