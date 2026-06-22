'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/investimentos', label: 'Investimentos', icon: '💰' },
  { href: '/imoveis', label: 'Imóveis', icon: '🏠' },
  { href: '/recebiveis', label: 'Recebíveis', icon: '📋' },
  { href: '/fluxo-caixa', label: 'Fluxo de Caixa', icon: '💵' },
  { href: '/aposentadoria', label: 'Aposentadoria', icon: '🎯' },
  { href: '/importacao', label: 'Importar Extrato', icon: '📤' },
  { href: '/relatorios', label: 'Relatórios', icon: '📄' },
  { href: '/consultor', label: 'Consultor IA', icon: '🧠' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    const u = localStorage.getItem('user');
    if (u) try { setUser(JSON.parse(u)); } catch {}
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{
        width: 236, background: '#071525', borderRight: '1px solid #1E3A5F',
        display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 10,
      }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid #1E3A5F' }}>
          <div style={{ color: '#C9A227', fontWeight: 800, fontSize: '0.9rem', letterSpacing: '-0.01em' }}>
            💎 Investimentos
          </div>
          <div style={{ color: '#4a6fa5', fontSize: '0.65rem', marginTop: 2, fontWeight: 500 }}>
            Controle Patrimonial
          </div>
        </div>

        <nav style={{ flex: 1, padding: '0.625rem 0.5rem', overflowY: 'auto' }}>
          {navItems.map(item => {
            const isActive = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: '0.625rem',
                padding: '0.5625rem 0.875rem', borderRadius: 8, marginBottom: 2,
                color: isActive ? '#C9A227' : '#6B8CAE',
                background: isActive ? 'rgba(201,162,39,0.1)' : 'transparent',
                textDecoration: 'none', fontSize: '0.8125rem',
                fontWeight: isActive ? 600 : 400, transition: 'all 0.12s',
                borderLeft: isActive ? '2px solid #C9A227' : '2px solid transparent',
              }}>
                <span style={{ fontSize: '0.9rem' }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '1rem', borderTop: '1px solid #1E3A5F' }}>
          {user && (
            <>
              <div style={{ color: '#F1F5F9', fontSize: '0.8rem', fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
              <div style={{ color: '#4a6fa5', fontSize: '0.7rem', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
            </>
          )}
          <button onClick={logout} style={{ width: '100%', padding: '0.4rem', background: 'transparent', border: '1px solid #1E3A5F', borderRadius: 6, color: '#6B8CAE', cursor: 'pointer', fontSize: '0.75rem', transition: 'all 0.12s' }}>
            Sair
          </button>
        </div>
      </aside>

      <main style={{ marginLeft: 236, flex: 1, padding: '1.75rem 2rem', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}
