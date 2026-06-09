# =============================================
# Makefile - Plataforma Imobiliária Estou em Casa
# =============================================

.PHONY: help dev build test migrate seed setup backup restore clean logs

# Exibe ajuda com todos os comandos disponíveis
help:
	@echo "Plataforma Imobiliária - Comandos disponíveis:"
	@echo ""
	@echo "  make setup       - Configuração inicial completa do ambiente"
	@echo "  make dev         - Inicia ambiente de desenvolvimento"
	@echo "  make build       - Constrói as imagens Docker"
	@echo "  make test        - Executa todos os testes"
	@echo "  make migrate     - Executa migrações do banco de dados"
	@echo "  make seed        - Popula banco com dados iniciais"
	@echo "  make backup      - Realiza backup do banco de dados"
	@echo "  make restore     - Restaura backup do banco de dados"
	@echo "  make logs        - Exibe logs dos serviços"
	@echo "  make clean       - Remove containers e volumes"
	@echo ""

# Configuração inicial do ambiente
setup:
	@echo "Iniciando configuração do ambiente..."
	@bash scripts/setup.sh

# Inicia o ambiente de desenvolvimento
dev:
	@echo "Iniciando ambiente de desenvolvimento..."
	docker-compose up -d postgres redis minio
	@echo "Aguardando serviços ficarem prontos..."
	@sleep 5
	@$(MAKE) migrate
	docker-compose up backend frontend nginx

# Constrói as imagens Docker
build:
	@echo "Construindo imagens Docker..."
	docker-compose build --no-cache

# Executa todos os testes
test:
	@echo "Executando testes do backend..."
	cd backend && npm run test
	@echo "Executando testes do frontend..."
	cd frontend && npm run test

# Executa migrações do banco de dados
migrate:
	@echo "Executando migrações do banco de dados..."
	@bash scripts/migrate.sh

# Popula banco com dados iniciais
seed:
	@echo "Populando banco de dados com dados iniciais..."
	@bash scripts/seed.sh

# Realiza backup do banco de dados
backup:
	@echo "Realizando backup do banco de dados..."
	@bash scripts/backup.sh

# Restaura backup do banco de dados
restore:
	@echo "Restaurando backup do banco de dados..."
	@bash scripts/restore.sh

# Exibe logs dos serviços
logs:
	docker-compose logs -f

# Para e remove containers
stop:
	docker-compose down

# Remove containers, volumes e imagens
clean:
	@echo "Removendo todos os containers, volumes e imagens..."
	docker-compose down -v --rmi local
	@echo "Limpeza concluída."

# Abre shell no container do backend
shell-backend:
	docker-compose exec backend sh

# Abre shell no container do postgres
shell-db:
	docker-compose exec postgres psql -U $${POSTGRES_USER:-postgres} -d $${POSTGRES_DB:-plataforma_imobiliaria}
