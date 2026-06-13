#!/bin/sh
# start.sh — Script de inicialização para produção (Railway/Docker)
# Roda migrações antes de iniciar o servidor

set -e

echo "==> Aguardando banco de dados..."
# Tenta conectar ao banco por até 30s
for i in $(seq 1 30); do
  npx prisma db push --skip-generate 2>/dev/null && break || true
  echo "    Tentativa $i/30 — aguardando PostgreSQL..."
  sleep 2
done

echo "==> Aplicando migrações..."
npx prisma migrate deploy

echo "==> Gerando cliente Prisma..."
npx prisma generate

echo "==> Iniciando servidor NestJS..."
exec node dist/main
