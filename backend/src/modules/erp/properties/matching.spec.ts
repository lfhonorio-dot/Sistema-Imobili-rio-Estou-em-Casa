import { matchProfileToProperty, InterestProfileInput, PropertyInput } from './matching';

const profile = (p: Partial<InterestProfileInput> = {}): InterestProfileInput => ({
  propertyTypes: [], cities: [], neighborhoods: [], ...p,
});
const property = (p: Partial<PropertyInput> = {}): PropertyInput => ({
  type: 'HOUSE', purpose: 'SALE', status: 'AVAILABLE', city: 'Franca', neighborhood: 'Centro',
  salePrice: 400000, bedrooms: 3, parkingSpaces: 2, ...p,
});

describe('matchProfileToProperty', () => {
  it('casa em Franca dentro da faixa: compatível com 100%', () => {
    const r = matchProfileToProperty(
      profile({ propertyTypes: ['HOUSE'], cities: ['Franca'], minPrice: 300000, maxPrice: 450000, minBedrooms: 3 }),
      property(),
    );
    expect(r.match).toBe(true);
    expect(r.score).toBe(100);
    expect(r.reasons).toContain('Dentro da faixa de preço');
  });

  it('ignora acentos e maiúsculas na cidade e no bairro', () => {
    const r = matchProfileToProperty(
      profile({ cities: ['patrocinio paulista'], neighborhoods: ['JARDIM SÃO JOSÉ'] }),
      property({ city: 'Patrocínio Paulista', neighborhood: 'Jardim Sao Jose' }),
    );
    expect(r.match).toBe(true);
    expect(r.score).toBe(100);
  });

  it('elimina tipo diferente', () => {
    const r = matchProfileToProperty(profile({ propertyTypes: ['APARTMENT'] }), property());
    expect(r.match).toBe(false);
    expect(r.rejectedBy).toMatch(/Tipo/);
  });

  it('aceita até 10% acima do máximo, com meia pontuação; acima disso elimina', () => {
    const near = matchProfileToProperty(profile({ maxPrice: 380000 }), property({ salePrice: 410000 }));
    expect(near.match).toBe(true);
    expect(near.score).toBe(50);
    const far = matchProfileToProperty(profile({ maxPrice: 350000 }), property({ salePrice: 400000 }));
    expect(far.match).toBe(false);
    expect(far.rejectedBy).toMatch(/acima/);
  });

  it('elimina imóvel vendido, reservado ou só de locação', () => {
    expect(matchProfileToProperty(profile({ propertyTypes: ['HOUSE'] }), property({ status: 'SOLD' })).match).toBe(false);
    expect(matchProfileToProperty(profile({ propertyTypes: ['HOUSE'] }), property({ purpose: 'RENTAL' })).match).toBe(false);
  });

  it('elimina quartos abaixo do mínimo e cidade diferente', () => {
    expect(matchProfileToProperty(profile({ minBedrooms: 4 }), property()).match).toBe(false);
    expect(matchProfileToProperty(profile({ cities: ['Ribeirão Preto'] }), property()).rejectedBy).toMatch(/Cidade/);
  });

  it('bairro diferente não elimina, só reduz a pontuação', () => {
    const r = matchProfileToProperty(profile({ cities: ['Franca'], neighborhoods: ['Jardim Paulista'] }), property());
    expect(r.match).toBe(true);
    expect(r.score).toBe(50);
  });

  it('perfil vazio não sugere nada', () => {
    expect(matchProfileToProperty(profile(), property()).match).toBe(false);
  });
});
