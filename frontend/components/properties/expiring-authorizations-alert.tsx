'use client';

// Fase 2 — alerta de autorizações de venda vencendo (até 30 dias) ou já
// vencidas, com o imóvel ainda à venda. Aparece na lista de imóveis e no
// Dashboard. Erro de carregamento é mostrado, não escondido.

import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { useExpiringAuthorizations } from '@/hooks/use-property-registry';
import { getApiErrorMessage } from '@/lib/api-error';
import { SITUATION_CLASS, SITUATION_LABEL } from './registry-panels';

const date = (v: string) => new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

export function ExpiringAuthorizationsAlert({ compact }: { compact?: boolean }) {
  const q = useExpiringAuthorizations(30);

  if (q.isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        Não foi possível verificar as autorizações de venda: {getApiErrorMessage(q.error)}{' '}
        <button className="underline" onClick={() => q.refetch()}>Tentar de novo</button>
      </div>
    );
  }
  if (!q.data || q.data.length === 0) return null;

  const items = compact ? q.data.slice(0, 5) : q.data;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-medium flex items-center gap-2">
        <CalendarClock className="h-4 w-4" />
        {q.data.length} autorização(ões) de venda vencendo ou vencida(s)
      </p>
      <ul className="mt-2 space-y-1">
        {items.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SITUATION_CLASS[a.situation]}`}>
              {SITUATION_LABEL[a.situation]}
            </span>
            <Link href={`/properties/${a.propertyId}`} className="hover:underline">
              {a.property?.code}
              {a.property?.street ? ` — ${a.property.street}${a.property.number ? `, ${a.property.number}` : ''}` : ''}
            </Link>
            <span className="text-amber-800">
              {a.situation === 'EXPIRED' ? 'venceu em' : 'vence em'} {date(a.validUntil)}
              {a.situation === 'EXPIRING' && a.daysLeft != null && ` (${a.daysLeft === 0 ? 'hoje' : `${a.daysLeft} dia(s)`})`}
              {a.captor?.name ? ` · captador ${a.captor.name}` : ''}
            </span>
          </li>
        ))}
      </ul>
      {compact && q.data.length > items.length && (
        <Link href="/properties" className="mt-2 inline-block underline">ver todas</Link>
      )}
    </div>
  );
}
