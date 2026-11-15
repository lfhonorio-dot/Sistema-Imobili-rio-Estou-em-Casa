'use client';

// Fase 7 — o que cada pessoa quer receber (sino e/ou e-mail).

import { toast } from 'sonner';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/common/error-state';
import { getApiErrorMessage } from '@/lib/api-error';
import { useRoleKey } from '@/hooks/use-role';
import { NOTIFICATION_LABELS, useNotificationActions, useNotificationPrefs } from '@/hooks/use-team';

export default function NotificationSettingsPage() {
  const { prefs, emailSwitch, update, setEmail } = useNotificationPrefs();
  const { runRules } = useNotificationActions();
  const role = useRoleKey();
  const onErr = (e: unknown) => toast.error(getApiErrorMessage(e));
  return (
    <div>
      <Header title="Notificações" />
      <div className="p-6 space-y-4 max-w-3xl">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Avisos por e-mail</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {emailSwitch.isError ? <ErrorState error={emailSwitch.error} compact /> : (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!!emailSwitch.data?.emailNotifications} disabled={emailSwitch.isLoading}
                  onChange={(e) => setEmail.mutate(e.target.checked, { onError: onErr })} />
                Receber os avisos também no meu e-mail
              </label>
            )}
            <p className="text-xs text-muted-foreground">Se o e-mail do sistema não estiver configurado, o aviso aparece só no sino (e mostra que o e-mail não foi enviado).</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Tipos de aviso</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {prefs.isLoading ? <Skeleton className="h-32 w-full" /> : prefs.isError ? <ErrorState error={prefs.error} onRetry={() => prefs.refetch()} /> : (
              <table className="w-full">
                <thead className="text-left text-muted-foreground"><tr><th className="py-1">Aviso</th><th className="py-1">Sino</th><th className="py-1">E-mail</th></tr></thead>
                <tbody className="divide-y">
                  {prefs.data!.map((p) => (
                    <tr key={p.type}>
                      <td className="py-2">{NOTIFICATION_LABELS[p.type] ?? p.type}</td>
                      <td className="py-2"><input type="checkbox" aria-label={`Sino: ${p.type}`} checked={p.inApp} onChange={(e) => update.mutate({ type: p.type, inApp: e.target.checked, email: p.email }, { onError: onErr })} /></td>
                      <td className="py-2"><input type="checkbox" aria-label={`E-mail: ${p.type}`} checked={p.email} onChange={(e) => update.mutate({ type: p.type, inApp: p.inApp, email: e.target.checked }, { onError: onErr })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-2 text-xs text-muted-foreground">O sistema confere a cada 5 minutos: lead novo, visitas do dia, tarefas vencendo, propostas paradas há 3 dias, parcelas vencidas, autorizações de venda vencendo em 15 dias e notas fiscais rejeitadas. Cada acontecimento avisa uma vez.</p>
          </CardContent>
        </Card>
        {(role === 'ADMIN' || role === 'MANAGER') && (
          <Button variant="outline" disabled={runRules.isPending} onClick={() => runRules.mutate(undefined, { onSuccess: (r) => toast.success(`${r.created} aviso(s) novo(s).`), onError: onErr })}>Verificar agora</Button>
        )}
      </div>
    </div>
  );
}
