# syntax=docker/dockerfile:1.6
# Coolify + Hetzner için optimize edilmiş Next.js 14 (standalone) Dockerfile
# 3 aşamalı multi-stage build + BuildKit cache mount'lar
#
# Deploy süresi hedefi:
#   - Cold build (ilk defa):    ~6-10 dk
#   - Warm build (cache dolu):  ~60-90 sn  (npm cache + .next/cache persist)

########################################
# Stage 1 — bağımlılıklar (cache katmanı)
########################################
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Sadece package dosyalarını kopyala → kod değişikliği bu katmanı invalidate etmesin
COPY --link package.json package-lock.json ./

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false

# BuildKit cache mount: /root/.npm persist → sonraki build'lerde paketler
# internet'ten değil cache'den gelir. npm install süresi 70s → ~15s'e düşer.
RUN --mount=type=cache,target=/root/.npm \
    npm install --no-audit --prefer-offline

########################################
# Stage 2 — build
########################################
FROM node:20-alpine AS builder
WORKDIR /app

# Deps katmanını yeniden kullan
COPY --from=deps --link /app/node_modules ./node_modules
COPY --link . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# BuildKit cache mount: .next/cache persist → Next.js incremental build.
# next build süresi 460s → koddaki değişiklik boyutuna göre 60-180s'e düşer.
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

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
COPY --from=builder --chown=nextjs:nodejs --link /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs --link /app/.next/static ./.next/static
# NOT: public/ klasörü yok; varsa bile standalone'a next build tarafından kopyalanır

USER nextjs
EXPOSE 3000

# Coolify rolling update '.State.Health.Status' alanını bekliyor — bu yüzden
# Dockerfile-level HEALTHCHECK zorunlu. Çok esnek ayarlandı:
# - 180s start period (container boot + Next.js ready)
# - 10 retries (toplam tolerans ~5 dk)
HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=10 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
