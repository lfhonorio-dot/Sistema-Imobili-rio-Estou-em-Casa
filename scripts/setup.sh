#!/bin/bash
# Script de configuração inicial do ambiente
# Plataforma Imobiliária Estou em Casa

set -e

echo "=================================================="
echo "  Configuração Inicial - Plataforma Imobiliária"
echo "=================================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verifica dependências necessárias
echo ""
echo "Verificando dependências..."

check_dependency() {
  if ! command -v "$1" &> /dev/null; then
    echo -e "${RED}ERRO: $1 não encontrado. Por favor, instale antes de continuar.${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ $1${NC}"
}

check_dependency "docker"
check_dependency "docker-compose"
check_dependency "node"
check_dependency "npm"

# Verifica versões mínimas
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}ERRO: Node.js 18+ é necessário. Versão atual: $(node -v)${NC}"
  exit 1
fi

# Copia arquivo de configuração se não existir
if [ ! -f ".env" ]; then
  echo ""
  echo "Criando arquivo .env a partir do .env.example..."
  cp .env.example .env
  echo -e "${YELLOW}ATENÇÃO: Edite o arquivo .env com suas configurações antes de continuar!${NC}"
  echo -e "${YELLOW}Especialmente: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY e HMAC_SECRET${NC}"
  echo ""
  read -p "Pressione ENTER após editar o .env para continuar..."
else
  echo -e "${GREEN}✓ Arquivo .env já existe${NC}"
fi

# Gera segredos seguros automaticamente se os padrões ainda estiverem lá
if grep -q "seu_access_secret_muito_seguro" .env; then
  echo ""
  echo "Gerando segredos seguros automaticamente..."

  # Gera JWT secrets seguros
  JWT_ACCESS_SECRET=$(openssl rand -hex 32)
  JWT_REFRESH_SECRET=$(openssl rand -hex 32)
  ENCRYPTION_KEY=$(openssl rand -hex 32)
  HMAC_SECRET=$(openssl rand -hex 32)

  # Substitui os valores padrão
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|seu_access_secret_muito_seguro_minimo_64_chars_aqui_123456789012345|${JWT_ACCESS_SECRET}|g" .env
    sed -i '' "s|seu_refresh_secret_muito_seguro_minimo_64_chars_aqui_987654321098765|${JWT_REFRESH_SECRET}|g" .env
    sed -i '' "s|6368616e676520746869732070617373776f726420746f206120736563726574|${ENCRYPTION_KEY}|g" .env
    sed -i '' "s|seu_hmac_secret_muito_seguro_aqui_minimo_32_chars|${HMAC_SECRET}|g" .env
  else
    # Linux
    sed -i "s|seu_access_secret_muito_seguro_minimo_64_chars_aqui_123456789012345|${JWT_ACCESS_SECRET}|g" .env
    sed -i "s|seu_refresh_secret_muito_seguro_minimo_64_chars_aqui_987654321098765|${JWT_REFRESH_SECRET}|g" .env
    sed -i "s|6368616e676520746869732070617373776f726420746f206120736563726574|${ENCRYPTION_KEY}|g" .env
    sed -i "s|seu_hmac_secret_muito_seguro_aqui_minimo_32_chars|${HMAC_SECRET}|g" .env
  fi

  echo -e "${GREEN}✓ Segredos gerados e salvos no .env${NC}"
fi

# Cria diretórios necessários
echo ""
echo "Criando diretórios necessários..."
mkdir -p backend/logs
mkdir -p nginx/ssl
echo -e "${GREEN}✓ Diretórios criados${NC}"

# Instala dependências do backend
echo ""
echo "Instalando dependências do backend..."
cd backend
npm install
echo -e "${GREEN}✓ Dependências do backend instaladas${NC}"
cd ..

# Instala dependências do frontend
echo ""
echo "Instalando dependências do frontend..."
cd frontend
npm install
echo -e "${GREEN}✓ Dependências do frontend instaladas${NC}"
cd ..

# Inicia serviços de infraestrutura
echo ""
echo "Iniciando serviços de infraestrutura (PostgreSQL, Redis, MinIO)..."
docker-compose up -d postgres redis minio

echo "Aguardando serviços ficarem prontos..."
sleep 10

# Verifica saúde dos serviços
echo "Verificando saúde dos serviços..."
docker-compose ps

echo ""
echo "=================================================="
echo -e "${GREEN}  Configuração inicial concluída com sucesso!${NC}"
echo "=================================================="
echo ""
echo "Próximos passos:"
echo "  1. Execute: make migrate  (aplica migrações do banco)"
echo "  2. Execute: make seed     (popula dados iniciais)"
echo "  3. Execute: make dev      (inicia em modo desenvolvimento)"
echo ""
