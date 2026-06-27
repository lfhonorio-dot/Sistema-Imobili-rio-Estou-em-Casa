// Configuração do Next.js 14

const nextConfig = {
  output: 'standalone',

  // Proxy reverso: o frontend chama /api-proxy/* e o Next.js repassa ao backend.
  // Permite configurar o backend via variável de ambiente em TEMPO DE EXECUÇÃO
  // no Railway (não de build). Defina: BACKEND_URL=https://seu-backend.railway.app/api/v1
  async rewrites() {
    const backendUrl =
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:3001/api/v1';

    return [
      {
        source: '/api-proxy/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',        value: 'DENY' },
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
    ];
  },

  images: {
    domains: ['localhost'],
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '9000', pathname: '/**' },
    ],
  },

  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Plataforma Imobiliária',
  },
};

export default nextConfig;
