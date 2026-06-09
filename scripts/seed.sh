#!/bin/bash
# Script de seed do banco de dados
# Popula dados iniciais para desenvolvimento

set -e

echo "Populando banco de dados com dados iniciais..."

# Carrega variáveis de ambiente
if [ -f ".env" ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Verifica o ambiente (não executa em produção sem confirmação)
ENVIRONMENT=${NODE_ENV:-development}

if [ "$ENVIRONMENT" = "production" ]; then
  echo "ATENÇÃO: Você está tentando executar o seed em PRODUÇÃO!"
  read -p "Tem certeza? Digite 'sim' para confirmar: " confirm
  if [ "$confirm" != "sim" ]; then
    echo "Seed cancelado."
    exit 0
  fi
fi

cd backend

echo "Executando seed..."
npx ts-node prisma/seed.ts

echo "Seed executado com sucesso!"
echo ""
echo "Credenciais de demonstração:"
echo "  Admin: admin@demo-imobiliaria.com.br / Admin@123456"
echo "  Gerente: gerente@demo-imobiliaria.com.br / Gerente@123456"
echo "  Workspace: demo-imobiliaria"
echo ""
echo "ATENÇÃO: Altere as senhas antes de usar em produção!"

cd ..
