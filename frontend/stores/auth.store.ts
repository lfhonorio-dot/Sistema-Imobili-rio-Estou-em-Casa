// Store Zustand de autenticação
// Gerencia estado global do usuário autenticado e workspace ativo

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, WorkspaceMembership } from '@/types';
import {
  storeTokens,
  storeWorkspaceId,
  clearStoredTokens,
} from '@/lib/api';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  currentWorkspaceId: string | null;
  currentWorkspace: WorkspaceMembership | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;

  // Ações
  setAuth: (user: User, accessToken: string, refreshToken: string, workspaceId?: string) => void;
  setUser: (user: User) => void;
  setCurrentWorkspace: (workspaceId: string) => void;
  logout: () => void;
  updateTokens: (accessToken: string, refreshToken: string) => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      currentWorkspaceId: null,
      currentWorkspace: null,
      isAuthenticated: false,
      _hasHydrated: false,

      // Define o estado de autenticação completo após login
      setAuth: (user, accessToken, refreshToken, workspaceId) => {
        // Persiste tokens no localStorage para o interceptor do Axios
        storeTokens(accessToken, refreshToken);

        // Define workspace padrão (primeiro workspace do usuário se não especificado)
        const targetWorkspaceId =
          workspaceId || user.workspaces[0]?.workspaceId;

        if (targetWorkspaceId) {
          storeWorkspaceId(targetWorkspaceId);
        }

        const currentWorkspace = targetWorkspaceId
          ? user.workspaces.find((w) => w.workspaceId === targetWorkspaceId) ||
            null
          : null;

        set({
          user,
          accessToken,
          refreshToken,
          currentWorkspaceId: targetWorkspaceId || null,
          currentWorkspace,
          isAuthenticated: true,
        });
      },

      // Atualiza dados do usuário
      setUser: (user) => set({ user }),

      // Troca o workspace ativo
      setCurrentWorkspace: (workspaceId) => {
        const { user } = get();
        const workspace =
          user?.workspaces.find((w) => w.workspaceId === workspaceId) || null;

        storeWorkspaceId(workspaceId);
        set({ currentWorkspaceId: workspaceId, currentWorkspace: workspace });
      },

      // Atualiza tokens após refresh
      updateTokens: (accessToken, refreshToken) => {
        storeTokens(accessToken, refreshToken);
        set({ accessToken, refreshToken });
      },

      setHasHydrated: (value) => set({ _hasHydrated: value }),

      // Logout: limpa todo o estado e localStorage
      logout: () => {
        clearStoredTokens();
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          currentWorkspaceId: null,
          currentWorkspace: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'plataforma-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        currentWorkspaceId: state.currentWorkspaceId,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
