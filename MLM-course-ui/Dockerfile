# Multi-stage build for Next.js (Alpine / musl)
FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci
RUN npm install @next/swc-linux-x64-musl --save-optional --legacy-peer-deps || true

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

ARG NEXT_PUBLIC_API_BASE_URL=https://api.secureinfiniteassociation.com/api/v1
ARG NEXT_PUBLIC_APP_NAME="Secure Infinite Association"
ARG NEXT_PUBLIC_APP_URL=https://app.secureinfiniteassociation.com

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
RUN mkdir -p ./public

USER nextjs

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
