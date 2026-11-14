// Usuários e papéis (Fase 7): convidar por link, convites pendentes, trocar
// o papel (Dono/Admin, Financeiro, Gerente, Corretor) e remover membro.

'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, UserPlus } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ErrorState } from '@/components/common/error-state';
import { getApiErrorMessage } from '@/lib/api-error';
import { ROLE_LABELS, type RoleKey } from '@/lib/navigation';
import { useTeam } from '@/hooks/use-team';

const ROLE_HELP: Record<RoleKey, string> = {
  ADMIN: 'Tudo, inclusive configurações, usuários e autorizar notas reais.',
  FINANCE: 'Financeiro, cobranças, bancário, notas fiscais e configurações financeiras.',
  MANAGER: 'CRM, contratos, financeiro e relatórios; sem configurações da imobiliária.',
  BROKER: 'Só os próprios leads, negócios, visitas, tarefas e comissões.',
};
const copy = (t: string) => { void navigator.clipboard.writeText(t); toast.success('Link copiado. Envie ao convidado por WhatsApp ou e-mail.'); };

export default function UsersSettingsPage() {
  const t = useTeam();
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [lastLink, setLastLink] = useState<string | null>(null);
  const roles = (t.roles.data ?? []).filter((r) => r.systemKey);

  const invite = async () => {
    if (!email.trim() || !roleId) return toast.error('Informe o e-mail e o papel.');
    try {
      const r = await t.invite.mutateAsync({ email: email.trim(), roleId });
      setLastLink(r.inviteLink);
      setEmail('');
      toast.success('Convite criado.');
    } catch (e) { toast.error(getApiErrorMessage(e)); }
  };

  return (
    <div>
      <Header title="Usuários e papéis" />
      <div className="p-6 space-y-4 max-w-5xl">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" />Convidar usuário</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1"><Label htmlFor="inv-email">E-mail</Label><Input id="inv-email" className="w-72" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="space-y-1"><Label>Papel</Label>
                <Select value={roleId} onValueChange={setRoleId}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Escolha" /></SelectTrigger>
                  <SelectContent>{roles.map((r) => <SelectItem key={r.id} value={r.id}>{ROLE_LABELS[r.systemKey as RoleKey] ?? r.name}</SelectItem>)}</SelectContent>
                </Select></div>
              <Button disabled={t.invite.isPending} onClick={() => void invite()}>Gerar convite</Button>
            </div>
            {roleId && <p className="text-xs text-muted-foreground">{ROLE_HELP[(roles.find((r) => r.id === roleId)?.systemKey as RoleKey) ?? 'BROKER']}</p>}
            {lastLink && (
              <div className="flex items-center gap-2 rounded bg-green-50 p-2">
                <code className="flex-1 break-all text-xs">{lastLink}</code>
                <Button size="sm" variant="outline" onClick={() => copy(lastLink)}><Copy className="h-4 w-4 mr-1" />Copiar link</Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">O convite vale 7 dias. Envie o link ao convidado: ele cria a senha e já entra com o papel escolhido.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Convites pendentes</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {t.invites.isLoading ? <Skeleton className="h-10 w-full" /> : t.invites.isError ? <ErrorState error={t.invites.error} onRetry={() => t.invites.refetch()} compact />
              : (t.invites.data ?? []).length === 0 ? <p className="text-muted-foreground">Nenhum convite pendente.</p> : (
              <ul className="divide-y">
                {t.invites.data!.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>{i.email} · {i.roleName} · vence {new Date(i.expiresAt).toLocaleDateString('pt-BR')}</span>
                    <span className="space-x-2">
                      <Button size="sm" variant="outline" onClick={() => copy(i.inviteLink)}><Copy className="h-4 w-4 mr-1" />Link</Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => t.cancelInvite.mutate(i.id, { onSuccess: () => toast.success('Convite cancelado.'), onError: (e) => toast.error(getApiErrorMessage(e)) })}>Cancelar</Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Membros</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {t.members.isLoading ? <Skeleton className="h-24 w-full" /> : t.members.isError ? <ErrorState error={t.members.error} onRetry={() => t.members.refetch()} /> : (
              <ul className="divide-y">
                {t.members.data!.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <b>{m.user.name}</b> <span className="text-muted-foreground">{m.user.email}</span>
                      {m.isOwner && <span className="ml-2 rounded bg-blue-50 px-1.5 text-xs text-blue-700">Dono</span>}
                    </span>
                    {m.isOwner ? <span className="text-muted-foreground">{ROLE_LABELS.ADMIN}</span> : (
                      <span className="flex items-center gap-2">
                        <Select value={m.role.id} onValueChange={(v) => t.setRole.mutate({ userId: m.user.id, roleId: v }, { onSuccess: () => toast.success('Papel alterado.'), onError: (e) => toast.error(getApiErrorMessage(e)) })}>
                          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(t.roles.data ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.systemKey ? ROLE_LABELS[r.systemKey as RoleKey] : `${r.name} (acesso de Corretor)`}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => {
                          if (confirm(`Remover ${m.user.name} da imobiliária? Os registros dele continuam.`)) {
                            t.remove.mutate(m.user.id, { onSuccess: () => toast.success('Membro removido.'), onError: (e) => toast.error(getApiErrorMessage(e)) });
                          }
                        }}>Remover</Button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">O que cada papel pode fazer</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            {(Object.keys(ROLE_HELP) as RoleKey[]).map((k) => <p key={k}><b>{ROLE_LABELS[k]}:</b> {ROLE_HELP[k]}</p>)}
            <p className="text-xs text-muted-foreground pt-1">As regras valem no servidor: mesmo digitando o endereço da tela, quem não tem acesso recebe a recusa.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
