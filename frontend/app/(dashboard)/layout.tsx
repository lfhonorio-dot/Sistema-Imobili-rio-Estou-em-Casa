// Layout do dashboard com sidebar e header
// A proteção de rotas é feita pelo middleware Next.js (middleware.ts)

import { Sidebar } from '@/components/layout/sidebar';
import { AuthInitializer } from '@/components/providers/auth-initializer';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AuthInitializer />
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}
