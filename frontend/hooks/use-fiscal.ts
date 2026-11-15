'use client';
import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useWorkspace } from './use-workspace';

export function useFiscal() {
  const { workspaceId } = useWorkspace();
  const headers = { 'x-workspace-id': workspaceId };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getTaxConfig = useCallback(async () => {
    const r = await api.get('/fiscal/config', { headers });
    return r.data.data;
  }, [workspaceId]);

  const saveTaxConfig = useCallback(async (dto: Record<string, unknown>) => {
    const r = await api.post('/fiscal/config', dto, { headers });
    return r.data.data;
  }, [workspaceId]);

  // Fase 6: NFS-e passou para hooks/use-nfse.ts (rotas /nfse).

  const findDimob = useCallback(async (params?: Record<string, unknown>) => {
    const r = await api.get('/fiscal/dimob', { params, headers });
    return r.data.data;
  }, [workspaceId]);

  const generateDimob = useCallback(async (year: number) => {
    const r = await api.post('/fiscal/dimob/generate', { year }, { headers });
    return r.data.data;
  }, [workspaceId]);

  const findCarneLeao = useCallback(async (params?: Record<string, unknown>) => {
    const r = await api.get('/fiscal/carne-leao', { params, headers });
    return r.data.data;
  }, [workspaceId]);

  return { getTaxConfig, saveTaxConfig, findDimob, generateDimob, findCarneLeao, loading, error };
}
