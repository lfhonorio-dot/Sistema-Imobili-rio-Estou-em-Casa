/**
 * Testes de Homologação — Etapa 5: Marketing
 * Meta Ads, Google Ads e Portais Imobiliários
 */
import * as request from 'supertest';

const BASE = 'http://localhost:3001/api/v1';
const WS = '20c4942a-ae70-4299-9e97-f13181c73bcf';

let token: string;
let createdPropertyId: string;
let publicationId: string;

function auth() {
  return {
    Authorization: `Bearer ${token}`,
    'x-workspace-id': WS,
    'Content-Type': 'application/json',
  };
}

beforeAll(async () => {
  const res = await request(BASE)
    .post('/auth/login')
    .send({ email: 'admin@homolog.com', password: 'Homolog@Etapa3!' });
  token = res.body.data?.tokens?.accessToken ?? res.body.data?.accessToken;
  expect(token).toBeTruthy();

  // Cria um imóvel para usar nos testes de portais
  const propRes = await request(BASE)
    .post('/properties')
    .set(auth())
    .send({
      type: 'APARTMENT',
      purpose: 'RENTAL',
      city: 'São Paulo',
      state: 'SP',
      street: 'Rua Teste Marketing',
      number: '100',
    });
  createdPropertyId = propRes.body.data?.id;
});

// ── META ADS ──────────────────────────────────────────────────

describe('Meta Ads — Integração', () => {
  it('salva integração Meta', async () => {
    const res = await request(BASE)
      .post('/marketing/meta/integration')
      .set(auth())
      .send({ accessToken: 'EAAtest123', accountId: 'act_987654321' });
    expect(res.status).toBe(201);
    expect(res.body.data?.provider).toBe('META_ADS');
  });

  it('busca integração Meta', async () => {
    const res = await request(BASE).get('/marketing/meta/integration').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data?.provider).toBe('META_ADS');
    expect(res.body.data?.accessToken).toBe('***');
  });
});

describe('Meta Ads — Campanhas', () => {
  it('sincroniza campanhas Meta', async () => {
    const res = await request(BASE).post('/marketing/meta/campaigns/sync').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data?.synced).toBeGreaterThan(0);
    expect(Array.isArray(res.body.data?.campaigns)).toBe(true);
  });

  it('lista campanhas Meta', async () => {
    const res = await request(BASE).get('/marketing/meta/campaigns').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    const campaign = res.body.data[0];
    expect(campaign).toHaveProperty('name');
    expect(campaign).toHaveProperty('spend');
    expect(campaign).toHaveProperty('leads');
  });
});

describe('Meta Ads — Field Mappings', () => {
  it('salva mapeamento de campos', async () => {
    const res = await request(BASE)
      .post('/marketing/meta/field-mappings')
      .set(auth())
      .send({ mappings: { full_name: 'name', email: 'email', phone_number: 'phone' } });
    expect(res.status).toBe(200);
    expect(res.body.data?.mappings).toBeDefined();
  });

  it('busca mapeamento de campos', async () => {
    const res = await request(BASE).get('/marketing/meta/field-mappings').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data?.mappings).toBeDefined();
  });
});

describe('Meta Ads — Webhook e CAPI', () => {
  it('processa webhook de lead (público)', async () => {
    const res = await request(BASE)
      .post('/marketing/meta/webhook')
      .send({
        object: 'page',
        entry: [{
          changes: [{
            value: {
              leadgen_id: 'lg_test_123',
              campaign_name: 'Campanha Teste',
              field_data: [
                { name: 'full_name', values: ['João Teste Meta'] },
                { name: 'email', values: ['joao.meta@test.com'] },
              ],
            },
          }],
        }],
      });
    expect(res.status).toBe(200);
    expect(res.body.data?.received).toBe(true);
  });

  it('envia evento CAPI', async () => {
    const res = await request(BASE)
      .post('/marketing/meta/capi')
      .set(auth())
      .send({ eventType: 'Lead', payload: { email: 'test@test.com' } });
    expect(res.status).toBe(201);
    expect(res.body.data?.sent).toBe(true);
    expect(res.body.data?.eventType).toBe('Lead');
  });
});

// ── GOOGLE ADS ────────────────────────────────────────────────

describe('Google Ads — Integração', () => {
  it('salva integração Google', async () => {
    const res = await request(BASE)
      .post('/marketing/google/integration')
      .set(auth())
      .send({ accessToken: 'ya29.test', customerId: '123-456-7890' });
    expect(res.status).toBe(201);
    expect(res.body.data?.provider).toBe('GOOGLE_ADS');
  });

  it('busca integração Google', async () => {
    const res = await request(BASE).get('/marketing/google/integration').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data?.provider).toBe('GOOGLE_ADS');
    expect(res.body.data?.accessToken).toBe('***');
  });
});

describe('Google Ads — Campanhas', () => {
  it('sincroniza campanhas Google', async () => {
    const res = await request(BASE).post('/marketing/google/campaigns/sync').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data?.synced).toBeGreaterThan(0);
  });

  it('lista campanhas Google', async () => {
    const res = await request(BASE).get('/marketing/google/campaigns').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

describe('Google Ads — Conversões e Webhook', () => {
  it('envia offline conversion', async () => {
    const res = await request(BASE)
      .post('/marketing/google/offline-conversion')
      .set(auth())
      .send({ gclid: 'gclid_test123', value: 50000, conversionName: 'Deal Fechado' });
    expect(res.status).toBe(200);
    expect(res.body.data?.sent).toBe(true);
    expect(res.body.data?.gclid).toBe('gclid_test123');
  });

  it('processa webhook de lead Google (público)', async () => {
    const res = await request(BASE)
      .post('/marketing/google/webhook')
      .send({
        gclid: 'gclid_456',
        campaign_name: 'Campanha Google Teste',
        user_column_data: [
          { column_id: 'FULL_NAME', string_value: 'Maria Teste Google' },
          { column_id: 'EMAIL', string_value: 'maria.google@test.com' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.data?.received).toBe(true);
  });
});

// ── PORTAIS IMOBILIÁRIOS ──────────────────────────────────────

describe('Portais — Integrações', () => {
  it('salva integração ZAP Imóveis', async () => {
    const res = await request(BASE)
      .post('/marketing/portals/integrations')
      .set(auth())
      .send({ portal: 'ZAP', apiKey: 'zap-api-key-test-123' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.data?.portal).toBe('ZAP');
  });

  it('salva integração VivaReal', async () => {
    const res = await request(BASE)
      .post('/marketing/portals/integrations')
      .set(auth())
      .send({ portal: 'VIVAREAL', apiKey: 'vivareal-key-test' });
    expect([200, 201]).toContain(res.status);
  });

  it('lista portais configurados', async () => {
    const res = await request(BASE).get('/marketing/portals/integrations').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    const zap = res.body.data.find((p: Record<string, unknown>) => p.portal === 'ZAP');
    expect(zap).toBeDefined();
    expect(zap.apiKey).toBe('***');
  });
});

describe('Portais — Publicações', () => {
  it('publica imóvel nos portais ZAP e VIVAREAL', async () => {
    expect(createdPropertyId).toBeTruthy();
    const res = await request(BASE)
      .post('/marketing/portals/publish')
      .set(auth())
      .send({ propertyId: createdPropertyId, portals: ['ZAP', 'VIVAREAL'] });
    expect([200, 201]).toContain(res.status);
    expect(res.body.data?.published).toBe(2);
    expect(Array.isArray(res.body.data?.publications)).toBe(true);
    const pub = res.body.data.publications[0];
    expect(pub.status).toBe('PUBLISHED');
    publicationId = pub.id;
  });

  it('lista publicações do imóvel', async () => {
    const res = await request(BASE)
      .get(`/marketing/portals/publications?propertyId=${createdPropertyId}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    const pub = res.body.data[0];
    expect(pub.status).toBe('PUBLISHED');
    expect(pub.portal).toBeDefined();
  });

  it('despublica imóvel do ZAP', async () => {
    const res = await request(BASE)
      .post(`/marketing/portals/unpublish/${createdPropertyId}/ZAP`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data?.status).toBe('UNPUBLISHED');
  });

  it('lista todas as publicações', async () => {
    const res = await request(BASE).get('/marketing/portals/publications').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('Portais — Webhook e remoção', () => {
  it('processa webhook de lead de portal (público)', async () => {
    const res = await request(BASE)
      .post('/marketing/portals/webhook/ZAP')
      .send({ name: 'Pedro Teste Portal', email: 'pedro@zap.com', phone: '11999887766' });
    expect(res.status).toBe(200);
    expect(res.body.data?.received).toBe(true);
  });

  it('remove integração VivaReal', async () => {
    const res = await request(BASE)
      .delete('/marketing/portals/integrations/VIVAREAL')
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data?.deleted).toBe(true);
  });
});
