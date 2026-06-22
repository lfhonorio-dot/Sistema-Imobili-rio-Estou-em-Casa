// Hook de autenticação
// Encapsula lógica de login, registro e logout com React Query

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import type { User, AuthTokens } from '@/types';

// -----------------------------------------------
// Hook principal de autenticação
// -----------------------------------------------
export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, setAuth, setUser, logout: clearAuth } = useAuthStore();

  // Busca dados atualizados do usuário
  const { data: profile, isLoading: isLoadingProfile, isError: profileError } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await api.get<{ data: User }>('/auth/me');
      return response.data.data;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Se /auth/me falhar com token inválido, limpa estado stale do Zustand
  // Isso quebra o loop: isAuthenticated volta a false e a query para de rodar
  useEffect(() => {
    if (profileError && isAuthenticated) {
      clearAuth();
      queryClient.clear();
    }
  }, [profileError, isAuthenticated, clearAuth, queryClient]);

  // Atualiza usuário no store quando os dados chegarem
  if (profile && profile.id !== user?.id) {
    setUser(profile);
  }

  // -----------------------------------------------
  // Mutação de login
  // -----------------------------------------------
  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; totpCode?: string }) => {
      const response = await api.post<{
        data: AuthTokens & { requires2FA?: boolean };
      }>('/auth/login', data);
      return response.data.data;
    },
    onSuccess: async (tokens) => {
      if (tokens.requires2FA) {
        return { requires2FA: true };
      }

      // Busca perfil do usuário após login
      const profileResponse = await api.get<{ data: User }>('/auth/me', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });

      setAuth(
        profileResponse.data.data,
        tokens.accessToken,
        tokens.refreshToken,
        tokens.workspaceId,
      );

      router.push('/');
    },
  });

  // -----------------------------------------------
  // Mutação de registro
  // -----------------------------------------------
  const registerMutation = useMutation({
    mutationFn: async (data: {
      workspaceName: string;
      workspaceSlug: string;
      email: string;
      name: string;
      password: string;
      cnpj?: string;
    }) => {
      const response = await api.post<{
        data: AuthTokens & { workspaceId: string };
      }>('/auth/register', data);
      return response.data.data;
    },
    onSuccess: async (tokens) => {
      const profileResponse = await api.get<{ data: User }>('/auth/me', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });

      setAuth(
        profileResponse.data.data,
        tokens.accessToken,
        tokens.refreshToken,
        tokens.workspaceId,
      );

      router.push('/');
    },
  });

  // -----------------------------------------------
  // Mutação de logout
  // -----------------------------------------------
  const logoutMutation = useMutation({
    mutationFn: async (allDevices: boolean = false) => {
      await api.post('/auth/logout', { allDevices });
    },
    onSettled: () => {
      clearAuth();
      queryClient.clear();
      router.push('/login');
    },
  });

  // -----------------------------------------------
  // Mutação de recuperação de senha
  // -----------------------------------------------
  const forgotPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await api.post('/auth/forgot-password', { email });
      return response.data;
    },
  });

  // -----------------------------------------------
  // Mutação de redefinição de senha
  // -----------------------------------------------
  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { token: string; newPassword: string }) => {
      const response = await api.post('/auth/reset-password', data);
      return response.data;
    },
  });

  return {
    user,
    isAuthenticated,
    isLoadingProfile,

    // Mutações
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,

    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,

    logout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,

    forgotPassword: forgotPasswordMutation.mutateAsync,
    isSendingReset: forgotPasswordMutation.isPending,

    resetPassword: resetPasswordMutation.mutateAsync,
    isResettingPassword: resetPasswordMutation.isPending,
  };
}
