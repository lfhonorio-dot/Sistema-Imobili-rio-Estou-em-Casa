# Dockerfile do backend NestJS
# Estágios: base, development, builder, production

FROM node:20-alpine AS base

# Instala dependências do sistema necessárias
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copia arquivos de dependências
COPY package*.json ./
COPY prisma ./prisma/

# -----------------------------------------------
# Estágio de desenvolvimento
# -----------------------------------------------
FROM base AS development

# Instala todas as dependências (incluindo devDependencies)
RUN npm ci

# Gera o cliente Prisma
RUN npx prisma generate

# Copia o código fonte
COPY . .

EXPOSE 3001

CMD ["npm", "run", "start:dev"]

# -----------------------------------------------
# Estágio de build para produção
# -----------------------------------------------
FROM base AS builder

RUN npm ci

COPY . .

# Gera cliente Prisma e compila TypeScript
RUN npx prisma generate
RUN npm run build

# -----------------------------------------------
# Estágio de produção (imagem final mínima)
# -----------------------------------------------
FROM node:20-alpine AS production

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Instala apenas dependências de produção
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copia arquivos compilados do builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma/

# Copia script de inicialização
COPY start.sh ./start.sh
RUN chmod +x start.sh

# Usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
USER nestjs

EXPOSE 3001

CMD ["sh", "start.sh"]
