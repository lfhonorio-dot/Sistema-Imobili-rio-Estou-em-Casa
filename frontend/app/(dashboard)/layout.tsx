// Layout do dashboard com sidebar e header
// Proteção de rota feita pelo AuthGuard (client-side) — sem middleware server-side.

import { Sidebar } from '@/components/layout/sidebar';
import { AuthInitializer } from '@/components/providers/auth-initializer';
import { AuthGuard } from '@/components/providers/auth-guard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AuthGuard />
      <AuthInitializer />
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}
