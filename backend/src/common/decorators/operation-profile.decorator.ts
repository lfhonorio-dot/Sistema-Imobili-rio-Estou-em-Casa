// Perfil de operação do workspace (Fase 1).
// VENDA: só o fluxo de venda. VENDA_E_LOCACAO: tudo.
// Endpoints marcados com @RequiresFullProfile() só respondem quando o
// workspace está no perfil VENDA_E_LOCACAO. A checagem é feita pelo
// WorkspaceGuard (que já carrega o workspace), então basta o decorator.

import { SetMetadata } from '@nestjs/common';

export const OPERATION_PROFILES = ['VENDA', 'VENDA_E_LOCACAO'] as const;
export type OperationProfile = (typeof OPERATION_PROFILES)[number];

export const REQUIRES_FULL_PROFILE_KEY = 'requiresFullProfile';

// Nome amigável do módulo, usado na mensagem de erro para o usuário.
export const RequiresFullProfile = (moduleName: string) =>
  SetMetadata(REQUIRES_FULL_PROFILE_KEY, moduleName);

export function profileBlockedMessage(moduleName: string): string {
  return (
    `O módulo "${moduleName}" não está disponível no perfil de operação "Venda". ` +
    'Para usá-lo, um administrador pode mudar o perfil para "Venda e Locação" em Configurações → Workspace.'
  );
}
