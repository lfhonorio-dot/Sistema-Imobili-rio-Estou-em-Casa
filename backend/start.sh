#!/bin/sh
set -e

echo "==> DEBUG: Pasta atual: $(pwd)"
echo "==> DEBUG: Arquivos em /app:"
ls -la /app/ 2>/dev/null || echo "Pasta /app nao existe"
echo "==> DEBUG: Pasta dist:"
ls -la /app/dist/ 2>/dev/null || echo "DIST NAO EXISTE!"

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

echo "==> Auto-cura de migrações que falharam em tentativas anteriores..."
# Se uma migration ficou marcada como FALHA (P3009), o migrate deploy recusa
# aplicar qualquer coisa. Marcamos como revertida para reaplicar a versão
# corrigida. Em migrations já aplicadas com sucesso, o comando falha e é
# ignorado (|| true). As operações são idempotentes (IF NOT EXISTS / soft-delete).
npx prisma migrate resolve --rolled-back "20260629201000_unique_contact_document" 2>/dev/null || true

echo "==> Aplicando migrações..."
npx prisma migrate deploy

echo "==> Iniciando servidor NestJS..."
exec node dist/main
