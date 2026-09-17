'use client';
import { useState, useCallback } from 'react';
// Reaproveita o cliente HTTP compartilhado (com proxy /api-proxy em produção
// e refresh automático de token) em vez de uma instância própria apontando
// para localhost — que quebrava 100% das chamadas desta tela em produção.
import api from '@/lib/api';

function headers(token: string, workspaceId: string) {
  return { Authorization: `Bearer ${token}`, 'x-workspace-id': workspaceId };
}

export function useAutomation(token: string, workspaceId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const listAutomations = useCallback((page = 1, limit = 20) =>
    request(() => api.get('/automations', { headers: headers(token, workspaceId), params: { page, limit } })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const getAutomation = useCallback((id: string) =>
    request(() => api.get(`/automations/${id}`, { headers: headers(token, workspaceId) })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const createAutomation = useCallback((data: Record<string, unknown>) =>
    request(() => api.post('/automations', data, { headers: headers(token, workspaceId) })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const updateAutomation = useCallback((id: string, data: Record<string, unknown>) =>
    request(() => api.patch(`/automations/${id}`, data, { headers: headers(token, workspaceId) })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const deleteAutomation = useCallback((id: string) =>
    request(() => api.delete(`/automations/${id}`, { headers: headers(token, workspaceId) })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const triggerAutomation = useCallback((data: Record<string, unknown>) =>
    request(() => api.post('/automations/trigger', data, { headers: headers(token, workspaceId) })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const getLogs = useCallback((id: string, page = 1) =>
    request(() => api.get(`/automations/${id}/logs`, { headers: headers(token, workspaceId), params: { page } })
      .then(r => r.data.data)), [request, token, workspaceId]);

  return { loading, error, listAutomations, getAutomation, createAutomation, updateAutomation, deleteAutomation, triggerAutomation, getLogs };
}

export function useNotifications(token: string, workspaceId: string) {
  const [loading, setLoading] = useState(false);

  const request = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    setLoading(true);
    try { return await fn(); } catch { return null; } finally { setLoading(false); }
  }, []);

  const getPreferences = useCallback(() =>
    request(() => api.get('/notifications/preferences', { headers: headers(token, workspaceId) })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const updatePreference = useCallback((data: Record<string, unknown>) =>
    request(() => api.patch('/notifications/preferences', data, { headers: headers(token, workspaceId) })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const getStats = useCallback(() =>
    request(() => api.get('/notifications/stats', { headers: headers(token, workspaceId) })
      .then(r => r.data.data)), [request, token, workspaceId]);

  return { loading, getPreferences, updatePreference, getStats };
}
