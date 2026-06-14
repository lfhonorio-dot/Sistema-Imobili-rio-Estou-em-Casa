#!/bin/sh
# start.sh — Script de inicialização para produção (Railway)
# O prisma generate já é executado no build — aqui apenas migramos e iniciamos

set -e

echo "==> Aguardando banco de dados..."
for i in $(seq 1 30); do
  echo "SELECT 1" | npx prisma db execute --stdin 2>/dev/null && break || true
  echo "    Tentativa $i/30 — aguardando PostgreSQL..."
  sleep 2
done

echo "==> Resolvendo baseline de migrações..."
npx prisma migrate resolve --applied "20260610170152_homolog_init" 2>/dev/null || true
npx prisma migrate resolve --applied "20260610183306_etapa3_erp_imobiliario" 2>/dev/null || true
npx prisma migrate resolve --applied "20260610223112_etapa4_hub_comunicacao" 2>/dev/null || true
npx prisma migrate resolve --applied "20260611121100_etapa3_backfill_assinatura_boletos_split_bancario_fiscal" 2>/dev/null || true
npx prisma migrate resolve --applied "20260611154417_etapa5_marketing" 2>/dev/null || true
npx prisma migrate resolve --applied "20260611213202_etapa6_automacoes" 2>/dev/null || true
npx prisma migrate resolve --applied "20260612002552_etapa8_integracoes" 2>/dev/null || true
npx prisma migrate resolve --applied "20260612004328_etapa9_admin_configs" 2>/dev/null || true

echo "==> Aplicando migrações..."
npx prisma migrate deploy

echo "==> Iniciando servidor NestJS..."
echo "==> Compilando TypeScript..."
npm ci && npm run build
exec node dist/main
