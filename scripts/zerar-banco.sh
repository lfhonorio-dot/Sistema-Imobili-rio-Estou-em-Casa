#!/bin/sh
# ZERA o banco de dados: apaga TODAS as tabelas e TODOS os dados. Não tem volta
# (a não ser restaurando o backup que este script faz antes de apagar).
# Uso normal: pelo zerar-banco.bat (roda dentro de um container postgres).
# Precisa de: DATABASE_URL (endereço do banco) e CONFIRMA="APAGAR TUDO".
# O backup vai para a pasta /backup (no .bat, é a pasta "backups" do projeto).
# Passo a passo completo: docs/ZERAR-BANCO.md
set -e

if [ -z "$DATABASE_URL" ]; then echo "ERRO: endereco do banco nao informado."; exit 1; fi
if [ "$CONFIRMA" != "APAGAR TUDO" ]; then echo "Cancelado: a frase de confirmacao nao confere. Nada foi apagado."; exit 1; fi

BACKUP_DIR="${BACKUP_DIR:-/backup}"
mkdir -p "$BACKUP_DIR"
ARQ="$BACKUP_DIR/backup-antes-de-zerar-$(date +%Y%m%d-%H%M%S).sql.gz"

echo "== [1/4] Conferindo a conexao com o banco..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "SELECT 'conectado em ' || current_database() || ' (' || coalesce(host(inet_server_addr()), 'local') || ')'"

echo "== [2/4] Fazendo backup de seguranca (pode levar alguns minutos)..."
pg_dump "$DATABASE_URL" --no-owner --no-privileges | gzip > "$ARQ"
TAM=$(wc -c < "$ARQ")
if [ "$TAM" -lt 200 ]; then echo "ERRO: o backup saiu vazio ($TAM bytes). Nada foi apagado."; exit 1; fi
gzip -t "$ARQ" || { echo "ERRO: o arquivo de backup esta corrompido. Nada foi apagado."; exit 1; }
echo "   Backup salvo ($TAM bytes): $(basename "$ARQ")"

echo "== [3/4] O que existe hoje no banco:"
psql "$DATABASE_URL" -Atc "SELECT '   imobiliarias: ' || count(*) FROM workspaces" 2>/dev/null || echo "   (banco sem a tabela de imobiliarias - ja esta vazio ou e outro banco)"
psql "$DATABASE_URL" -Atc "SELECT '   usuarios: ' || count(*) FROM users" 2>/dev/null || true
psql "$DATABASE_URL" -Atc "SELECT '   clientes: ' || count(*) FROM contacts" 2>/dev/null || true
psql "$DATABASE_URL" -Atc "SELECT '   contratos: ' || count(*) FROM contracts" 2>/dev/null || true

echo "== [4/4] Apagando tudo..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
SET client_min_messages = warning;
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO PUBLIC;
SQL
RESTO=$(psql "$DATABASE_URL" -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
if [ "$RESTO" != "0" ]; then echo "ERRO: ainda restaram $RESTO tabelas. Envie esta tela ao desenvolvedor."; exit 1; fi

echo ""
echo "BANCO ZERADO. Backup guardado em: $(basename "$ARQ")"
echo "Proximo passo: no Railway, REDEPLOY do backend (ele recria as tabelas sozinho)."
