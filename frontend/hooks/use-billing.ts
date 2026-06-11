'use client';
import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useWorkspace } from './use-workspace';

export function useBilling() {
  const { workspaceId } = useWorkspace();
  const headers = { 'x-workspace-id': workspaceId };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const findBoletos = useCallback(async (params?: Record<string, unknown>) => {
    setLoading(true);
    try {
      const r = await api.get('/billing/boletos', { params, headers });
      return r.data.data;
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const generateBoleto = useCallback(async (dto: Record<string, unknown>) => {
    const r = await api.post('/billing/boletos', dto, { headers });
    return r.data.data;
  }, [workspaceId]);

  const confirmPayment = useCallback(async (id: string, paidAmount?: number) => {
    const r = await api.post(`/billing/boletos/${id}/confirm-payment`, { paidAmount }, { headers });
    return r.data.data;
  }, [workspaceId]);

  const getGateways = useCallback(async () => {
    const r = await api.get('/billing/gateways', { headers });
    return r.data.data;
  }, [workspaceId]);

  const findCnabFiles = useCallback(async () => {
    const r = await api.get('/billing/cnab', { headers });
    return r.data.data;
  }, [workspaceId]);

  return { findBoletos, generateBoleto, confirmPayment, getGateways, findCnabFiles, loading, error };
}
