// Hook para gerenciar conversas e mensagens do Hub
'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export interface Message {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  body?: string;
  mediaUrl?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  channel: string;
  status: string;
  subject?: string;
  lastMessageAt?: string;
  createdAt: string;
  contact?: { id: string; name: string; phone?: string; email?: string };
  messages?: Message[];
}

export function useConversations() {
  const { currentWorkspace } = useAuthStore();
  const workspaceId = currentWorkspace?.workspace.id || '';
  const headers = { 'x-workspace-id': workspaceId };

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

  const fetchConversations = useCallback(async (params?: Record<string, string>) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: '1', limit: '30', ...params }).toString();
      const res = await api.get(`/conversations?${q}`, { headers });
      setConversations(res.data.data.items);
      setMeta(res.data.data.meta);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const selectConversation = useCallback(async (id: string) => {
    const res = await api.get(`/conversations/${id}`, { headers });
    setSelected(res.data.data);
    setMessages(res.data.data.messages || []);
  }, [workspaceId]);

  const sendMessage = useCallback(async (conversationId: string, body: string) => {
    const res = await api.post(`/conversations/${conversationId}/messages`, { body, type: 'TEXT' }, { headers });
    setMessages((prev) => [...prev, res.data.data]);
  }, [workspaceId]);

  const createConversation = useCallback(async (data: Partial<Conversation>) => {
    const res = await api.post('/conversations', data, { headers });
    setConversations((prev) => [res.data.data, ...prev]);
    return res.data.data as Conversation;
  }, [workspaceId]);

  const changeStatus = useCallback(async (id: string, status: string) => {
    await api.patch(`/conversations/${id}/status`, { status }, { headers });
    setConversations((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
  }, [workspaceId]);

  return {
    conversations, selected, messages, loading, meta,
    fetchConversations, selectConversation, sendMessage, createConversation, changeStatus,
  };
}
