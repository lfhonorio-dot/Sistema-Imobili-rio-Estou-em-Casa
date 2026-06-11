'use client';
import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useWorkspace } from './use-workspace';

export function useEsignature() {
  const { workspaceId } = useWorkspace();
  const headers = { 'x-workspace-id': workspaceId };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const findAll = useCallback(async (params?: Record<string, unknown>) => {
    setLoading(true);
    try {
      const r = await api.get('/esignature/envelopes', { params, headers });
      return r.data.data;
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const findOne = useCallback(async (id: string) => {
    const r = await api.get(`/esignature/envelopes/${id}`, { headers });
    return r.data.data;
  }, [workspaceId]);

  const create = useCallback(async (dto: Record<string, unknown>) => {
    const r = await api.post('/esignature/envelopes', dto, { headers });
    return r.data.data;
  }, [workspaceId]);

  const send = useCallback(async (id: string) => {
    const r = await api.post(`/esignature/envelopes/${id}/send`, {}, { headers });
    return r.data.data;
  }, [workspaceId]);

  const cancel = useCallback(async (id: string) => {
    const r = await api.delete(`/esignature/envelopes/${id}`, { headers });
    return r.data.data;
  }, [workspaceId]);

  const getAuditTrail = useCallback(async (id: string) => {
    const r = await api.get(`/esignature/envelopes/${id}/audit-trail`, { headers });
    return r.data.data;
  }, [workspaceId]);

  return { findAll, findOne, create, send, cancel, getAuditTrail, loading, error };
}
