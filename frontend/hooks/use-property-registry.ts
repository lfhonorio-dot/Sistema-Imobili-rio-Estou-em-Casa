'use client';

// Fase 2 — dados dos cadastros do imóvel: proprietários, autorização de
// venda, chaves, histórico de preço, documentos, fotos e clientes compatíveis.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export interface PropertyOwnerLink {
  id: string;
  contactId: string;
  sharePct: string | number | null;
  isPrimary: boolean;
  contact: { id: string; name: string; type: string; phone?: string | null; email?: string | null; maritalStatus?: string | null; spouseContactId?: string | null };
}

export interface PropertyAuthorization {
  id: string;
  propertyId: string;
  signedAt: string;
  validUntil: string;
  exclusive: boolean;
  commissionRate: string | number | null;
  askingPrice: string | number | null;
  captorUserId: string | null;
  captor: { id: string; name: string } | null;
  notes: string | null;
  status: string;
  situation: 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'CANCELLED';
  daysLeft: number | null;
  cancelReason?: string | null;
  property?: { id: string; code: string; street?: string | null; number?: string | null; neighborhood?: string | null; city?: string | null };
}

export interface KeyMovement {
  id: string;
  action: 'CHECKOUT' | 'RETURN';
  keyLabel: string | null;
  holderName: string;
  expectedReturnAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface PriceHistoryItem {
  id: string;
  field: 'SALE_PRICE' | 'RENTAL_PRICE';
  oldValue: string | number | null;
  newValue: string | number | null;
  createdAt: string;
}

export interface PropertyDocument {
  id: string;
  name: string;
  type: string;
  url: string;
  size?: number | null;
  mimeType?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

export interface MatchingContact {
  contact: { id: string; name: string; phone?: string | null; email?: string | null };
  score: number;
  reasons: string[];
}

const unwrap = <T,>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

function useWs() {
  return useAuthStore((s) => s.currentWorkspaceId);
}

export function usePropertyOwners(propertyId: string) {
  const ws = useWs();
  return useQuery({
    queryKey: ['property-owners', ws, propertyId],
    queryFn: () => unwrap<PropertyOwnerLink[]>(api.get(`/properties/${propertyId}/owners`)),
    enabled: !!ws && !!propertyId,
  });
}

export function usePropertyAuthorizations(propertyId: string) {
  const ws = useWs();
  return useQuery({
    queryKey: ['property-authorizations', ws, propertyId],
    queryFn: () => unwrap<PropertyAuthorization[]>(api.get(`/properties/${propertyId}/authorizations`)),
    enabled: !!ws && !!propertyId,
  });
}

export function useExpiringAuthorizations(days = 30) {
  const ws = useWs();
  return useQuery({
    queryKey: ['authorizations-expiring', ws, days],
    queryFn: () => unwrap<PropertyAuthorization[]>(api.get('/properties/authorizations/expiring', { params: { days } })),
    enabled: !!ws,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePropertyKeys(propertyId: string) {
  const ws = useWs();
  return useQuery({
    queryKey: ['property-keys', ws, propertyId],
    queryFn: () =>
      unwrap<{ currentlyOut: boolean; holder: { name: string; since: string; expectedReturnAt: string | null } | null; movements: KeyMovement[] }>(
        api.get(`/properties/${propertyId}/keys`),
      ),
    enabled: !!ws && !!propertyId,
  });
}

export function usePriceHistory(propertyId: string) {
  const ws = useWs();
  return useQuery({
    queryKey: ['property-price-history', ws, propertyId],
    queryFn: () => unwrap<PriceHistoryItem[]>(api.get(`/properties/${propertyId}/price-history`)),
    enabled: !!ws && !!propertyId,
  });
}

export function usePropertyDocuments(propertyId: string) {
  const ws = useWs();
  return useQuery({
    queryKey: ['property-documents', ws, propertyId],
    queryFn: () => unwrap<PropertyDocument[]>(api.get(`/properties/${propertyId}/documents`)),
    enabled: !!ws && !!propertyId,
  });
}

export function useMatchingContacts(propertyId: string) {
  const ws = useWs();
  return useQuery({
    queryKey: ['property-matching-contacts', ws, propertyId],
    queryFn: () => unwrap<MatchingContact[]>(api.get(`/properties/${propertyId}/matching-contacts`)),
    enabled: !!ws && !!propertyId,
  });
}

/** Mutação genérica que invalida as chaves informadas ao terminar. */
export function usePropertyMutation<TVars>(
  fn: (vars: TVars) => Promise<unknown>,
  invalidate: string[],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of invalidate) void qc.invalidateQueries({ queryKey: [key] });
    },
  });
}
