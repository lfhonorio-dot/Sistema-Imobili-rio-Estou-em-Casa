'use client';
import { useState, useCallback } from 'react';
import axios from 'axios';

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1' });

function headers(token: string, workspaceId: string) {
  return { Authorization: `Bearer ${token}`, 'x-workspace-id': workspaceId };
}

export function useIntegrations(token: string, workspaceId: string) {
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

  const listApiKeys = useCallback(() =>
    request(() => api.get('/integrations/api-keys', { headers: headers(token, workspaceId) })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const createApiKey = useCallback((data: { name: string; scopes?: string[]; expiresAt?: string }) =>
    request(() => api.post('/integrations/api-keys', data, { headers: headers(token, workspaceId) })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const revokeApiKey = useCallback((id: string) =>
    request(() => api.delete(`/integrations/api-keys/${id}`, { headers: headers(token, workspaceId) })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const listWebhooks = useCallback(() =>
    request(() => api.get('/integrations/webhooks', { headers: headers(token, workspaceId) })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const createWebhook = useCallback((data: { url: string; events: string[] }) =>
    request(() => api.post('/integrations/webhooks', data, { headers: headers(token, workspaceId) })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const updateWebhook = useCallback((id: string, data: { url?: string; events?: string[]; status?: string }) =>
    request(() => api.patch(`/integrations/webhooks/${id}`, data, { headers: headers(token, workspaceId) })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const deleteWebhook = useCallback((id: string) =>
    request(() => api.delete(`/integrations/webhooks/${id}`, { headers: headers(token, workspaceId) })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const testWebhook = useCallback((id: string) =>
    request(() => api.post(`/integrations/webhooks/${id}/test`, {}, { headers: headers(token, workspaceId) })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const getWebhookLogs = useCallback((id: string, page = 1, limit = 20) =>
    request(() => api.get(`/integrations/webhooks/${id}/logs`, { headers: headers(token, workspaceId), params: { page, limit } })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const getAvailableEvents = useCallback(() =>
    request(() => api.get('/integrations/events', { headers: headers(token, workspaceId) })
      .then(r => r.data.data)), [request, token, workspaceId]);

  return {
    loading,
    error,
    listApiKeys,
    createApiKey,
    revokeApiKey,
    listWebhooks,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    testWebhook,
    getWebhookLogs,
    getAvailableEvents,
  };
}
