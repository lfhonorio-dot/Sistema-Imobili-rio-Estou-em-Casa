'use client';

import { useEffect } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

// Recupera workspaceId do /auth/me se estiver ausente após login
export function AuthInitializer() {
  const { isAuthenticated, currentWorkspaceId, setAuth, user, accessToken, refreshToken } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || currentWorkspaceId) return;

    api.get('/auth/me').then((res) => {
      const me = res.data?.data ?? res.data;
      if (me?.workspaces?.length > 0) {
        setAuth(me, accessToken ?? '', refreshToken ?? '');
      }
    }).catch(() => {});
  }, [isAuthenticated, currentWorkspaceId, setAuth, accessToken, refreshToken]);

  return null;
}
