# Dockerfile do frontend Next.js
# Estágios: deps, development, builder, production

FROM node:20-alpine AS base

RUN apk add --no-cache libc6-compat
WORKDIR /app

# -----------------------------------------------
# Estágio de dependências
# -----------------------------------------------
FROM base AS deps

COPY package*.json ./
RUN npm ci

# -----------------------------------------------
# Estágio de desenvolvimento
# -----------------------------------------------
FROM base AS development

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "run", "dev"]

# -----------------------------------------------
# Estágio de build
# -----------------------------------------------
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variáveis de ambiente para o build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME

RUN npm run build

# -----------------------------------------------
# Estágio de produção (standalone output)
# -----------------------------------------------
FROM node:20-alpine AS production

RUN apk add --no-cache libc6-compat

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Usuário não-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copia arquivos do build standalone
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
