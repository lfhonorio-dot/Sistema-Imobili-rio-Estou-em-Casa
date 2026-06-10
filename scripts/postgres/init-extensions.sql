-- Extensões necessárias para a plataforma imobiliária
-- Executado automaticamente pelo PostgreSQL na primeira inicialização

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Extensão vector para busca semântica (Etapa 9 - Agentes de IA)
-- Requer pgvector instalado na imagem. Se não disponível, comentar a linha abaixo.
-- CREATE EXTENSION IF NOT EXISTS "vector";
