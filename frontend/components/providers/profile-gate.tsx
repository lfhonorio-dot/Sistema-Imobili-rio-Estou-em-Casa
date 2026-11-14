'use client';

// Bloqueio de rota por perfil de operação (Fase 1). Quem abrir direto pela
// URL um módulo oculto (ex.: /maintenance no perfil VENDA) vê uma mensagem
// clara em vez da tela. Nada é apagado: basta mudar o perfil.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { blockedForRole, blockedModuleForPath, PROFILE_LABELS, ROLE_LABELS } from '@/lib/navigation';
import { useRoleKey } from '@/hooks/use-role';
import { useOperationProfile } from '@/hooks/use-operation-profile';

export function ProfileGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const profile = useOperationProfile();
  const role = useRoleKey();
  const blocked = blockedModuleForPath(pathname, profile);
  // Fase 7: área fora do papel (o backend também recusa)
  const roleBlocked = blocked ? null : blockedForRole(pathname, role);
  if (roleBlocked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
          <EyeOff className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Sem acesso a esta área</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            &quot;{roleBlocked}&quot; não está liberado para o papel {ROLE_LABELS[role]}. Se precisar, peça ao dono da imobiliária.
          </p>
          <div className="mt-5 flex justify-center"><Button asChild><Link href="/">Ir para o Dashboard</Link></Button></div>
        </div>
      </div>
    );
  }

  if (!blocked) return <>{children}</>;

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
        <EyeOff className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Módulo não disponível neste perfil</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          &quot;{blocked}&quot; não faz parte do perfil de operação &quot;{PROFILE_LABELS[profile]}&quot;.
          Os dados continuam guardados. Um administrador pode mudar o perfil para
          &quot;{PROFILE_LABELS.VENDA_E_LOCACAO}&quot; em Configurações → Workspace.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button asChild>
            <Link href="/">Ir para o Dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/settings/workspace">Configurações</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
