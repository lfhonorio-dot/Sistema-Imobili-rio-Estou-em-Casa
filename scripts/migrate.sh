#!/bin/bash
# Script de migração do banco de dados
# Aplica as migrações Prisma no ambiente correto

set -e

echo "Executando migrações do banco de dados..."

# Carrega variáveis de ambiente
if [ -f ".env" ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Verifica se DATABASE_URL está definida
if [ -z "$DATABASE_URL" ]; then
  echo "ERRO: DATABASE_URL não está definida no .env"
  exit 1
fi

# Verifica o ambiente
ENVIRONMENT=${NODE_ENV:-development}

cd backend

if [ "$ENVIRONMENT" = "production" ]; then
  echo "Ambiente: PRODUÇÃO"
  echo "Aplicando migrações em produção..."
  npx prisma migrate deploy
else
  echo "Ambiente: DESENVOLVIMENTO"
  echo "Aplicando migrações de desenvolvimento..."
  npx prisma migrate dev --name "$(date +%Y%m%d_%H%M%S)_auto" || npx prisma migrate dev
fi

# Gera o cliente Prisma
echo "Gerando cliente Prisma..."
npx prisma generate

echo "Migrações aplicadas com sucesso!"
cd ..
