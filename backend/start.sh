#!/bin/sh
set -e

echo "==> Aguardando banco de dados..."
for i in $(seq 1 30); do
  echo "SELECT 1" | npx prisma db execute --stdin 2>/dev/null && break || true
  echo "    Tentativa $i/30..."
  sleep 2
done

echo "==> Aplicando migrações..."
npx prisma migrate deploy

echo "==> Iniciando servidor NestJS..."
exec node dist/main
