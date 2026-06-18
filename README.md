# Sistema de Controle de Investimentos Pessoais

Sistema completo para controle de patrimônio e investimentos de um investidor de alta renda em fase de aposentadoria.

## Requisitos

- [Docker](https://docs.docker.com/get-docker/) e [Docker Compose](https://docs.docker.com/compose/install/)
- Portas 3000, 3001 e 5432 disponíveis

## Início Rápido

```bash
# 1. Clone e entre no diretório
git clone <repo-url>
cd Sistema-Imobili-rio-Estou-em-Casa

# 2. Copie o arquivo de variáveis de ambiente
cp .env.example .env

# 3. Suba os serviços
docker compose up --build

# 4. Acesse o sistema
# Frontend: http://localhost:3000
# Backend API: http://localhost:3001/api
```

## Credenciais Padrão

| Campo | Valor |
|-------|-------|
| E-mail | `admin@investimentos.local` |
| Senha | `senha123` |

## Módulos

| Módulo | Rota | Descrição |
|--------|------|-----------|
| Dashboard | `/` | KPIs, alocação e alertas |
| Investimentos | `/investimentos` | Renda Fixa, FIIs, Ações, Previdência, COE, Caixa |
| Imóveis | `/imoveis` | Patrimônio imobiliário por classificação |
| Recebíveis | `/recebiveis` | Carteiras de recebíveis imobiliários |
| Fluxo de Caixa | `/fluxo-caixa` | Receitas e despesas mensais |
| Aposentadoria | `/aposentadoria` | Simulação de independência financeira |
| Importação | `/importacao` | Upload de extratos OFX/CSV |
| Relatórios | `/relatorios` | Relatórios consolidados |

## Arquitetura

```
.
├── backend/          # NestJS + TypeScript + Prisma
│   ├── src/
│   │   ├── auth/     # JWT (7 dias), bcrypt
│   │   ├── assets/   # Investimentos financeiros
│   │   ├── properties/   # Imóveis
│   │   ├── receivables/  # Carteiras de recebíveis
│   │   ├── cash-flow/    # Fluxo de caixa pessoal
│   │   ├── retirement/   # Plano de aposentadoria
│   │   ├── dashboard/    # Agregações e alertas
│   │   ├── import/       # OFX/CSV parser
│   │   └── snapshot/     # Histórico patrimonial
│   └── prisma/
│       ├── schema.prisma
│       └── seed.ts   # Dados de exemplo
├── frontend/         # Next.js 14 App Router
│   ├── app/
│   │   ├── (auth)/login/
│   │   └── (dashboard)/  # Todas as páginas protegidas
│   ├── components/Layout.tsx
│   └── lib/api.ts    # Client HTTP + utilitários
└── docker-compose.yml
```

## Dados de Seed

O sistema vem pré-carregado com dados representativos:

- **6 ativos de Renda Fixa** (CDB, LCI, LCA, Debenture, CRI, CRA)
- **5 FIIs** (MXRF11, HGLG11, VISC11, XPML11, KNRI11)
- **3 Ações** (ITUB4, WEGE3, PETR4)
- **1 Previdência Privada**
- **2 Caixas** (Conta Corrente, Reserva)
- **11 Imóveis** (Hisa, Sítio Rifaina, galpão, terrenos, etc.)
- **2 Carteiras de Recebíveis** (Quinta dos Nobres ~R$9M, Reserva de Santa Rita ~R$2.5M)
- **Plano de aposentadoria** configurado
- **Histórico** de 6 meses de recebíveis e 3 meses de fluxo de caixa

## Comandos Úteis

```bash
# Reconstruir sem cache
docker compose build --no-cache && docker compose up

# Re-executar seed (limpa e recarrega dados)
docker compose exec backend npx prisma db seed

# Ver logs do backend
docker compose logs -f backend

# Acessar banco de dados
docker compose exec postgres psql -U postgres -d investimentos
```

## Stack Técnica

- **Backend**: NestJS 10, TypeScript, Prisma ORM 5, PostgreSQL 16
- **Frontend**: Next.js 14 App Router, React 18, Recharts, TypeScript
- **Auth**: JWT com Bearer token (7 dias)
- **Estilo**: CSS custom properties, tema navy escuro (#0D1B2A) + dourado (#C9A227)
