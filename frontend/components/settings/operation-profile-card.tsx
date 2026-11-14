'use client';

// Escolha do perfil de operação do workspace (Fase 1).
// Trocar o perfil só mostra/esconde menus e telas — nenhum dado é apagado.

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { normalizeProfile, PROFILE_LABELS, type OperationProfile } from '@/lib/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const OPTIONS: { value: OperationProfile; description: string }[] = [
  {
    value: 'VENDA',
    description:
      'Só o fluxo de venda (inclui comissão de corretores parceiros). Locação, vistorias, manutenção, Open Finance, automações, marketing e integrações ficam ocultos.',
  },
  {
    value: 'VENDA_E_LOCACAO',
    description: 'Mostra todos os módulos, inclusive locação e os avançados.',
  },
];

export function OperationProfileCard({ current, canEdit }: { current?: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const saved = normalizeProfile(current);
  const [selected, setSelected] = useState<OperationProfile>(saved);
  useEffect(() => setSelected(saved), [saved]);

  const mutation = useMutation({
    mutationFn: async (operationProfile: OperationProfile) =>
      (await api.put('/workspace', { operationProfile })).data,
    onSuccess: () => {
      toast.success('Perfil de operação atualizado. O menu foi ajustado.');
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
      // /auth/me traz o perfil usado pelo menu e pelo bloqueio de rotas
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível mudar o perfil.')),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil de operação</CardTitle>
        <CardDescription>
          Define quais módulos aparecem no sistema. Trocar o perfil não apaga nenhum dado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div role="radiogroup" aria-label="Perfil de operação" className="space-y-2">
          {OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${
                selected === opt.value ? 'border-primary bg-primary/5' : 'border-border'
              } ${!canEdit ? 'cursor-not-allowed opacity-70' : ''}`}
            >
              <input
                type="radio"
                name="operationProfile"
                value={opt.value}
                checked={selected === opt.value}
                disabled={!canEdit}
                onChange={() => setSelected(opt.value)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium">{PROFILE_LABELS[opt.value]}</span>
                <span className="block text-xs text-muted-foreground">{opt.description}</span>
              </span>
            </label>
          ))}
        </div>
        {!canEdit && (
          <p className="text-xs text-muted-foreground">Só administradores podem mudar o perfil.</p>
        )}
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => mutation.mutate(selected)}
            disabled={!canEdit || selected === saved || mutation.isPending}
          >
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar perfil
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
