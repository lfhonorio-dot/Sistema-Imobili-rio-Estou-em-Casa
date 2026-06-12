import * as request from 'supertest';

const BASE_URL = 'http://localhost:3001/api/v1';
const WORKSPACE_ID = '20c4942a-ae70-4299-9e97-f13181c73bcf';
const ADMIN_EMAIL = 'admin@homolog.com';
const ADMIN_PASSWORD = 'Homolog@Etapa3!';

let token: string;
let apiKeyId: string;
let apiKeyId2: string;
let webhookId: string;

async function login() {
  const res = await request(BASE_URL)
    .post('/auth/login')
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  token = res.body.data?.tokens?.accessToken ?? res.body.data?.accessToken;
}

function auth() {
  return { Authorization: `Bearer ${token}`, 'x-workspace-id': WORKSPACE_ID };
}

describe('Etapa 8 — Integrações e API Pública', () => {
  beforeAll(async () => {
    await login();
  });

  // ── API Keys ────────────────────────────────────────────────────────────────

  describe('POST /integrations/api-keys', () => {
    it('cria uma API Key e retorna id e key', async () => {
      const res = await request(BASE_URL)
        .post('/integrations/api-keys')
        .set(auth())
        .send({ name: 'Chave Teste E2E', scopes: ['read'] });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('key');
      expect(res.body.data.name).toBe('Chave Teste E2E');
      apiKeyId = res.body.data.id;
    });

    it('cria segunda API Key', async () => {
      const res = await request(BASE_URL)
        .post('/integrations/api-keys')
        .set(auth())
        .send({ name: 'Chave Secundaria', scopes: ['read', 'write'] });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      apiKeyId2 = res.body.data.id;
    });
  });

  describe('GET /integrations/api-keys', () => {
    it('retorna 200 com array de chaves', async () => {
      const res = await request(BASE_URL)
        .get('/integrations/api-keys')
        .set(auth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('DELETE /integrations/api-keys/:id', () => {
    it('revoga uma API Key', async () => {
      const res = await request(BASE_URL)
        .delete(`/integrations/api-keys/${apiKeyId2}`)
        .set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.revoked).toBe(true);
    });

    it('lista tem uma chave a menos após revogar', async () => {
      const res = await request(BASE_URL)
        .get('/integrations/api-keys')
        .set(auth());
      expect(res.status).toBe(200);
      const ids = res.body.data.map((k: { id: string }) => k.id);
      expect(ids).not.toContain(apiKeyId2);
    });
  });

  // ── Webhooks ────────────────────────────────────────────────────────────────

  describe('POST /integrations/webhooks', () => {
    it('cria um webhook e retorna id e secret', async () => {
      const res = await request(BASE_URL)
        .post('/integrations/webhooks')
        .set(auth())
        .send({ url: 'http://localhost:9999/nonexistent', events: ['contact.created', 'deal.won'] });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('secret');
      webhookId = res.body.data.id;
    });
  });

  describe('GET /integrations/webhooks', () => {
    it('retorna 200 com array', async () => {
      const res = await request(BASE_URL)
        .get('/integrations/webhooks')
        .set(auth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PATCH /integrations/webhooks/:id', () => {
    it('atualiza status do webhook', async () => {
      const res = await request(BASE_URL)
        .patch(`/integrations/webhooks/${webhookId}`)
        .set(auth())
        .send({ status: 'INACTIVE' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('INACTIVE');
    });
  });

  describe('GET /integrations/events', () => {
    it('retorna array de eventos disponíveis', async () => {
      const res = await request(BASE_URL)
        .get('/integrations/events')
        .set(auth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('POST /integrations/webhooks/:id/test', () => {
    it('testa webhook (FAILURE aceitável pois URL não existe)', async () => {
      const res = await request(BASE_URL)
        .post(`/integrations/webhooks/${webhookId}/test`)
        .set(auth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('status');
    });
  });

  describe('GET /integrations/webhooks/:id/logs', () => {
    it('retorna logs com paginação', async () => {
      const res = await request(BASE_URL)
        .get(`/integrations/webhooks/${webhookId}/logs`)
        .set(auth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('meta');
    });
  });

  describe('DELETE /integrations/webhooks/:id', () => {
    it('deleta webhook', async () => {
      const res = await request(BASE_URL)
        .delete(`/integrations/webhooks/${webhookId}`)
        .set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
    });

    it('lista de webhooks tem um a menos após deletar', async () => {
      const res = await request(BASE_URL)
        .get('/integrations/webhooks')
        .set(auth());
      expect(res.status).toBe(200);
      const ids = res.body.data.map((w: { id: string }) => w.id);
      expect(ids).not.toContain(webhookId);
    });
  });

  // ── Segurança ────────────────────────────────────────────────────────────────

  describe('Segurança — sem token', () => {
    it('GET /integrations/api-keys sem token retorna 401', async () => {
      const res = await request(BASE_URL)
        .get('/integrations/api-keys')
        .set('x-workspace-id', WORKSPACE_ID);
      expect(res.status).toBe(401);
    });

    it('GET /integrations/webhooks sem token retorna 401', async () => {
      const res = await request(BASE_URL)
        .get('/integrations/webhooks')
        .set('x-workspace-id', WORKSPACE_ID);
      expect(res.status).toBe(401);
    });
  });

  // ── 404 ──────────────────────────────────────────────────────────────────────

  describe('404 para IDs inexistentes', () => {
    it('DELETE /integrations/api-keys/invalid-id retorna 404', async () => {
      const res = await request(BASE_URL)
        .delete('/integrations/api-keys/00000000-0000-0000-0000-000000000000')
        .set(auth());
      expect(res.status).toBe(404);
    });

    it('PATCH /integrations/webhooks/invalid-id retorna 404', async () => {
      const res = await request(BASE_URL)
        .patch('/integrations/webhooks/00000000-0000-0000-0000-000000000000')
        .set(auth())
        .send({ status: 'INACTIVE' });
      expect(res.status).toBe(404);
    });
  });
});
