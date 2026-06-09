#!/bin/bash
# Script de restauração do banco de dados PostgreSQL
# Restaura a partir de um arquivo de backup comprimido

set -e

# Carrega variáveis de ambiente
if [ -f ".env" ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Configurações
DB_NAME="${POSTGRES_DB:-plataforma_imobiliaria}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"

echo "================================================"
echo "  Restauração do Banco de Dados"
echo "================================================"

# Verifica se foi passado o arquivo de backup como argumento
if [ -z "$1" ]; then
  echo "Uso: $0 <arquivo_de_backup.sql.gz>"
  echo ""
  echo "Backups disponíveis:"
  ls -lh ./backups/backup_"${DB_NAME}"_*.sql.gz 2>/dev/null || echo "  Nenhum backup encontrado"
  exit 1
fi

BACKUP_FILE="$1"

# Verifica se o arquivo existe
if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERRO: Arquivo de backup não encontrado: ${BACKUP_FILE}"
  exit 1
fi

echo "Arquivo de backup: ${BACKUP_FILE}"
echo "Banco de dados: ${DB_NAME}"
echo ""
echo "ATENÇÃO: Esta operação substituirá TODOS os dados atuais do banco!"
read -p "Tem certeza? Digite 'restaurar' para confirmar: " confirm

if [ "${confirm}" != "restaurar" ]; then
  echo "Restauração cancelada."
  exit 0
fi

echo ""
echo "Iniciando restauração..."

# Restaura o banco de dados
gunzip -c "${BACKUP_FILE}" | PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists

echo ""
echo "Restauração concluída com sucesso!"
echo "Banco '${DB_NAME}' restaurado a partir de: ${BACKUP_FILE}"
