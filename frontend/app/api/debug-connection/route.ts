// Rota de diagnóstico de conexão com o backend
// Acesse em produção: /api/debug-connection

import { NextResponse } from 'next/server';

export async function GET() {
  const backendUrl =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3001/api/v1';

  let status = 'unknown';
  let error = null;
  let responseStatus = 0;

  try {
    const res = await fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(5000) });
    responseStatus = res.status;
    status = res.ok ? 'ok' : 'error';
  } catch (e: unknown) {
    status = 'unreachable';
    error = (e as Error).message;
  }

  return NextResponse.json({
    backendUrl,
    backendStatus: status,
    backendHttpStatus: responseStatus,
    backendError: error,
    envVars: {
      BACKEND_URL: process.env.BACKEND_URL ? 'SET' : 'NOT SET',
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ? 'SET' : 'NOT SET',
      NODE_ENV: process.env.NODE_ENV,
    },
  });
}
