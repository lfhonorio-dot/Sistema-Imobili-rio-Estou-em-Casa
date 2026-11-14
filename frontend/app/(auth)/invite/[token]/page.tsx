'use client';

// Fase 7 — aceitar convite para entrar na imobiliária (link enviado pelo dono).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface InviteInfo { workspaceName: string; email: string; roleName: string; used: boolean; expired: boolean; hasAccount: boolean }

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/auth/invite/${token}`)
      .then((r) => setInfo(r.data.data))
      .catch((e) => setError(getApiErrorMessage(e, 'Convite inválido.')));
  }, [token]);

  const submit = async () => {
    if (!info) return;
    if (!info.hasAccount) {
      if (!name.trim()) return toast.error('Informe seu nome.');
      if (password !== confirm) return toast.error('As senhas não coincidem.');
    }
    setSaving(true);
    try {
      await api.post('/auth/accept-invite', { token, name: name.trim() || undefined, password });
      toast.success('Convite aceito! Entre com seu e-mail e senha.');
      router.push(`/login?email=${encodeURIComponent(info.email)}`);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Building2 className="mx-auto mb-2 h-8 w-8 text-primary" />
          <CardTitle>Convite</CardTitle>
          <CardDescription>
            {info ? <>Você foi convidado(a) para <b>{info.workspaceName}</b> como <b>{info.roleName}</b>.</> : 'Verificando o convite...'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {info && (info.used || info.expired) && (
            <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">
              {info.used ? 'Este convite já foi usado.' : 'Este convite venceu.'} Peça um novo ao dono da imobiliária. <Link className="underline" href="/login">Ir para o login</Link>
            </p>
          )}
          {info && !info.used && !info.expired && (
            <>
              <div className="space-y-1"><Label>E-mail</Label><Input value={info.email} disabled /></div>
              {info.hasAccount ? (
                <p className="text-sm text-muted-foreground">Você já tem conta com este e-mail. Digite a senha dela para entrar nesta imobiliária.</p>
              ) : (
                <div className="space-y-1"><Label htmlFor="inv-name">Seu nome</Label><Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
              )}
              <div className="space-y-1">
                <Label htmlFor="inv-pass">{info.hasAccount ? 'Sua senha' : 'Crie uma senha'}</Label>
                <Input id="inv-pass" type="password" autoComplete={info.hasAccount ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
                {!info.hasAccount && <p className="text-xs text-muted-foreground">8 ou mais caracteres, com maiúscula, minúscula, número e símbolo (@$!%*?&).</p>}
              </div>
              {!info.hasAccount && (
                <div className="space-y-1"><Label htmlFor="inv-conf">Repita a senha</Label><Input id="inv-conf" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
              )}
              <Button className="w-full" disabled={saving || !password} onClick={() => void submit()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Aceitar convite
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
