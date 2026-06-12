/**
 * Teste Integrado Completo — Plataforma Imobiliária Estou em Casa
 * Cobre todos os fluxos das 9 etapas em sequência real
 */
import * as request from 'supertest';

const BASE = 'http://localhost:3001/api/v1';
const WS_ID = '20c4942a-ae70-4299-9e97-f13181c73bcf';

let token: string;
let contactId: string;
let dealId: string;
let propertyId: string;
let contractId: string;
let pipelineId: string;
let stageId: string;
let automationId: string;
let apiKeyId: string;
let webhookId: string;

function auth(extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${token}`, 'x-workspace-id': WS_ID, ...extra };
}

async function login() {
  const res = await request(BASE)
    .post('/auth/login')
    .send({ email: 'admin@homolog.com', password: 'Homolog@Etapa3!' });
  token = res.body.data?.tokens?.accessToken ?? res.body.data?.accessToken;
  expect(token).toBeTruthy();
}

// ─────────────────────────────────────────────────────────────────────────────
describe('🏠 Plataforma Imobiliária — Teste Integrado Completo', () => {

  beforeAll(async () => { await login(); });

  // ── ETAPA 1 & 2 — Auth & Workspace ─────────────────────────────────────────
  describe('Etapa 1-2 | Auth & Workspace', () => {
    it('GET /auth/me — usuário autenticado', async () => {
      const res = await request(BASE).get('/auth/me').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('email', 'admin@homolog.com');
    });

    it('GET /workspace — workspace carregado', async () => {
      const res = await request(BASE).get('/workspace').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', WS_ID);
    });

    it('Rota protegida sem token → 401', async () => {
      const res = await request(BASE).get('/contacts');
      expect(res.status).toBe(401);
    });
  });

  // ── ETAPA 3 — CRM Core ──────────────────────────────────────────────────────
  describe('Etapa 3 | CRM — Contatos e Pipeline', () => {
    it('POST /contacts — cria contato de comprador', async () => {
      const res = await request(BASE).post('/contacts').set(auth()).send({
        name: 'João Comprador Integrado',
        email: 'joao.integrado@teste.com',
        phone: '11999990001',
        type: 'PERSON',
        origin: 'MANUAL',
      });
      expect(res.status).toBe(201);
      contactId = res.body.data.id;
      expect(contactId).toBeTruthy();
    });

    it('GET /contacts/:id — obtém contato criado', async () => {
      const res = await request(BASE).get(`/contacts/${contactId}`).set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('João Comprador Integrado');
    });

    it('GET /pipelines — lista pipelines', async () => {
      const res = await request(BASE).get('/pipelines').set(auth());
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        pipelineId = res.body.data[0].id;
        stageId = res.body.data[0].stages?.[0]?.id;
      }
    });

    it('POST /deals — cria negócio vinculado ao contato', async () => {
      if (!pipelineId || !stageId) {
        // Create pipeline first
        const p = await request(BASE).post('/pipelines').set(auth()).send({ name: 'Pipeline Integrado' });
        pipelineId = p.body.data.id;
        const s = await request(BASE).post(`/pipelines/${pipelineId}/stages`).set(auth()).send({ name: 'Prospectando', order: 1 });
        stageId = s.body.data.id;
      }
      const res = await request(BASE).post('/deals').set(auth()).send({
        title: 'Venda Apto Centro — Integrado',
        contactId,
        pipelineId,
        stageId,
        value: 450000,
      });
      expect(res.status).toBe(201);
      dealId = res.body.data.id;
      expect(dealId).toBeTruthy();
    });

    it('PATCH /deals/:id — atualiza valor do negócio', async () => {
      const res = await request(BASE).patch(`/deals/${dealId}`).set(auth()).send({ value: 480000 });
      expect(res.status).toBe(200);
      expect(Number(res.body.data.value)).toBe(480000);
    });

    it('GET /deals — lista deals com paginação', async () => {
      const res = await request(BASE).get('/deals?page=1&limit=10').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('meta');
    });
  });

  // ── ETAPA 3 — ERP: Imóveis & Contratos ─────────────────────────────────────
  describe('Etapa 3 | ERP — Imóveis e Contratos', () => {
    it('POST /properties — cria imóvel', async () => {
      const res = await request(BASE).post('/properties').set(auth()).send({
        type: 'APARTMENT',
        purpose: 'SALE',
        street: 'Rua das Flores',
        number: '100',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01310-100',
        totalArea: 85,
        salePrice: 480000,
        bedrooms: 2,
        bathrooms: 1,
      });
      expect(res.status).toBe(201);
      propertyId = res.body.data.id;
      expect(propertyId).toBeTruthy();
    });

    it('GET /properties/:id — obtém imóvel criado', async () => {
      const res = await request(BASE).get(`/properties/${propertyId}`).set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.city).toBe('São Paulo');
    });

    it('PATCH /deals/:id — atualiza título vinculando imóvel', async () => {
      if (!dealId) { return; }
      const res = await request(BASE).patch(`/deals/${dealId}`).set(auth()).send({ title: `Venda Imóvel ${propertyId?.slice(0, 8)}` });
      expect(res.status).toBe(200);
    });

    it('POST /contracts — cria contrato de compra e venda', async () => {
      const res = await request(BASE).post('/contracts').set(auth()).send({
        type: 'SALE',
        propertyId,
        tenantId: contactId,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        rentalValue: 480000,
      });
      expect(res.status).toBe(201);
      contractId = res.body.data.id;
      expect(contractId).toBeTruthy();
    });

    it('GET /contracts/:id — obtém contrato criado', async () => {
      const res = await request(BASE).get(`/contracts/${contractId}`).set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.type).toBe('SALE');
    });

    it('GET /financial/entries — lista lançamentos financeiros', async () => {
      const res = await request(BASE).get('/financial/entries').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
    });
  });

  // ── ETAPA 4 — Hub de Comunicação ───────────────────────────────────────────
  describe('Etapa 4 | Hub — Conversas e Templates', () => {
    it('GET /conversations — lista conversas', async () => {
      const res = await request(BASE).get('/conversations').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
    });

    it('GET /email/templates — lista templates de email', async () => {
      const res = await request(BASE).get('/email/templates').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
    });

    it('POST /email/templates — cria template', async () => {
      const res = await request(BASE).post('/email/templates').set(auth()).send({
        name: 'Boas-vindas Integrado',
        subject: 'Bem-vindo à Plataforma!',
        body: '<h1>Olá {{nome}}</h1><p>Bem-vindo!</p>',
        category: 'BOAS_VINDAS',
      });
      expect([200, 201]).toContain(res.status);
    });
  });

  // ── ETAPA 5 — Marketing ────────────────────────────────────────────────────
  describe('Etapa 5 | Marketing', () => {
    it('GET /marketing/portals/integrations — lista integrações de portais', async () => {
      const res = await request(BASE).get('/marketing/portals/integrations').set(auth());
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /marketing/portals/publish — publica imóvel em portal', async () => {
      const res = await request(BASE).post('/marketing/portals/publish').set(auth()).send({
        propertyId,
        portals: ['ZAP'],
      });
      expect(res.status).toBe(201);
      expect(res.body.data.published).toBe(1);
    });

    it('GET /marketing/portals/publications — lista publicações', async () => {
      const res = await request(BASE).get('/marketing/portals/publications').set(auth());
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /marketing/portals/webhook/zapimoveis — webhook público de lead', async () => {
      const res = await request(BASE).post('/marketing/portals/webhook/zapimoveis').send({
        nome: 'Lead Via Portal',
        email: 'lead@portal.com',
        telefone: '11988880001',
      });
      expect(res.status).toBe(200);
    });

    it('GET /marketing/meta/campaigns — lista campanhas', async () => {
      const res = await request(BASE).get('/marketing/meta/campaigns').set(auth());
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ── ETAPA 6 — Automações ───────────────────────────────────────────────────
  describe('Etapa 6 | Automações e Notificações', () => {
    it('POST /automations — cria automação de boas-vindas', async () => {
      const res = await request(BASE).post('/automations').set(auth()).send({
        name: 'Boas-vindas Lead Integrado',
        trigger: 'DEAL_CREATED',
        steps: [
          { type: 'SEND_WHATSAPP', config: { message: 'Olá! Recebemos seu contato.' } },
          { type: 'CREATE_TASK', config: { title: 'Ligar para lead', dueInHours: 24 } },
        ],
      });
      expect(res.status).toBe(201);
      automationId = res.body.data.id;
      expect(automationId).toBeTruthy();
    });

    it('POST /automations/trigger — dispara automação para deal criado', async () => {
      const res = await request(BASE).post('/automations/trigger').set(auth()).send({
        trigger: 'DEAL_CREATED',
        entityId: dealId,
        entityType: 'Deal',
        context: { contactName: 'João Comprador Integrado' },
      });
      expect(res.status).toBe(200);
      expect(res.body.data.triggered).toBeGreaterThanOrEqual(1);
    });

    it('GET /automations/:id — verifica execução registrada', async () => {
      const res = await request(BASE).get(`/automations/${automationId}`).set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.executions).toBeGreaterThanOrEqual(1);
    });

    it('GET /notifications/preferences — lista preferências', async () => {
      const res = await request(BASE).get('/notifications/preferences').set(auth());
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('PATCH /notifications/preferences — ativa email para DEAL_WON', async () => {
      const res = await request(BASE).patch('/notifications/preferences').set(auth()).send({
        type: 'DEAL_WON', email: true, push: false,
      });
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(true);
    });
  });

  // ── ETAPA 7 — Relatórios ───────────────────────────────────────────────────
  describe('Etapa 7 | Relatórios e Analytics', () => {
    it('GET /reports/dashboard — KPIs gerais', async () => {
      const res = await request(BASE).get('/reports/dashboard').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('totalContacts');
      expect(res.body.data.totalContacts).toBeGreaterThanOrEqual(1);
    });

    it('GET /reports/crm-funnel — funil de vendas com dados', async () => {
      const res = await request(BASE).get('/reports/crm-funnel').set(auth());
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /reports/property-status — distribuição de imóveis', async () => {
      const res = await request(BASE).get('/reports/property-status').set(auth());
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const available = res.body.data.find((s: { status: string }) => s.status === 'AVAILABLE');
      expect(available?.count).toBeGreaterThanOrEqual(1);
    });

    it('GET /reports/deal-performance — performance mensal', async () => {
      const res = await request(BASE).get('/reports/deal-performance').set(auth());
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /reports/financial-summary — resumo financeiro', async () => {
      const res = await request(BASE).get('/reports/financial-summary').set(auth());
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /reports/automation-stats — estatísticas de automações', async () => {
      const res = await request(BASE).get('/reports/automation-stats').set(auth());
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const auto = res.body.data.find((a: { name: string }) => a.name === 'Boas-vindas Lead Integrado');
      expect(auto).toBeTruthy();
    });
  });

  // ── ETAPA 8 — Integrações ──────────────────────────────────────────────────
  describe('Etapa 8 | Integrações e API Pública', () => {
    it('POST /integrations/api-keys — gera API key', async () => {
      const res = await request(BASE).post('/integrations/api-keys').set(auth()).send({
        name: 'Key Integração ERP',
        scopes: ['read', 'write'],
      });
      expect(res.status).toBe(201);
      apiKeyId = res.body.data.id;
      expect(res.body.data.key).toMatch(/^eic_/);
    });

    it('GET /integrations/api-keys — lista chaves (sem expor key)', async () => {
      const res = await request(BASE).get('/integrations/api-keys').set(auth());
      expect(res.status).toBe(200);
      const key = res.body.data.find((k: { id: string }) => k.id === apiKeyId);
      expect(key).toBeTruthy();
      expect(key.key).toBeUndefined(); // key raw não exposta na listagem
    });

    it('POST /integrations/webhooks — registra endpoint de webhook', async () => {
      const res = await request(BASE).post('/integrations/webhooks').set(auth()).send({
        url: 'http://localhost:9999/webhook-integrado',
        events: ['deal.created', 'deal.won', 'contact.created'],
      });
      expect(res.status).toBe(201);
      webhookId = res.body.data.id;
      expect(res.body.data.secret).toMatch(/^whsec_/);
    });

    it('GET /integrations/events — lista eventos disponíveis', async () => {
      const res = await request(BASE).get('/integrations/events').set(auth());
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toContain('deal.created');
      expect(res.body.data).toContain('contact.created');
    });

    it('POST /integrations/webhooks/:id/test — testa webhook (falha esperada)', async () => {
      const res = await request(BASE).post(`/integrations/webhooks/${webhookId}/test`).set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('status');
      expect(res.body.data).toHaveProperty('duration');
    });

    it('GET /integrations/webhooks/:id/logs — log do teste registrado', async () => {
      const res = await request(BASE).get(`/integrations/webhooks/${webhookId}/logs`).set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.meta.total).toBeGreaterThanOrEqual(1);
    });
  });

  // ── ETAPA 9 — Admin ────────────────────────────────────────────────────────
  describe('Etapa 9 | Super Admin e Configurações', () => {
    it('GET /admin/health — health check público', async () => {
      const res = await request(BASE).get('/admin/health');
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ok');
      expect(res.body.data.services.database).toBe('ok');
    });

    it('GET /admin/stats — stats refletem dados criados neste teste', async () => {
      const res = await request(BASE).get('/admin/stats').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.contacts).toBeGreaterThanOrEqual(1);
      expect(res.body.data.properties).toBeGreaterThanOrEqual(1);
    });

    it('POST /admin/feature-flags — cria flag NOVO_FLUXO_VENDA', async () => {
      const res = await request(BASE).post('/admin/feature-flags').set(auth()).send({
        key: 'NOVO_FLUXO_VENDA_INTEGRADO',
        enabled: true,
        description: 'Novo fluxo de venda — teste integrado',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.enabled).toBe(true);
    });

    it('GET /admin/feature-flags/NOVO_FLUXO_VENDA_INTEGRADO/check — flag ativa', async () => {
      const res = await request(BASE)
        .get('/admin/feature-flags/NOVO_FLUXO_VENDA_INTEGRADO/check')
        .set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.enabled).toBe(true);
    });

    it('GET /admin/plan — plano do workspace', async () => {
      const res = await request(BASE).get('/admin/plan').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('plan');
      expect(res.body.data).toHaveProperty('maxUsers');
      expect(res.body.data).toHaveProperty('maxProperties');
    });

    it('GET /admin/onboarding — progresso de onboarding', async () => {
      const res = await request(BASE).get('/admin/onboarding').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(6);
    });

    it('POST /admin/onboarding/complete — conclui passo ADD_PROPERTY', async () => {
      const res = await request(BASE).post('/admin/onboarding/complete').set(auth()).send({ step: 'ADD_PROPERTY' });
      expect(res.status).toBe(200);
      const step = res.body.data.find((s: { step: string }) => s.step === 'ADD_PROPERTY');
      expect(step?.completed).toBe(true);
    });
  });

  // ── FLUXO COMPLETO — Ciclo de vida de uma venda ────────────────────────────
  describe('Fluxo Completo | Ciclo de vida — Lead → Deal → Won', () => {
    it('Deal atualizado com expectedCloseAt — previsão de fechamento', async () => {
      const res = await request(BASE).patch(`/deals/${dealId}`).set(auth()).send({ expectedCloseAt: new Date().toISOString() });
      expect(res.status).toBe(200);
    });

    it('POST /automations/trigger — DEAL_WON executa automações', async () => {
      const res = await request(BASE).post('/automations/trigger').set(auth()).send({
        trigger: 'DEAL_WON', entityId: dealId, entityType: 'Deal',
      });
      expect(res.status).toBe(200);
    });

    it('GET /reports/dashboard — dashboard reflete dados do fluxo completo', async () => {
      const res = await request(BASE).get('/reports/dashboard').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.totalContacts).toBeGreaterThanOrEqual(1);
      expect(res.body.data.totalProperties).toBeGreaterThanOrEqual(1);
    });

    it('Cleanup — revoga API key criada neste teste', async () => {
      const res = await request(BASE).delete(`/integrations/api-keys/${apiKeyId}`).set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.revoked).toBe(true);
    });

    it('Cleanup — remove webhook criado neste teste', async () => {
      const res = await request(BASE).delete(`/integrations/webhooks/${webhookId}`).set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
    });

    it('Cleanup — soft delete da automação de teste', async () => {
      const res = await request(BASE).delete(`/automations/${automationId}`).set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
    });
  });
});
