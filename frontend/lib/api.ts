// Cliente HTTP Axios com interceptores de autenticação
// Gerencia renovação automática de tokens e redirecionamento em caso de 401

import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// Instância principal do Axios
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
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
        // Sem refresh token: redireciona para login
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
  return localStorage.getItem('workspaceId');
}

export function storeTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
  // Cookie necessário para o middleware Next.js verificar autenticação
  document.cookie = `accessToken=${accessToken}; path=/; max-age=900; SameSite=Lax`;
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
  document.cookie = 'accessToken=; path=/; max-age=0';
}

function redirectToLogin(): void {
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

export { api };
export default api;
