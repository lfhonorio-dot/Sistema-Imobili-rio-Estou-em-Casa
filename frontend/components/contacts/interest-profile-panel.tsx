'use client';

// Fase 2 — perfil de interesse do cliente comprador e imóveis compatíveis.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import api, { apiFileUrl } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/error-state';

const TYPES: Record<string, string> = {
  APARTMENT: 'Apartamento', HOUSE: 'Casa', LAND: 'Terreno', COMMERCIAL: 'Comercial',
  WAREHOUSE: 'Barracão', RURAL: 'Rural', LAUNCH: 'Lançamento',
};
const PAYMENTS: Record<string, string> = {
  CASH: 'À vista', FINANCING: 'Financiamento', FGTS: 'FGTS', PERMUTA: 'Permuta',
};

interface Profile {
  propertyTypes: string[];
  cities: string[];
  neighborhoods: string[];
  minPrice: string | number | null;
  maxPrice: string | number | null;
  minBedrooms: number | null;
  minParkingSpaces: number | null;
  paymentMethods: string[];
  notes: string | null;
}

const brl = (v: unknown) =>
  v == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(v));
const splitList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
const parseMoney = (s: string) => (s.trim() ? Number(s.replace(/\./g, '').replace(',', '.')) : null);

export function InterestProfilePanel({ contactId }: { contactId: string }) {
  const ws = useAuthStore((s) => s.currentWorkspaceId);
  const qc = useQueryClient();
  const profile = useQuery({
    queryKey: ['interest-profile', ws, contactId],
    queryFn: async () => (await api.get(`/contacts/${contactId}/interest-profile`)).data.data as Profile | null,
    enabled: !!ws,
  });

  const [types, setTypes] = useState<string[]>([]);
  const [payments, setPayments] = useState<string[]>([]);
  const [cities, setCities] = useState('');
  const [neighborhoods, setNeighborhoods] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minBedrooms, setMinBedrooms] = useState('');
  const [minParking, setMinParking] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    setTypes(p.propertyTypes);
    setPayments(p.paymentMethods);
    setCities(p.cities.join(', '));
    setNeighborhoods(p.neighborhoods.join(', '));
    setMinPrice(p.minPrice != null ? String(Number(p.minPrice)) : '');
    setMaxPrice(p.maxPrice != null ? String(Number(p.maxPrice)) : '');
    setMinBedrooms(p.minBedrooms != null ? String(p.minBedrooms) : '');
    setMinParking(p.minParkingSpaces != null ? String(p.minParkingSpaces) : '');
    setNotes(p.notes ?? '');
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () =>
      api.put(`/contacts/${contactId}/interest-profile`, {
        propertyTypes: types,
        paymentMethods: payments,
        cities: splitList(cities),
        neighborhoods: splitList(neighborhoods),
        minPrice: parseMoney(minPrice),
        maxPrice: parseMoney(maxPrice),
        minBedrooms: minBedrooms ? Number(minBedrooms) : null,
        minParkingSpaces: minParking ? Number(minParking) : null,
        notes: notes || null,
      }),
    onSuccess: () => {
      toast.success('Perfil de interesse salvo');
      void qc.invalidateQueries({ queryKey: ['interest-profile'] });
      void qc.invalidateQueries({ queryKey: ['matching-properties'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível salvar o perfil.')),
  });

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  if (profile.isLoading) return <Skeleton className="h-64 w-full" />;
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />;

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Perfil de interesse (comprador)</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-1">
          <Label className="text-xs">Tipo de imóvel</Label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TYPES).map(([k, v]) => (
              <label key={k} className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${types.includes(k) ? 'border-primary bg-primary/10' : ''}`}>
                <input type="checkbox" className="sr-only" checked={types.includes(k)} onChange={() => toggle(types, setTypes, k)} />{v}
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label className="text-xs">Cidades (separe por vírgula)</Label>
            <Input value={cities} onChange={(e) => setCities(e.target.value)} placeholder="Franca, Patrocínio Paulista" /></div>
          <div className="space-y-1"><Label className="text-xs">Bairros (separe por vírgula)</Label>
            <Input value={neighborhoods} onChange={(e) => setNeighborhoods(e.target.value)} placeholder="Centro, Jardim Paulista" /></div>
          <div className="space-y-1"><Label className="text-xs">Preço mínimo (R$)</Label>
            <Input inputMode="decimal" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="250000" /></div>
          <div className="space-y-1"><Label className="text-xs">Preço máximo (R$)</Label>
            <Input inputMode="decimal" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="400000" /></div>
          <div className="space-y-1"><Label className="text-xs">Quartos (mínimo)</Label>
            <Input type="number" min={0} value={minBedrooms} onChange={(e) => setMinBedrooms(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Vagas (mínimo)</Label>
            <Input type="number" min={0} value={minParking} onChange={(e) => setMinParking(e.target.value)} /></div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Forma de pagamento pretendida</Label>
          <div className="flex flex-wrap gap-3">
            {Object.entries(PAYMENTS).map(([k, v]) => (
              <label key={k} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={payments.includes(k)} onChange={() => toggle(payments, setPayments, k)} /> {v}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-1"><Label className="text-xs">Observações</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar perfil
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface MatchingItem {
  property: {
    id: string; code: string; type: string; street?: string | null; number?: string | null; neighborhood?: string | null;
    city?: string | null; salePrice: number | null; bedrooms?: number | null; photo: string | null;
  };
  score: number;
  reasons: string[];
}

export function MatchingPropertiesPanel({ contactId }: { contactId: string }) {
  const ws = useAuthStore((s) => s.currentWorkspaceId);
  const q = useQuery({
    queryKey: ['matching-properties', ws, contactId],
    queryFn: async () =>
      (await api.get(`/contacts/${contactId}/matching-properties`)).data.data as { hasProfile: boolean; items: MatchingItem[] },
    enabled: !!ws,
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Imóveis compatíveis</CardTitle></CardHeader>
      <CardContent>
        {q.isLoading ? <Skeleton className="h-24 w-full" /> : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} compact />
        ) : !q.data!.hasProfile ? (
          <p className="text-sm text-muted-foreground">Preencha o perfil de interesse para ver sugestões de imóveis.</p>
        ) : q.data!.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum imóvel disponível compatível com o perfil no momento.</p>
        ) : (
          <div className="divide-y">
            {q.data!.items.map(({ property: p, score, reasons }) => (
              <div key={p.id} className="flex items-center gap-3 py-2 text-sm">
                {p.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={apiFileUrl(p.photo)} alt="" className="h-12 w-16 rounded object-cover" />
                ) : <div className="h-12 w-16 rounded bg-muted" />}
                <div className="flex-1 min-w-0">
                  <Link href={`/properties/${p.id}`} className="font-medium hover:underline">
                    {p.code} — {TYPES[p.type] ?? p.type}{p.neighborhood ? `, ${p.neighborhood}` : ''}{p.city ? ` (${p.city})` : ''}
                  </Link>
                  <p className="text-xs text-muted-foreground">{brl(p.salePrice)} · {reasons.join(' · ')}</p>
                </div>
                <Badge variant={score >= 75 ? 'default' : 'secondary'}>{score}%</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
