// Utilitários gerais do frontend

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Combina classes Tailwind de forma inteligente (shadcn/ui pattern)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formata data para PT-BR
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', options || {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Formata data e hora para PT-BR
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Formata CNPJ: 00.000.000/0001-00
export function formatCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

// Formata telefone: (00) 00000-0000
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
}

// Trunca texto com reticências
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Traduz status de requisição LGPD
export function translateLgpdStatus(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'Pendente',
    IN_PROGRESS: 'Em Andamento',
    COMPLETED: 'Concluído',
    REJECTED: 'Rejeitado',
  };
  return map[status] || status;
}

// Traduz tipo de requisição LGPD
export function translateLgpdType(type: string): string {
  const map: Record<string, string> = {
    ACCESS: 'Acesso',
    CORRECTION: 'Correção',
    DELETION: 'Exclusão',
    PORTABILITY: 'Portabilidade',
    REVOKE_CONSENT: 'Revogação de Consentimento',
    INFORMATION: 'Informações',
  };
  return map[type] || type;
}

// Debounce para inputs de busca
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
