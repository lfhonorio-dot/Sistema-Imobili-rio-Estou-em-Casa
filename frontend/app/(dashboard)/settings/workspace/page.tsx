// Página de configurações do workspace

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import type { Workspace } from '@/types';

const schema = z.object({
  name: z.string().min(2).max(200).optional(),
  cnpj: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  dpoName: z.string().optional(),
  dpoEmail: z.string().email('E-mail inválido').optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

export default function WorkspaceSettingsPage() {
  const queryClient = useQueryClient();

  // Busca dados do workspace
  const { data: workspaceData, isLoading } = useQuery({
    queryKey: ['workspace'],
    queryFn: async () => {
      const response = await api.get<{ data: Workspace }>('/workspace');
      return response.data.data;
    },
  });

  const workspace = workspaceData;

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: workspace
      ? {
          name: workspace.name,
          cnpj: workspace.cnpj || '',
          address: workspace.address || '',
          phone: workspace.phone || '',
          dpoName: workspace.dpoName || '',
          dpoEmail: workspace.dpoEmail || '',
        }
      : undefined,
  });

  // Mutação de atualização
  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await api.put('/workspace', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Configurações salvas com sucesso!');
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
    onError: () => {
      toast.error('Erro ao salvar configurações. Tente novamente.');
    },
  });

  function onSubmit(data: FormData) {
    updateMutation.mutate(data);
  }

  if (isLoading) {
    return (
      <div>
        <Header title="Configurações do Workspace" />
        <div className="p-6 space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Configurações do Workspace" />

      <div className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Dados da empresa */}
          <Card>
            <CardHeader>
              <CardTitle>Dados da Empresa</CardTitle>
              <CardDescription>
                Informações gerais da sua imobiliária
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Slug do Workspace</Label>
                <Input value={workspace?.slug} disabled className="font-mono text-sm" />
                <p className="text-xs text-muted-foreground">O slug não pode ser alterado após a criação.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nome da Imobiliária</Label>
                <Input id="name" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input id="cnpj" placeholder="00.000.000/0001-00" {...register('cnpj')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Input id="address" placeholder="Rua, número, cidade, estado" {...register('address')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" placeholder="(11) 99999-9999" {...register('phone')} />
              </div>
            </CardContent>
          </Card>

          {/* DPO - Encarregado de Dados */}
          <Card>
            <CardHeader>
              <CardTitle>Encarregado de Dados (DPO)</CardTitle>
              <CardDescription>
                Conforme exigido pela LGPD, identifique o responsável pelo tratamento de dados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dpoName">Nome do DPO</Label>
                <Input id="dpoName" placeholder="Nome do Encarregado" {...register('dpoName')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dpoEmail">E-mail do DPO</Label>
                <Input
                  id="dpoEmail"
                  type="email"
                  placeholder="dpo@imobiliaria.com.br"
                  {...register('dpoEmail')}
                />
                {errors.dpoEmail && (
                  <p className="text-xs text-destructive">{errors.dpoEmail.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!isDirty || updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar Configurações
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
