'use client';
import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useWorkspace } from './use-workspace';

export function useBanking() {
  const { workspaceId } = useWorkspace();
  const headers = { 'x-workspace-id': workspaceId };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const findAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/banking/accounts', { headers });
      return r.data.data;
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const createAccount = useCallback(async (dto: Record<string, unknown>) => {
    const r = await api.post('/banking/accounts', dto, { headers });
    return r.data.data;
  }, [workspaceId]);

  const findTransactions = useCallback(async (params?: Record<string, unknown>) => {
    const r = await api.get('/banking/transactions', { params, headers });
    return r.data.data;
  }, [workspaceId]);

  const reconcile = useCallback(async (dto: Record<string, unknown>) => {
    const r = await api.post('/banking/reconcile', dto, { headers });
    return r.data.data;
  }, [workspaceId]);

  const autoReconcile = useCallback(async (accountId: string) => {
    const r = await api.post(`/banking/accounts/${accountId}/auto-reconcile`, {}, { headers });
    return r.data.data;
  }, [workspaceId]);

  return { findAccounts, createAccount, findTransactions, reconcile, autoReconcile, loading, error };
}
