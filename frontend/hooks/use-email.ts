// Hook para templates de email e envio
'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables?: string[];
  category: string;
  isActive: boolean;
  createdAt: string;
}

export function useEmail() {
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId) ?? '';
  const headers = { 'x-workspace-id': workspaceId };

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

  const fetchTemplates = useCallback(async (params?: Record<string, string>) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: '1', limit: '20', ...params }).toString();
      const res = await api.get(`/email/templates?${q}`, { headers });
      setTemplates(res.data.data.items);
      setMeta(res.data.data.meta);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const createTemplate = useCallback(async (data: Partial<EmailTemplate>) => {
    const res = await api.post('/email/templates', data, { headers });
    setTemplates((prev) => [res.data.data, ...prev]);
    return res.data.data as EmailTemplate;
  }, [workspaceId]);

  const updateTemplate = useCallback(async (id: string, data: Partial<EmailTemplate>) => {
    const res = await api.patch(`/email/templates/${id}`, data, { headers });
    setTemplates((prev) => prev.map((t) => t.id === id ? res.data.data : t));
    return res.data.data as EmailTemplate;
  }, [workspaceId]);

  const deleteTemplate = useCallback(async (id: string) => {
    await api.delete(`/email/templates/${id}`, { headers });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, [workspaceId]);

  const previewTemplate = useCallback(async (id: string, variables: Record<string, string> = {}) => {
    const res = await api.post(`/email/templates/${id}/preview`, { variables }, { headers });
    return res.data.data as { subject: string; body: string };
  }, [workspaceId]);

  const sendEmail = useCallback(async (data: {
    to: string; subject?: string; body?: string;
    templateId?: string; variables?: Record<string, string>;
    contactId?: string; conversationId?: string;
  }) => {
    const res = await api.post('/email/send', data, { headers });
    return res.data.data;
  }, [workspaceId]);

  return { templates, loading, meta, fetchTemplates, createTemplate, updateTemplate, deleteTemplate, previewTemplate, sendEmail };
}
