'use client';
import { useState, useCallback } from 'react';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
});

apiClient.interceptors.request.use((cfg) => {
  const state = useAuthStore.getState();
  cfg.headers['Authorization'] = `Bearer ${state.accessToken}`;
  cfg.headers['x-workspace-id'] = state.currentWorkspace?.workspaceId;
  return cfg;
});

export function useMarketing() {
  const [loading, setLoading] = useState(false);

  const request = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    setLoading(true);
    try {
      return await fn();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro na operação';
      console.error(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Meta Ads ────────────────────────────────────────

  const getMetaIntegration = useCallback(() =>
    request(async () => {
      const r = await apiClient.get('/marketing/meta/integration');
      return r.data.data;
    }), [request]);

  const saveMetaIntegration = useCallback((dto: { accessToken: string; accountId: string; pageId?: string }) =>
    request(async () => {
      const r = await apiClient.post('/marketing/meta/integration', dto);
      return r.data.data;
    }), [request]);

  const syncMetaCampaigns = useCallback(() =>
    request(async () => {
      const r = await apiClient.post('/marketing/meta/campaigns/sync');
      return r.data.data;
    }), [request]);

  const getMetaCampaigns = useCallback(() =>
    request(async () => {
      const r = await apiClient.get('/marketing/meta/campaigns');
      return r.data.data as Array<Record<string, unknown>>;
    }), [request]);

  const sendCapiEvent = useCallback((eventType: string, payload?: Record<string, unknown>) =>
    request(async () => {
      const r = await apiClient.post('/marketing/meta/capi', { eventType, payload });
      return r.data.data;
    }), [request]);

  // ── Google Ads ──────────────────────────────────────

  const getGoogleIntegration = useCallback(() =>
    request(async () => {
      const r = await apiClient.get('/marketing/google/integration');
      return r.data.data;
    }), [request]);

  const saveGoogleIntegration = useCallback((dto: { accessToken: string; customerId: string }) =>
    request(async () => {
      const r = await apiClient.post('/marketing/google/integration', dto);
      return r.data.data;
    }), [request]);

  const syncGoogleCampaigns = useCallback(() =>
    request(async () => {
      const r = await apiClient.post('/marketing/google/campaigns/sync');
      return r.data.data;
    }), [request]);

  const getGoogleCampaigns = useCallback(() =>
    request(async () => {
      const r = await apiClient.get('/marketing/google/campaigns');
      return r.data.data as Array<Record<string, unknown>>;
    }), [request]);

  const sendOfflineConversion = useCallback((dto: { gclid?: string; value?: number }) =>
    request(async () => {
      const r = await apiClient.post('/marketing/google/offline-conversion', dto);
      return r.data.data;
    }), [request]);

  // ── Portais ─────────────────────────────────────────

  const getPortalIntegrations = useCallback(() =>
    request(async () => {
      const r = await apiClient.get('/marketing/portals/integrations');
      return r.data.data as Array<Record<string, unknown>>;
    }), [request]);

  const savePortalIntegration = useCallback((dto: { portal: string; apiKey: string }) =>
    request(async () => {
      const r = await apiClient.post('/marketing/portals/integrations', dto);
      return r.data.data;
    }), [request]);

  const deletePortalIntegration = useCallback((portal: string) =>
    request(async () => {
      const r = await apiClient.delete(`/marketing/portals/integrations/${portal}`);
      return r.data.data;
    }), [request]);

  const publishProperty = useCallback((dto: { propertyId: string; portals: string[] }) =>
    request(async () => {
      const r = await apiClient.post('/marketing/portals/publish', dto);
      return r.data.data;
    }), [request]);

  const unpublishProperty = useCallback((propertyId: string, portal: string) =>
    request(async () => {
      const r = await apiClient.post(`/marketing/portals/unpublish/${propertyId}/${portal}`);
      return r.data.data;
    }), [request]);

  const getPublications = useCallback((propertyId?: string) =>
    request(async () => {
      const r = await apiClient.get('/marketing/portals/publications', { params: propertyId ? { propertyId } : {} });
      return r.data.data as Array<Record<string, unknown>>;
    }), [request]);

  return {
    loading,
    // Meta Ads
    getMetaIntegration, saveMetaIntegration, syncMetaCampaigns, getMetaCampaigns, sendCapiEvent,
    // Google Ads
    getGoogleIntegration, saveGoogleIntegration, syncGoogleCampaigns, getGoogleCampaigns, sendOfflineConversion,
    // Portais
    getPortalIntegrations, savePortalIntegration, deletePortalIntegration,
    publishProperty, unpublishProperty, getPublications,
  };
}
