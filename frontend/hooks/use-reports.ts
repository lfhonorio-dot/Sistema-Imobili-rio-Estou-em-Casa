'use client';
import { useState, useCallback } from 'react';
import axios from 'axios';

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1' });

function headers(token: string, workspaceId: string) {
  return { Authorization: `Bearer ${token}`, 'x-workspace-id': workspaceId };
}

export interface ReportFilter {
  startDate?: string;
  endDate?: string;
  groupBy?: string;
  pipelineId?: string;
}

export function useReports(token: string, workspaceId: string) {
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

  const getDashboard = useCallback(() =>
    request(() => api.get('/reports/dashboard', { headers: headers(token, workspaceId) })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const getCrmFunnel = useCallback((filter?: ReportFilter) =>
    request(() => api.get('/reports/crm-funnel', { headers: headers(token, workspaceId), params: filter })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const getDealPerformance = useCallback((filter?: ReportFilter) =>
    request(() => api.get('/reports/deal-performance', { headers: headers(token, workspaceId), params: filter })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const getContactGrowth = useCallback((filter?: ReportFilter) =>
    request(() => api.get('/reports/contact-growth', { headers: headers(token, workspaceId), params: filter })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const getPropertyStatus = useCallback(() =>
    request(() => api.get('/reports/property-status', { headers: headers(token, workspaceId) })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const getFinancialSummary = useCallback((filter?: ReportFilter) =>
    request(() => api.get('/reports/financial-summary', { headers: headers(token, workspaceId), params: filter })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const getMarketingRoi = useCallback(() =>
    request(() => api.get('/reports/marketing-roi', { headers: headers(token, workspaceId) })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const getAutomationStats = useCallback(() =>
    request(() => api.get('/reports/automation-stats', { headers: headers(token, workspaceId) })
      .then(r => r.data.data)), [request, token, workspaceId]);

  const getActivityHeatmap = useCallback((filter?: ReportFilter) =>
    request(() => api.get('/reports/activity-heatmap', { headers: headers(token, workspaceId), params: filter })
      .then(r => r.data.data)), [request, token, workspaceId]);

  return {
    loading,
    error,
    getDashboard,
    getCrmFunnel,
    getDealPerformance,
    getContactGrowth,
    getPropertyStatus,
    getFinancialSummary,
    getMarketingRoi,
    getAutomationStats,
    getActivityHeatmap,
  };
}
