// Extração da mensagem de erro do backend (regra 10: o usuário sempre vê a
// mensagem específica; nada de catch vazio). O backend responde erros no
// formato { statusCode, message, error, timestamp, path }, onde `message`
// pode ser string ou lista (erros de validação).

type MaybeAxiosError = {
  message?: string;
  code?: string;
  response?: { status?: number; data?: { message?: string | string[]; error?: string } };
};

/** true quando a requisição nem chegou a ter resposta do servidor. */
export function isNetworkError(err: unknown): boolean {
  const e = err as MaybeAxiosError | undefined;
  return !!e && !e.response;
}

export function getApiErrorStatus(err: unknown): number | undefined {
  return (err as MaybeAxiosError | undefined)?.response?.status;
}

export function getApiErrorMessage(err: unknown, fallback = 'Não foi possível concluir a operação.'): string {
  const e = err as MaybeAxiosError | undefined;
  if (!e) return fallback;
  if (isNetworkError(e)) {
    if (e.code === 'ECONNABORTED') {
      return 'O servidor demorou demais para responder. Verifique sua internet e tente de novo.';
    }
    return 'Sem conexão com o servidor. Verifique sua internet e tente de novo.';
  }
  const msg = e.response?.data?.message;
  if (Array.isArray(msg) && msg.length) return msg.join(' ');
  if (typeof msg === 'string' && msg.trim()) return msg;
  const status = e.response?.status;
  if (status === 401) return 'Sua sessão expirou. Entre novamente.';
  if (status === 403) return 'Você não tem permissão para esta ação.';
  if (status === 404) return 'Registro não encontrado.';
  if (status && status >= 500) return 'Erro no servidor. Tente de novo em alguns instantes.';
  return fallback;
}
