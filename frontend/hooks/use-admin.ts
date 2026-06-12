'use client';
import { useState, useCallback } from 'react';
import axios from 'axios';

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1' });

function headers(token: string, workspaceId: string) {
  return { Authorization: `Bearer ${token}`, 'x-workspace-id': workspaceId };
}

export function useAdmin(token: string, workspaceId: string) {
  const [loading, setLoading] = useState(false);

  const req = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    setLoading(true);
    try { return await fn(); } catch { return null; } finally { setLoading(false); }
  }, []);

  const h = () => headers(token, workspaceId);

  return {
    loading,
    getPlatformHealth: () => api.get('/admin/health').then(r => r.data.data),
    getPlatformStats: () => req(() => api.get('/admin/stats', { headers: h() }).then(r => r.data.data)),
    getPlatformConfigs: () => req(() => api.get('/admin/platform-configs', { headers: h() }).then(r => r.data.data)),
    setPlatformConfig: (data: Record<string, string>) => req(() => api.post('/admin/platform-configs', data, { headers: h() }).then(r => r.data.data)),
    getFeatureFlags: () => req(() => api.get('/admin/feature-flags', { headers: h() }).then(r => r.data.data)),
    setFeatureFlag: (data: Record<string, unknown>) => req(() => api.post('/admin/feature-flags', data, { headers: h() }).then(r => r.data.data)),
    checkFeatureFlag: (key: string) => req(() => api.get(`/admin/feature-flags/${key}/check`, { headers: h() }).then(r => r.data.data)),
    getWorkspacePlan: () => req(() => api.get('/admin/plan', { headers: h() }).then(r => r.data.data)),
    setWorkspacePlan: (data: Record<string, unknown>) => req(() => api.post('/admin/plan', data, { headers: h() }).then(r => r.data.data)),
    getOnboardingSteps: () => req(() => api.get('/admin/onboarding', { headers: h() }).then(r => r.data.data)),
    completeOnboardingStep: (step: string) => req(() => api.post('/admin/onboarding/complete', { step }, { headers: h() }).then(r => r.data.data)),
  };
}
