#!/bin/sh
# Usado pelo validar-fase-8.bat (dentro do container node:20-alpine) e reaproveitável
# em qualquer Linux: compila, roda os testes unitários, cria as tabelas num banco de
# TESTE, liga o backend e roda o fluxo de ouro + testes de integração.
# Precisa de DATABASE_URL apontando para um banco de TESTE vazio.
set -e
cd "$(dirname "$0")/../.."

if [ -z "$DATABASE_URL" ]; then echo "ERRO: defina DATABASE_URL (banco de TESTE)."; exit 1; fi
case "$DATABASE_URL" in *railway*|*neon.tech*|*amazonaws*) echo "ERRO: este script não roda contra banco na nuvem."; exit 1;; esac

command -v openssl >/dev/null 2>&1 || apk add --no-cache openssl >/dev/null

export NODE_ENV=development PORT=3001 APP_PORT=3001
export JWT_ACCESS_SECRET="$(openssl rand -hex 32)" JWT_REFRESH_SECRET="$(openssl rand -hex 32)"
export ENCRYPTION_KEY="$(openssl rand -hex 32)" HMAC_SECRET="$(openssl rand -hex 32)"
export FRONTEND_URL=http://localhost:3000 APP_URL=http://localhost:3000 LOG_TO_FILE=false LOG_LEVEL=warn
export RATE_LIMIT_PER_MINUTE=5000 ASAAS_API_URL_TEST_OVERRIDE=http://127.0.0.1:3999
export SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_USER=teste SMTP_PASS=teste SMTP_FROM=teste@teste.local
export API_URL=http://localhost:3001/api/v1
export DATABASE_URL_DIRECT="${DATABASE_URL_DIRECT:-$DATABASE_URL}"

if [ "$PULAR_INSTALACAO" != "1" ]; then
  echo "== Instalando dependencias (a primeira vez demora alguns minutos)..."
  npm ci --no-audit --no-fund
fi
echo "== Gerando cliente do Prisma, compilando e checando tipos..."
./node_modules/.bin/prisma generate >/dev/null
npm run build
npx tsc --noEmit
echo "== Testes unitarios (jest)..."
npx jest --ci

echo "== Esperando o banco de teste..."
i=0
until ./node_modules/.bin/prisma migrate deploy >/tmp/migrate.log 2>&1; do
  i=$((i+1)); if [ $i -ge 30 ]; then echo "ERRO: nao consegui criar as tabelas:"; tail -n 30 /tmp/migrate.log; exit 1; fi
  sleep 2
done
echo "== Tabelas criadas. Ligando o backend..."
node dist/main.js >/tmp/backend.log 2>&1 &
BACK=$!
trap 'kill $BACK 2>/dev/null || true' EXIT
i=0
until node -e "fetch('http://localhost:3001/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; do
  i=$((i+1)); if [ $i -ge 60 ]; then echo "ERRO: o backend nao subiu:"; tail -n 60 /tmp/backend.log; exit 1; fi
  sleep 2
done
echo "== Backend no ar. Rodando o fluxo de ouro e os testes de integracao..."
node test/api/rodar-tudo.mjs || { echo "---- registro do backend ----"; tail -n 80 /tmp/backend.log; exit 1; }
