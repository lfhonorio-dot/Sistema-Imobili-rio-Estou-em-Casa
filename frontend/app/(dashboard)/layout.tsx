// Layout do dashboard com sidebar e header.
// Proteção de rota feita no cliente pelo AuthGate (sem middleware server-side):
// nada é renderizado antes de a sessão ser confirmada no /auth/me.
// O ProfileGate esconde as telas que não fazem parte do perfil de operação.

import { Sidebar } from '@/components/layout/sidebar';
import { AuthGate } from '@/components/providers/auth-guard';
import { ProfileGate } from '@/components/providers/profile-gate';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <ProfileGate>{children}</ProfileGate>
        </main>
      </div>
    </AuthGate>
  );
}
