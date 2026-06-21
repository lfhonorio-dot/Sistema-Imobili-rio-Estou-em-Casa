// Hook para notificações do usuário
'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt?: string;
  createdAt: string;
  entityType?: string;
  entityId?: string;
}

export function useNotifications() {
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId) ?? '';
  const headers = { 'x-workspace-id': workspaceId };

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async (unreadOnly = false) => {
    setLoading(true);
    try {
      const q = unreadOnly ? '?unreadOnly=true' : '';
      const res = await api.get(`/notifications${q}`, { headers });
      setNotifications(res.data.data.items);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const fetchUnreadCount = useCallback(async () => {
    const res = await api.get('/notifications/unread-count', { headers });
    setUnreadCount(res.data.data.count);
  }, [workspaceId]);

  const markRead = useCallback(async (id: string) => {
    await api.patch(`/notifications/${id}/read`, {}, { headers });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, [workspaceId]);

  const markAllRead = useCallback(async () => {
    await api.post('/notifications/read-all', {}, { headers });
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    setUnreadCount(0);
  }, [workspaceId]);

  return { notifications, unreadCount, loading, fetchNotifications, fetchUnreadCount, markRead, markAllRead };
}
