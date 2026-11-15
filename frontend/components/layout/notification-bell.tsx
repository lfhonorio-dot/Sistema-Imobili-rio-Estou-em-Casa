'use client';

// Fase 7 — sino de notificações (avisos reais gerados pelo sistema).

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api-error';
import { NOTIFICATION_LABELS, useNotificationActions, useNotificationList, useUnreadCount } from '@/hooks/use-team';

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `há ${Math.max(m, 1)} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `há ${h} h` : new Date(iso).toLocaleDateString('pt-BR');
};

export function NotificationBell({ align = 'end' }: { align?: 'start' | 'end' } = {}) {
  const unread = useUnreadCount();
  const list = useNotificationList(15);
  const { markRead, markAll } = useNotificationActions();
  const count = unread.data?.count ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Notificações" className="relative rounded-md p-2 hover:bg-gray-100">
          <Bell className="h-5 w-5 text-gray-600" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-red-600 px-1 text-center text-[11px] font-semibold leading-[18px] text-white">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-96 max-w-[calc(100vw-1rem)] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notificações</span>
          {count > 0 && (
            <Button size="sm" variant="ghost" onClick={() => markAll.mutate(undefined, { onError: (e) => toast.error(getApiErrorMessage(e)) })}>Marcar todas como lidas</Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {list.isLoading ? <p className="p-4 text-sm text-muted-foreground">Carregando...</p>
            : list.isError ? <p className="p-4 text-sm text-red-600">Não foi possível carregar: {getApiErrorMessage(list.error)}</p>
            : (list.data?.items ?? []).length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nenhum aviso.</p>
            : list.data!.items.map((n) => {
              const body = (
                <div className={`border-b px-3 py-2 text-sm hover:bg-gray-50 ${n.readAt ? 'opacity-60' : ''}`}>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{NOTIFICATION_LABELS[n.type] ?? n.type} · {ago(n.createdAt)}</p>
                  <p className="font-medium">{n.title}</p>
                  <p className="text-muted-foreground">{n.body}</p>
                  {n.emailStatus === 'FAILED' && <p className="text-xs text-red-600">E-mail não enviado: {n.emailError}</p>}
                </div>
              );
              const onClick = () => { if (!n.readAt) markRead.mutate(n.id); };
              return n.link
                ? <Link key={n.id} href={n.link} onClick={onClick} className="block">{body}</Link>
                : <button key={n.id} type="button" onClick={onClick} className="block w-full text-left">{body}</button>;
            })}
        </div>
        <div className="px-3 py-2 text-right">
          <Link href="/settings/notifications" className="text-xs text-blue-600 hover:underline">Configurar avisos</Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
