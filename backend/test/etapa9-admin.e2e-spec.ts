import * as request from 'supertest';

const BASE_URL = 'http://localhost:3001/api/v1';
const WORKSPACE_ID = '20c4942a-ae70-4299-9e97-f13181c73bcf';
const ADMIN_EMAIL = 'admin@homolog.com';
const ADMIN_PASSWORD = 'Homolog@Etapa3!';

let token: string;

async function login() {
  const res = await request(BASE_URL)
    .post('/auth/login')
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  token = res.body.data?.tokens?.accessToken ?? res.body.data?.accessToken;
}

function auth() {
  return { Authorization: `Bearer ${token}`, 'x-workspace-id': WORKSPACE_ID };
}

describe('Etapa 9 — Super Admin e Configurações Avançadas', () => {
  beforeAll(async () => { await login(); });

  describe('Health Check (público)', () => {
    it('GET /admin/health — público, retorna status ok', async () => {
      const res = await request(BASE_URL).get('/admin/health');
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ok');
      expect(res.body.data).toHaveProperty('services');
    });

    it('GET /admin/health — sem token também retorna 200', async () => {
      const res = await request(BASE_URL).get('/admin/health');
      expect(res.status).toBe(200);
    });
  });

  describe('Platform Stats', () => {
    it('GET /admin/stats — retorna estatísticas da plataforma', async () => {
      const res = await request(BASE_URL).get('/admin/stats').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('workspaces');
      expect(res.body.data).toHaveProperty('users');
      expect(res.body.data).toHaveProperty('properties');
    });

    it('GET /admin/stats — sem token retorna 401', async () => {
      const res = await request(BASE_URL).get('/admin/stats');
      expect(res.status).toBe(401);
    });
  });

  describe('Platform Configs', () => {
    it('GET /admin/platform-configs — retorna array', async () => {
      const res = await request(BASE_URL).get('/admin/platform-configs').set(auth());
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /admin/platform-configs — cria configuração', async () => {
      const res = await request(BASE_URL)
        .post('/admin/platform-configs')
        .set(auth())
        .send({ key: 'test_config_e2e', value: 'valor_teste', description: 'Teste E2E' });
      expect(res.status).toBe(201);
      expect(res.body.data.key).toBe('test_config_e2e');
      expect(res.body.data.value).toBe('valor_teste');
    });

    it('POST /admin/platform-configs — faz upsert da mesma chave', async () => {
      const res = await request(BASE_URL)
        .post('/admin/platform-configs')
        .set(auth())
        .send({ key: 'test_config_e2e', value: 'novo_valor' });
      expect(res.status).toBe(201);
      expect(res.body.data.value).toBe('novo_valor');
    });

    it('GET /admin/platform-configs — sem token retorna 401', async () => {
      const res = await request(BASE_URL).get('/admin/platform-configs');
      expect(res.status).toBe(401);
    });
  });

  describe('Feature Flags', () => {
    it('GET /admin/feature-flags — retorna array', async () => {
      const res = await request(BASE_URL).get('/admin/feature-flags').set(auth());
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /admin/feature-flags — cria feature flag ativa', async () => {
      const res = await request(BASE_URL)
        .post('/admin/feature-flags')
        .set(auth())
        .send({ key: 'test_flag_e2e', enabled: true, description: 'Flag de teste' });
      expect(res.status).toBe(201);
      expect(res.body.data.key).toBe('test_flag_e2e');
      expect(res.body.data.enabled).toBe(true);
    });

    it('POST /admin/feature-flags — desativa flag (upsert)', async () => {
      const res = await request(BASE_URL)
        .post('/admin/feature-flags')
        .set(auth())
        .send({ key: 'test_flag_e2e', enabled: false });
      expect(res.status).toBe(201);
      expect(res.body.data.enabled).toBe(false);
    });

    it('GET /admin/feature-flags/:key/check — verifica se flag está ativa', async () => {
      const res = await request(BASE_URL)
        .get('/admin/feature-flags/test_flag_e2e/check')
        .set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('enabled');
    });

    it('GET /admin/feature-flags/inexistente/check — retorna enabled:false', async () => {
      const res = await request(BASE_URL)
        .get('/admin/feature-flags/flag_inexistente_xyz/check')
        .set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.enabled).toBe(false);
    });

    it('GET /admin/feature-flags — sem token retorna 401', async () => {
      const res = await request(BASE_URL).get('/admin/feature-flags');
      expect(res.status).toBe(401);
    });
  });

  describe('Workspace Plan', () => {
    it('GET /admin/plan — retorna plano atual (FREE por padrão)', async () => {
      const res = await request(BASE_URL).get('/admin/plan').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('plan');
      expect(res.body.data).toHaveProperty('maxUsers');
    });

    it('POST /admin/plan — atualiza plano para STARTER', async () => {
      const res = await request(BASE_URL)
        .post('/admin/plan')
        .set(auth())
        .send({ plan: 'STARTER', maxUsers: 5, maxProperties: 100, maxContacts: 1000 });
      expect(res.status).toBe(201);
      expect(res.body.data.plan).toBe('STARTER');
      expect(res.body.data.maxUsers).toBe(5);
    });

    it('GET /admin/plan — plano agora é STARTER', async () => {
      const res = await request(BASE_URL).get('/admin/plan').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.plan).toBe('STARTER');
    });

    it('GET /admin/plan — sem token retorna 401', async () => {
      const res = await request(BASE_URL).get('/admin/plan');
      expect(res.status).toBe(401);
    });
  });

  describe('Onboarding', () => {
    it('GET /admin/onboarding — retorna 6 passos', async () => {
      const res = await request(BASE_URL).get('/admin/onboarding').set(auth());
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(6);
    });

    it('POST /admin/onboarding/complete — completa passo CREATE_PIPELINE', async () => {
      const res = await request(BASE_URL)
        .post('/admin/onboarding/complete')
        .set(auth())
        .send({ step: 'CREATE_PIPELINE' });
      expect(res.status).toBe(200);
      const step = res.body.data.find((s: { step: string }) => s.step === 'CREATE_PIPELINE');
      expect(step?.completed).toBe(true);
    });

    it('GET /admin/onboarding — CREATE_PIPELINE está completo', async () => {
      const res = await request(BASE_URL).get('/admin/onboarding').set(auth());
      expect(res.status).toBe(200);
      const step = res.body.data.find((s: { step: string }) => s.step === 'CREATE_PIPELINE');
      expect(step?.completed).toBe(true);
    });

    it('GET /admin/onboarding — ao menos 1 de 6 concluídos', async () => {
      const res = await request(BASE_URL).get('/admin/onboarding').set(auth());
      const completed = res.body.data.filter((s: { completed: boolean }) => s.completed).length;
      expect(completed).toBeGreaterThanOrEqual(1);
    });

    it('GET /admin/onboarding — sem token retorna 401', async () => {
      const res = await request(BASE_URL).get('/admin/onboarding');
      expect(res.status).toBe(401);
    });
  });
});
