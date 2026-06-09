// Layout raiz da aplicação Next.js
// Configura providers globais: QueryClient, Toaster

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Plataforma Imobiliária',
    template: '%s | Plataforma Imobiliária',
  },
  description: 'CRM + ERP para Imobiliárias - Estou em Casa',
  robots: 'noindex, nofollow', // Não indexar em desenvolvimento
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
