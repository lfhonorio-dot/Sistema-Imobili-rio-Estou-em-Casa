'use client';

// Fornecedores / favorecidos (Fase 2).

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export interface Supplier {
  id: string;
  name: string;
  personType: 'PF' | 'PJ';
  document: string | null;
  email: string | null;
  phone: string | null;
  category: string | null;
  pixKeyType: string | null;
  pixKey: string | null;
  bankCode: string | null;
  agency: string | null;
  accountNumber: string | null;
  notes: string | null;
}

export const SUPPLIER_CATEGORIES: Record<string, string> = {
  CARTORIO: 'Cartório', PUBLICIDADE: 'Publicidade', MANUTENCAO: 'Manutenção', SERVICOS: 'Serviços',
  CORRETOR: 'Corretor/parceiro', IMPOSTOS: 'Impostos e taxas', ALUGUEL: 'Aluguel', OUTRO: 'Outro',
};

export function useSuppliers() {
  const ws = useAuthStore((s) => s.currentWorkspaceId);
  return useQuery({
    queryKey: ['suppliers', ws],
    queryFn: async () => (await api.get('/suppliers', { params: { limit: 500 } })).data.data as { items: Supplier[] },
    enabled: !!ws,
  });
}
