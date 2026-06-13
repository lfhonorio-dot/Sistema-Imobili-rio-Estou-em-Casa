#!/bin/sh
# start.sh — Script de inicialização para produção (Railway/Docker)
# Roda migrações antes de iniciar o servidor

set -e

echo "==> Aguardando banco de dados..."
# Tenta conectar ao banco por até 30s usando uma query simples (sem modificar o schema)
for i in $(seq 1 30); do
  echo "SELECT 1" | npx prisma db execute --stdin 2>/dev/null && break || true
  echo "    Tentativa $i/30 — aguardando PostgreSQL..."
  sleep 2
done

echo "==> Resolvendo baseline de migrações..."
# Marca cada migração existente como aplicada para bancos que já têm o schema
# (evita o erro P3005 em bancos criados via db push)
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

echo "==> Gerando cliente Prisma..."
npx prisma generate

echo "==> Iniciando servidor NestJS..."
exec node dist/main
