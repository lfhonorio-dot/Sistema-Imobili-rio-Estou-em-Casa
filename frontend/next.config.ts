// Configuração do Next.js 14
// Headers de segurança, redirecionamentos e otimizações

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Habilita o modo de compilação standalone para Docker
  output: 'standalone',

  // Headers de segurança para todas as rotas
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
        ],
      },
    ];
  },

  // Configuração de imagens externas permitidas
  images: {
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/**',
      },
    ],
  },

  // Variáveis de ambiente públicas
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Plataforma Imobiliária',
  },
};

export default nextConfig;
