FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npx prisma generate
EXPOSE 3001
# A cada inicialização, garante dependências e banco em dia (auto-correção):
# instala pacotes novos, regenera o Prisma Client e aplica migrações pendentes
# antes de subir. Evita "Failed to fetch" após atualizações do código.
CMD sh -c "npm install --legacy-peer-deps && npx prisma generate && npx prisma migrate deploy && npm run start:dev"
