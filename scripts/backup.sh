#!/bin/bash
# Script de backup do banco de dados PostgreSQL
# Cria dumps comprimidos com timestamp

set -e

# Carrega variáveis de ambiente
if [ -f ".env" ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Configurações
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="${POSTGRES_DB:-plataforma_imobiliaria}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
BACKUP_FILE="${BACKUP_DIR}/backup_${DB_NAME}_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

echo "================================================"
echo "  Backup do Banco de Dados - ${TIMESTAMP}"
echo "================================================"

# Cria diretório de backup se não existir
mkdir -p "${BACKUP_DIR}"

echo "Iniciando backup de '${DB_NAME}'..."
echo "Arquivo: ${BACKUP_FILE}"

# Executa pg_dump comprimido
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --no-owner \
  --no-acl \
  --format=custom \
  | gzip > "${BACKUP_FILE}"

# Verifica tamanho do arquivo
BACKUP_SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
echo "Backup criado com sucesso: ${BACKUP_SIZE}"

# Remove backups antigos
echo "Removendo backups com mais de ${RETENTION_DAYS} dias..."
find "${BACKUP_DIR}" -name "backup_${DB_NAME}_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
echo "Limpeza concluída."

# Lista backups existentes
echo ""
echo "Backups disponíveis:"
ls -lh "${BACKUP_DIR}"/backup_"${DB_NAME}"_*.sql.gz 2>/dev/null || echo "  Nenhum backup encontrado"

echo ""
echo "Backup concluído: ${BACKUP_FILE}"
