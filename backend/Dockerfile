FROM node:20-alpine

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

COPY package*.json ./

# Forçar instalação de devDependencies no build (independente do NODE_ENV do Railway)
ARG NODE_ENV=development
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

RUN chmod +x iniciar.sh

EXPOSE 3000

CMD ["sh", "iniciar.sh"]
