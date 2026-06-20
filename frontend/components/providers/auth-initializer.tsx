'use client';

import { useEffect } from 'react';
import api, { getStoredAccessToken, getStoredRefreshToken } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

// Recupera workspaceId do /auth/me se estiver ausente após login
export function AuthInitializer() {
  const { isAuthenticated, currentWorkspaceId, setAuth, setCurrentWorkspace } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || currentWorkspaceId) return;

    // Tenta /auth/me primeiro (retorna user + workspaces no novo backend)
    // Fallback: /auth/workspaces
    api.get('/auth/me').then((res) => {
      const me = res.data?.data ?? res.data;
      const workspaces = me?.workspaces;
      if (workspaces?.length > 0) {
        const accessToken = getStoredAccessToken() ?? '';
        const refreshToken = getStoredRefreshToken() ?? '';
        setAuth({ ...me, workspaces }, accessToken, refreshToken);
      } else {
        // Fallback para o endpoint dedicado
        return api.get('/auth/workspaces').then((r) => {
          const workspaces = r.data?.data ?? r.data;
          if (Array.isArray(workspaces) && workspaces.length > 0) {
            const accessToken = getStoredAccessToken() ?? '';
            const refreshToken = getStoredRefreshToken() ?? '';
            const user = useAuthStore.getState().user;
            if (user) setAuth({ ...user, workspaces }, accessToken, refreshToken);
          }
        });
      }
    }).catch(() => {});
  }, [isAuthenticated, currentWorkspaceId, setAuth, setCurrentWorkspace]);

  return null;
}
