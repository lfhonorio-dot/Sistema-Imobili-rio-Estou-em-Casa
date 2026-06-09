// Página de registro de novo workspace

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';

// Schema de validação do registro
const registerSchema = z.object({
  workspaceName: z.string().min(2, 'Nome da empresa muito curto').max(200),
  workspaceSlug: z
    .string()
    .min(2, 'Slug muito curto')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Use apenas letras minúsculas, números e hífens'),
  name: z.string().min(2, 'Nome muito curto').max(200),
  email: z.string().email('E-mail inválido'),
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
      'Use maiúscula, minúscula, número e símbolo',
    ),
  cnpj: z.string().optional(),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { register: registerUser, isRegistering } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  // Gera slug automaticamente a partir do nome da empresa
  function handleWorkspaceNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.value;
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    setValue('workspaceSlug', slug);
  }

  async function onSubmit(data: RegisterFormData) {
    try {
      await registerUser(data);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Erro ao criar workspace. Tente novamente.';
      toast.error(Array.isArray(message) ? message[0] : message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Criar seu Workspace</h1>
          <p className="text-sm text-muted-foreground">Configure sua imobiliária em minutos</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nova Imobiliária</CardTitle>
            <CardDescription>
              Preencha os dados da sua empresa e do administrador
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              {/* Seção: Empresa */}
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Dados da Empresa</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="workspaceName">Nome da Imobiliária *</Label>
                <Input
                  id="workspaceName"
                  placeholder="Ex: Imobiliária Exemplo Ltda"
                  {...register('workspaceName', {
                    onChange: handleWorkspaceNameChange,
                  })}
                />
                {errors.workspaceName && (
                  <p className="text-xs text-destructive">{errors.workspaceName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="workspaceSlug">Slug do Workspace *</Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">app/</span>
                  <Input
                    id="workspaceSlug"
                    placeholder="imobiliaria-exemplo"
                    {...register('workspaceSlug')}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Identificador único. Use letras minúsculas, números e hífens.
                </p>
                {errors.workspaceSlug && (
                  <p className="text-xs text-destructive">{errors.workspaceSlug.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ (opcional)</Label>
                <Input id="cnpj" placeholder="00.000.000/0001-00" {...register('cnpj')} />
              </div>

              {/* Seção: Administrador */}
              <div className="space-y-1 pt-2">
                <p className="text-sm font-semibold text-foreground">Dados do Administrador</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo *</Label>
                <Input
                  id="name"
                  placeholder="João Silva"
                  autoComplete="name"
                  {...register('name')}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@imobiliaria.com.br"
                  autoComplete="email"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  {...register('password')}
                />
                <p className="text-xs text-muted-foreground">
                  Use letras maiúsculas, minúsculas, números e símbolos (@$!%*?&)
                </p>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isRegistering}>
                {isRegistering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Workspace
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Já tem conta?{' '}
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Fazer login
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
