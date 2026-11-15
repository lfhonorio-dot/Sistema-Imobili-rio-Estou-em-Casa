// Compatibilidade entre o perfil de interesse de um cliente e um imóvel
// (Fase 2). Função pura: usada tanto para "imóveis compatíveis com o
// cliente" quanto para "clientes compatíveis com o imóvel".
//
// Regras:
//  - Eliminatórias: tipo fora da lista desejada; preço acima do máximo em
//    mais de 10%; preço abaixo do mínimo em mais de 10%; quartos abaixo do
//    mínimo; imóvel indisponível ou só para locação.
//  - Pontuação (0–100): cada critério que o cliente preencheu vale pesos
//    iguais entre si; o resultado é a média dos critérios atendidos. Assim,
//    um perfil com poucos critérios não é penalizado pelos que faltam.

export interface InterestProfileInput {
  propertyTypes: string[];
  cities: string[];
  neighborhoods: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  minBedrooms?: number | null;
  minParkingSpaces?: number | null;
}

export interface PropertyInput {
  type: string;
  purpose: string;
  status: string;
  city?: string | null;
  neighborhood?: string | null;
  salePrice?: number | null;
  bedrooms?: number | null;
  parkingSpaces?: number | null;
}

export interface MatchResult {
  match: boolean;
  score: number;
  reasons: string[];
  /** Motivo pelo qual não é compatível (quando match = false). */
  rejectedBy?: string;
}

/** Tolerância de preço: 10% acima do máximo / abaixo do mínimo. */
export const PRICE_TOLERANCE = 0.1;

export function normalizeText(v?: string | null): string {
  return (v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

const brl = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export function matchProfileToProperty(profile: InterestProfileInput, property: PropertyInput): MatchResult {
  const reject = (rejectedBy: string): MatchResult => ({ match: false, score: 0, reasons: [], rejectedBy });

  if (property.status !== 'AVAILABLE') return reject('Imóvel não está disponível');
  if (property.purpose === 'RENTAL') return reject('Imóvel só para locação');

  const reasons: string[] = [];
  let criteria = 0;
  let points = 0;

  // Tipo
  if (profile.propertyTypes.length) {
    criteria++;
    if (!profile.propertyTypes.includes(property.type)) return reject('Tipo de imóvel diferente do desejado');
    points++;
    reasons.push('Tipo desejado');
  }

  // Preço
  const price = property.salePrice != null ? Number(property.salePrice) : null;
  const min = profile.minPrice != null ? Number(profile.minPrice) : null;
  const max = profile.maxPrice != null ? Number(profile.maxPrice) : null;
  if (min != null || max != null) {
    criteria++;
    if (price == null) {
      // sem preço cadastrado: não elimina, mas não pontua
    } else {
      if (max != null && price > max * (1 + PRICE_TOLERANCE)) return reject('Preço acima da faixa do cliente');
      if (min != null && price < min * (1 - PRICE_TOLERANCE)) return reject('Preço abaixo da faixa do cliente');
      const inside = (max == null || price <= max) && (min == null || price >= min);
      if (inside) {
        points++;
        reasons.push('Dentro da faixa de preço');
      } else {
        points += 0.5;
        reasons.push(`Preço próximo da faixa (${brl(price)})`);
      }
    }
  }

  // Quartos
  if (profile.minBedrooms != null && profile.minBedrooms > 0) {
    criteria++;
    if ((property.bedrooms ?? 0) < profile.minBedrooms) return reject('Menos quartos que o desejado');
    points++;
    reasons.push(`${property.bedrooms} quarto(s)`);
  }

  // Vagas (não elimina — só pontua)
  if (profile.minParkingSpaces != null && profile.minParkingSpaces > 0) {
    criteria++;
    if ((property.parkingSpaces ?? 0) >= profile.minParkingSpaces) {
      points++;
      reasons.push('Vagas de garagem atendem');
    }
  }

  // Cidade
  if (profile.cities.length) {
    criteria++;
    const city = normalizeText(property.city);
    if (city && profile.cities.some((c) => normalizeText(c) === city)) {
      points++;
      reasons.push(`Cidade: ${property.city}`);
    }
  }

  // Bairro
  if (profile.neighborhoods.length) {
    criteria++;
    const nb = normalizeText(property.neighborhood);
    if (nb && profile.neighborhoods.some((n) => normalizeText(n) === nb)) {
      points++;
      reasons.push(`Bairro: ${property.neighborhood}`);
    }
  }

  if (criteria === 0) {
    return { match: false, score: 0, reasons: [], rejectedBy: 'Perfil de interesse sem critérios preenchidos' };
  }

  // Cidade informada e não atendida elimina (o cliente quer outra cidade).
  if (profile.cities.length && !reasons.some((r) => r.startsWith('Cidade:'))) {
    return reject('Cidade diferente da desejada');
  }

  return { match: true, score: Math.round((points / criteria) * 100), reasons };
}
