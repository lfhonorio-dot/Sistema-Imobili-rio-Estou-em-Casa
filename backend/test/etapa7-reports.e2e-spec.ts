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

describe('Etapa 7 — Relatórios e Analytics', () => {
  beforeAll(async () => {
    await login();
  });

  describe('GET /reports/dashboard', () => {
    it('retorna 200 com campos esperados', async () => {
      const res = await request(BASE_URL).get('/reports/dashboard').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalContacts');
      expect(res.body.data).toHaveProperty('totalDeals');
      expect(res.body.data).toHaveProperty('openDeals');
      expect(res.body.data).toHaveProperty('wonDeals');
      expect(res.body.data).toHaveProperty('lostDeals');
      expect(res.body.data).toHaveProperty('totalProperties');
      expect(res.body.data).toHaveProperty('activeContracts');
      expect(res.body.data).toHaveProperty('totalRevenue');
      expect(res.body.data).toHaveProperty('overdueCount');
      expect(res.body.data).toHaveProperty('automationRuns');
    });

    it('retorna 401 sem token', async () => {
      const res = await request(BASE_URL)
        .get('/reports/dashboard')
        .set('x-workspace-id', WORKSPACE_ID);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /reports/crm-funnel', () => {
    it('retorna 200 com array', async () => {
      const res = await request(BASE_URL).get('/reports/crm-funnel').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('retorna 401 sem token', async () => {
      const res = await request(BASE_URL)
        .get('/reports/crm-funnel')
        .set('x-workspace-id', WORKSPACE_ID);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /reports/deal-performance', () => {
    it('retorna 200 com array', async () => {
      const res = await request(BASE_URL).get('/reports/deal-performance').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('retorna 401 sem token', async () => {
      const res = await request(BASE_URL)
        .get('/reports/deal-performance')
        .set('x-workspace-id', WORKSPACE_ID);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /reports/contact-growth', () => {
    it('retorna 200 com array', async () => {
      const res = await request(BASE_URL).get('/reports/contact-growth').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('retorna 401 sem token', async () => {
      const res = await request(BASE_URL)
        .get('/reports/contact-growth')
        .set('x-workspace-id', WORKSPACE_ID);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /reports/property-status', () => {
    it('retorna 200 com array', async () => {
      const res = await request(BASE_URL).get('/reports/property-status').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('retorna 401 sem token', async () => {
      const res = await request(BASE_URL)
        .get('/reports/property-status')
        .set('x-workspace-id', WORKSPACE_ID);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /reports/financial-summary', () => {
    it('retorna 200 com array', async () => {
      const res = await request(BASE_URL).get('/reports/financial-summary').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('retorna 401 sem token', async () => {
      const res = await request(BASE_URL)
        .get('/reports/financial-summary')
        .set('x-workspace-id', WORKSPACE_ID);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /reports/marketing-roi', () => {
    it('retorna 200 com array', async () => {
      const res = await request(BASE_URL).get('/reports/marketing-roi').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('retorna 401 sem token', async () => {
      const res = await request(BASE_URL)
        .get('/reports/marketing-roi')
        .set('x-workspace-id', WORKSPACE_ID);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /reports/automation-stats', () => {
    it('retorna 200 com array', async () => {
      const res = await request(BASE_URL).get('/reports/automation-stats').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('retorna 401 sem token', async () => {
      const res = await request(BASE_URL)
        .get('/reports/automation-stats')
        .set('x-workspace-id', WORKSPACE_ID);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /reports/activity-heatmap', () => {
    it('retorna 200 com array', async () => {
      const res = await request(BASE_URL).get('/reports/activity-heatmap').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('retorna 401 sem token', async () => {
      const res = await request(BASE_URL)
        .get('/reports/activity-heatmap')
        .set('x-workspace-id', WORKSPACE_ID);
      expect(res.status).toBe(401);
    });
  });
});
