# Multi-stage build for Next.js
FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

ARG NEXT_PUBLIC_API_BASE_URL=https://api.secureinfiniteassociation.com/api/v1
ARG NEXT_PUBLIC_APP_NAME="Secure Infinite Association"
ARG NEXT_PUBLIC_APP_URL=https://admin.secureinfiniteassociation.com
ARG NEXT_PUBLIC_CHAT_ENGINE_URL=http://localhost:3004

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_CHAT_ENGINE_URL=$NEXT_PUBLIC_CHAT_ENGINE_URL

RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs

EXPOSE 3003

ENV PORT=3003
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
