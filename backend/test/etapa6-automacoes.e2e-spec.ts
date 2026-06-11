import * as request from 'supertest';

const BASE_URL = 'http://localhost:3001/api/v1';
const WORKSPACE_ID = '20c4942a-ae70-4299-9e97-f13181c73bcf';
const ADMIN_EMAIL = 'admin@homolog.com';
const ADMIN_PASSWORD = 'Homolog@Etapa3!';

let token: string;
let automationId: string;

async function login() {
  const res = await request(BASE_URL)
    .post('/auth/login')
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  token = res.body.data?.tokens?.accessToken ?? res.body.data?.accessToken;
}

function auth() {
  return { Authorization: `Bearer ${token}`, 'x-workspace-id': WORKSPACE_ID };
}

describe('Etapa 6 — Automações e Notificações', () => {
  beforeAll(async () => { await login(); });

  // ── Automações ──────────────────────────────────────────────────────────────

  describe('Automações CRUD', () => {
    it('POST /automations — criar automação', async () => {
      const res = await request(BASE_URL)
        .post('/automations')
        .set(auth())
        .send({
          name: 'Automação Teste E2E',
          description: 'Criada pelo teste',
          trigger: 'DEAL_CREATED',
          steps: [{ type: 'SEND_WHATSAPP', config: { message: 'Novo deal!' } }],
        });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe('Automação Teste E2E');
      expect(res.body.data.status).toBe('ACTIVE');
      automationId = res.body.data.id;
    });

    it('GET /automations — listar automações', async () => {
      const res = await request(BASE_URL).get('/automations').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('meta');
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('GET /automations?page=1&limit=5 — paginação', async () => {
      const res = await request(BASE_URL).get('/automations?page=1&limit=5').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.meta.limit).toBe(5);
    });

    it('GET /automations/:id — obter automação', async () => {
      const res = await request(BASE_URL).get(`/automations/${automationId}`).set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(automationId);
    });

    it('GET /automations/:id — 404 para ID inválido', async () => {
      const res = await request(BASE_URL).get('/automations/invalid-id-not-found').set(auth());
      expect(res.status).toBe(404);
    });

    it('PATCH /automations/:id — atualizar automação', async () => {
      const res = await request(BASE_URL)
        .patch(`/automations/${automationId}`)
        .set(auth())
        .send({ name: 'Automação Atualizada' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Automação Atualizada');
    });

    it('PATCH /automations/:id — pausar automação', async () => {
      const res = await request(BASE_URL)
        .patch(`/automations/${automationId}`)
        .set(auth())
        .send({ status: false });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PAUSED');
    });

    it('PATCH /automations/:id — reativar automação', async () => {
      const res = await request(BASE_URL)
        .patch(`/automations/${automationId}`)
        .set(auth())
        .send({ status: true });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACTIVE');
    });
  });

  describe('Trigger e Logs', () => {
    it('POST /automations/trigger — disparar trigger DEAL_CREATED', async () => {
      const res = await request(BASE_URL)
        .post('/automations/trigger')
        .set(auth())
        .send({ trigger: 'DEAL_CREATED', entityId: 'deal-test-123', entityType: 'Deal' });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('triggered');
      expect(res.body.data).toHaveProperty('results');
    });

    it('POST /automations/trigger — trigger sem automações ativas (DEAL_LOST)', async () => {
      const res = await request(BASE_URL)
        .post('/automations/trigger')
        .set(auth())
        .send({ trigger: 'DEAL_LOST' });
      expect(res.status).toBe(200);
      expect(res.body.data.triggered).toBeGreaterThanOrEqual(0);
    });

    it('GET /automations/:id/logs — listar logs', async () => {
      const res = await request(BASE_URL).get(`/automations/${automationId}/logs`).set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('meta');
    });

    it('GET /automations/:id — contadores incrementados', async () => {
      const res = await request(BASE_URL).get(`/automations/${automationId}`).set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.executions).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Notificações', () => {
    it('GET /notifications/preferences — listar preferências', async () => {
      const res = await request(BASE_URL).get('/notifications/preferences').set(auth());
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('PATCH /notifications/preferences — atualizar preferência', async () => {
      const res = await request(BASE_URL)
        .patch('/notifications/preferences')
        .set(auth())
        .send({ type: 'DEAL_CREATED', email: true, push: false });
      expect(res.status).toBe(200);
      expect(res.body.data.type).toBe('DEAL_CREATED');
      expect(res.body.data.email).toBe(true);
    });

    it('POST /notifications/send — enviar notificação', async () => {
      const res = await request(BASE_URL)
        .post('/notifications/send')
        .set(auth())
        .send({
          title: 'Teste de Notificação',
          body: 'Notificação enviada pelo teste E2E',
          type: 'INFO',
          userIds: [],
        });
      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Teste de Notificação');
    });

    it('GET /notifications/stats — estatísticas de notificações', async () => {
      const res = await request(BASE_URL).get('/notifications/stats').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('emailEnabled');
      expect(res.body.data).toHaveProperty('pushEnabled');
    });
  });

  describe('Segurança', () => {
    it('GET /automations — sem token retorna 401', async () => {
      const res = await request(BASE_URL).get('/automations');
      expect(res.status).toBe(401);
    });

    it('GET /notifications/preferences — sem workspace retorna 400 ou 401', async () => {
      const res = await request(BASE_URL)
        .get('/notifications/preferences')
        .set({ Authorization: `Bearer ${token}` });
      expect([400, 401, 403]).toContain(res.status);
    });
  });

  describe('Cleanup', () => {
    it('DELETE /automations/:id — soft delete', async () => {
      const res = await request(BASE_URL).delete(`/automations/${automationId}`).set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
    });

    it('GET /automations/:id — 404 após exclusão', async () => {
      const res = await request(BASE_URL).get(`/automations/${automationId}`).set(auth());
      expect(res.status).toBe(404);
    });
  });
});
