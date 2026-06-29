// Cliente HTTP Axios com interceptores de autenticação
// Gerencia renovação automática de tokens e redirecionamento em caso de 401

import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

// Em desenvolvimento: usa NEXT_PUBLIC_API_URL diretamente (sem proxy).
// Em produção (Railway): usa /api-proxy que o Next.js rewrites para BACKEND_URL.
// Isso evita que NEXT_PUBLIC_API_URL (fixo em build) aponte para localhost em produção.
const IS_BROWSER = typeof window !== 'undefined';
const API_URL = (() => {
  if (process.env.NODE_ENV === 'production' && IS_BROWSER) {
    return '/api-proxy'; // URL relativa — Next.js rewrites para BACKEND_URL
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
})();

// Instância principal do Axios
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag para evitar múltiplos refreshes simultâneos
let isRefreshing = false;
// Fila de requests aguardando o refresh
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

// Processa a fila após o refresh
function processQueue(error: Error | null, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

// -----------------------------------------------
// Interceptor de requisição: injeta token JWT e workspace ID
// -----------------------------------------------
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Injeta token de acesso se disponível
    const accessToken = getStoredAccessToken();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    // Injeta workspace ID se disponível
    const workspaceId = getStoredWorkspaceId();
    if (workspaceId) {
      config.headers['X-Workspace-Id'] = workspaceId;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// -----------------------------------------------
// Interceptor de resposta: renovação automática do access token
// -----------------------------------------------
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config;

    // Verifica se é 401 e não é a rota de refresh (evita loop infinito)
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      if (isRefreshing) {
        // Adiciona à fila de espera
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getStoredRefreshToken();

      if (!refreshToken) {
        // Sem refresh token: limpa tokens (inclusive cookie) e redireciona
        clearStoredTokens();
        redirectToLogin();
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } =
          response.data.data;

        // Salva novos tokens
        storeTokens(accessToken, newRefreshToken);

        // Atualiza header da requisição original
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        // Processa fila pendente
        processQueue(null, accessToken);

        return api(originalRequest);
      } catch (refreshError) {
        // Refresh falhou: limpa tokens e redireciona
        processQueue(refreshError as Error, null);
        clearStoredTokens();
        redirectToLogin();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// -----------------------------------------------
// Helpers de armazenamento de tokens (localStorage)
// -----------------------------------------------
export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refreshToken');
}

export function getStoredWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  const direct = localStorage.getItem('workspaceId');
  if (direct) return direct;
  // Fallback: lê do Zustand persist
  try {
    const stored = localStorage.getItem('plataforma-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.state?.currentWorkspaceId || null;
    }
  } catch {}
  return null;
}

export function storeTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
  // Cookies necessários para o middleware Next.js verificar autenticação e fazer refresh
  document.cookie = `accessToken=${accessToken}; path=/; max-age=604800; SameSite=Lax`;
  document.cookie = `refreshToken=${refreshToken}; path=/; max-age=604800; SameSite=Lax`;
}

export function storeWorkspaceId(workspaceId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('workspaceId', workspaceId);
}

export function clearStoredTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('workspaceId');
  // Limpa o estado persistido do Zustand para que isAuthenticated volte a false
  localStorage.removeItem('plataforma-auth');
  document.cookie = 'accessToken=; path=/; max-age=0';
  document.cookie = 'refreshToken=; path=/; max-age=0';
}

function redirectToLogin(): void {
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

export { api };
export default api;
