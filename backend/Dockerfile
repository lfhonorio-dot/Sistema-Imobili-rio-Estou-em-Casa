FROM node:20-alpine

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

COPY package*.json ./

# Forçar instalação de devDependencies no build (independente do NODE_ENV do Railway)
ARG NODE_ENV=development
RUN npm install --production=false

# cache-bust: 2026-06-20-v2
COPY . .

RUN npx prisma generate
RUN npm run build

RUN chmod +x start.sh

EXPOSE 3000

CMD ["sh", "start.sh"]
