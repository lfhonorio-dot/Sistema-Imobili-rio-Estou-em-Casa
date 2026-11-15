import { authorizationStatus } from './authorization-status';

describe('authorizationStatus', () => {
  const now = new Date(2026, 10, 14, 10, 0, 0); // 14/11/2026 10:00

  it('ativa com folga', () => {
    expect(authorizationStatus({ status: 'ACTIVE', validUntil: new Date(2027, 2, 1) }, now).status).toBe('ACTIVE');
  });

  it('vencendo em até 30 dias', () => {
    const r = authorizationStatus({ status: 'ACTIVE', validUntil: new Date(2026, 11, 1) }, now);
    expect(r.status).toBe('EXPIRING');
    expect(r.daysLeft).toBe(17);
  });

  it('vence hoje ainda conta como vencendo (0 dias)', () => {
    const r = authorizationStatus({ status: 'ACTIVE', validUntil: new Date(2026, 10, 14) }, now);
    expect(r.status).toBe('EXPIRING');
    expect(r.daysLeft).toBe(0);
  });

  it('vencida ontem', () => {
    expect(authorizationStatus({ status: 'ACTIVE', validUntil: new Date(2026, 10, 13) }, now).status).toBe('EXPIRED');
  });

  it('cancelada prevalece sobre a data', () => {
    expect(authorizationStatus({ status: 'CANCELLED', validUntil: new Date(2027, 1, 1) }, now).status).toBe('CANCELLED');
  });
});
