// Hooks React Query para o módulo de Contatos
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export interface Contact {
  id: string;
  workspaceId: string;
  type: 'PERSON' | 'COMPANY';
  name: string;
  email?: string | null;
  phone?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  birthDate?: string | null;
  profession?: string | null;
  income?: number | null;
  companyName?: string | null;
  tradeName?: string | null;
  zipCode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  marketingConsent: boolean;
  origin?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
  customFields: Record<string, unknown>;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  tags?: Array<{ tag: { id: string; name: string; color: string } }>;
  deals?: Array<{ id: string; title: string; stage?: { name: string; color: string } }>;
  documents?: Array<{ id: string; name: string; type: string; url: string }>;
  _count?: { deals: number; activities: number };
}

export interface ContactsListResponse {
  items: Contact[];
  meta: { page: number; limit: number; total: number; pages: number };
}

export interface ContactQuery {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  origin?: string;
  city?: string;
  tags?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

function useWorkspaceId() {
  return useAuthStore((s) => s.currentWorkspaceId) ?? '';
}

// Lista contatos com paginação e filtros
export function useContacts(query: ContactQuery = {}) {
  const workspaceId = useWorkspaceId();

  return useQuery({
    queryKey: ['contacts', workspaceId, query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.page) params.set('page', String(query.page));
      if (query.limit) params.set('limit', String(query.limit));
      if (query.search) params.set('search', query.search);
      if (query.type) params.set('type', query.type);
      if (query.origin) params.set('origin', query.origin);
      if (query.city) params.set('city', query.city);
      if (query.sortBy) params.set('sortBy', query.sortBy);
      if (query.sortOrder) params.set('sortOrder', query.sortOrder);

      const res = await api.get(`/contacts?${params}`, {
        headers: { 'x-workspace-id': workspaceId },
      });
      return res.data.data as ContactsListResponse;
    },
    enabled: !!workspaceId,
  });
}

// Busca contato por ID
export function useContact(id: string) {
  const workspaceId = useWorkspaceId();

  return useQuery({
    queryKey: ['contact', workspaceId, id],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Contact }>(`/contacts/${id}`, {
        headers: { 'x-workspace-id': workspaceId },
      });
      return res.data.data;
    },
    enabled: !!workspaceId && !!id,
  });
}

// Timeline de atividades do contato
export function useContactTimeline(contactId: string) {
  const workspaceId = useWorkspaceId();

  return useQuery({
    queryKey: ['contact-timeline', workspaceId, contactId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: unknown[] }>(`/contacts/${contactId}/timeline`, {
        headers: { 'x-workspace-id': workspaceId },
      });
      return res.data.data;
    },
    enabled: !!workspaceId && !!contactId,
  });
}

// Duplicatas de contatos
export function useContactDuplicates() {
  const workspaceId = useWorkspaceId();

  return useQuery({
    queryKey: ['contact-duplicates', workspaceId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: unknown[] }>('/contacts/duplicates', {
        headers: { 'x-workspace-id': workspaceId },
      });
      return res.data.data;
    },
    enabled: !!workspaceId,
  });
}

// Cria contato
export function useCreateContact() {
  const workspaceId = useWorkspaceId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Contact>) => {
      const res = await api.post<{ success: boolean; data: Contact }>('/contacts', data, {
        headers: { 'x-workspace-id': workspaceId },
      });
      return res.data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['contacts', workspaceId] });
    },
  });
}

// Atualiza contato
export function useUpdateContact() {
  const workspaceId = useWorkspaceId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Contact> & { id: string }) => {
      const res = await api.patch<{ success: boolean; data: Contact }>(`/contacts/${id}`, data, {
        headers: { 'x-workspace-id': workspaceId },
      });
      return res.data.data;
    },
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: ['contacts', workspaceId] });
      void qc.invalidateQueries({ queryKey: ['contact', workspaceId, id] });
    },
  });
}

// Remove contato
export function useDeleteContact() {
  const workspaceId = useWorkspaceId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/contacts/${id}`, { headers: { 'x-workspace-id': workspaceId } });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['contacts', workspaceId] });
    },
  });
}
