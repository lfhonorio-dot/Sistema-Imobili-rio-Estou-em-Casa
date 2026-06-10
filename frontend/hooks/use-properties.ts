// Hooks React Query para o módulo de Imóveis
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export interface Property {
  id: string;
  workspaceId: string;
  code: string;
  portalCode?: string | null;
  type: string;
  purpose: string;
  status: string;
  zipCode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  totalArea?: number | null;
  privateArea?: number | null;
  bedrooms?: number | null;
  suites?: number | null;
  bathrooms?: number | null;
  parkingSpaces?: number | null;
  salePrice?: number | null;
  rentalPrice?: number | null;
  iptuMonthly?: number | null;
  condoMonthly?: number | null;
  description?: string | null;
  videoUrl?: string | null;
  tourUrl?: string | null;
  ownerId?: string | null;
  tags: string[];
  highlights: string[];
  customFields: Record<string, unknown>;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  photos?: Array<{ id: string; url: string; caption?: string | null; order: number }>;
  owner?: { id: string; name: string } | null;
  _count?: { contracts: number };
}

export interface PropertyQuery {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  purpose?: string;
  city?: string;
  neighborhood?: string;
  bedrooms?: number;
  priceMin?: number;
  priceMax?: number;
  areaMin?: number;
  areaMax?: number;
  search?: string;
}

export function useProperties(query: PropertyQuery = {}) {
  const workspaceId = useAuthStore((s) => s.currentWorkspace?.id);

  return useQuery({
    queryKey: ['properties', workspaceId, query],
    queryFn: async () => {
      const { data } = await api.get('/properties', { params: query });
      return data as { items: Property[]; meta: { page: number; limit: number; total: number; pages: number } };
    },
    enabled: !!workspaceId,
  });
}

export function useProperty(id: string) {
  const workspaceId = useAuthStore((s) => s.currentWorkspace?.id);

  return useQuery({
    queryKey: ['property', workspaceId, id],
    queryFn: async () => {
      const { data } = await api.get(`/properties/${id}`);
      return data as Property;
    },
    enabled: !!workspaceId && !!id,
  });
}

export function useCreateProperty() {
  const queryClient = useQueryClient();
  const workspaceId = useAuthStore((s) => s.currentWorkspace?.id);

  return useMutation({
    mutationFn: async (dto: Partial<Property>) => {
      const { data } = await api.post('/properties', dto);
      return data as Property;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties', workspaceId] });
    },
  });
}

export function useUpdateProperty() {
  const queryClient = useQueryClient();
  const workspaceId = useAuthStore((s) => s.currentWorkspace?.id);

  return useMutation({
    mutationFn: async ({ id, ...dto }: Partial<Property> & { id: string }) => {
      const { data } = await api.patch(`/properties/${id}`, dto);
      return data as Property;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['properties', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['property', workspaceId, vars.id] });
    },
  });
}

export function useChangePropertyStatus() {
  const queryClient = useQueryClient();
  const workspaceId = useAuthStore((s) => s.currentWorkspace?.id);

  return useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
      const { data } = await api.patch(`/properties/${id}/status`, { status, note });
      return data as Property;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['property', workspaceId, vars.id] });
      queryClient.invalidateQueries({ queryKey: ['properties', workspaceId] });
    },
  });
}

export function useDeleteProperty() {
  const queryClient = useQueryClient();
  const workspaceId = useAuthStore((s) => s.currentWorkspace?.id);

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/properties/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties', workspaceId] });
    },
  });
}
