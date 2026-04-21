# syntax=docker/dockerfile:1.6
# Coolify + Hetzner için optimize edilmiş Next.js 14 (standalone) Dockerfile
# 3 aşamalı multi-stage build — final image yalnızca runtime dosyalarını içerir (~150MB)

########################################
# Stage 1 — bağımlılıklar (cache katmanı)
########################################
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Sadece package dosyalarını kopyala → kod değişikliği bu katmanı invalidate etmesin
COPY package.json package-lock.json ./
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false
# npm install — lockfile'daki cross-platform version mismatch'leri tolere eder.
# npm ci daha sıkı ama Docker alpine/local npm version farkları EUSAGE hatası veriyor.
RUN npm install --no-audit --prefer-offline

########################################
# Stage 2 — build
########################################
FROM node:20-alpine AS builder
WORKDIR /app

# Deps katmanını yeniden kullan
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js telemetrisi kapalı → build sırasında dış network çağrısı yok
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# NEXT_PUBLIC_* env'ler build-time'da gömülür. Coolify bunları
# "Build Variables" olarak geçtiğinde burada ARG/ENV olarak okunabilir.
# (Coolify otomatik geçiyor — manuel ARG gerekmez)

RUN npm run build

########################################
# Stage 3 — runtime (ince image)
########################################
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# root olmayan kullanıcı — güvenlik
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Standalone çıktı: kendi minimum node_modules'ü + server.js'i
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# NOT: public/ klasörü yok; varsa bile standalone'a next build tarafından kopyalanır

USER nextjs
EXPOSE 3000

# Health check — /api/health'e 30 saniyede bir istek
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
