FROM node:20-alpine AS base
WORKDIR /app

# pg_dump for daily DB backup job (client major should match Postgres 16 server)
RUN apk add --no-cache curl ca-certificates openssl libc6-compat postgresql16-client \
  || apk add --no-cache curl ca-certificates openssl libc6-compat postgresql-client

COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN npm ci --omit=dev || npm i --omit=dev

COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma
COPY scripts ./scripts

RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-lc", "(npx prisma db push --skip-generate --accept-data-loss || echo 'Prisma db push skipped') && npx tsx src/server.ts"]
