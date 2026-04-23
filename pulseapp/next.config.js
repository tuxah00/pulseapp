const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: true,
  // Build hızını düşürmemek için ESLint build sırasında atlanır; CI'da ayrı koşar.
  eslint: { ignoreDuringBuilds: true },
  // Tip hataları build'i durdurmaya devam etsin — runtime bug'larını yakalar.
  typescript: { ignoreBuildErrors: false },
  // Supabase Storage ve harici CDN'lerden görsel çekilebilsin
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  // Webhook route'ları sunucu-sunucu iletişim kullanır, CORS gerekli değil
  async headers() {
    return []
  },
  // Faz 5: Türkçe → İngilizce route rename geçişinde eski URL'ler
  // bookmarklı kullanıcılar için 308 redirect ile yenisine yönlendirilir.
  async redirects() {
    const map = [
      ['vardiya', 'shifts'],
      ['hizmetler', 'services'],
      ['kasa', 'pos'],
      ['paketler', 'packages'],
      ['personeller', 'staff'],
      ['stoklar', 'inventory'],
      ['denetim', 'audit'],
    ]
    const out = []
    for (const [oldPath, newPath] of map) {
      out.push({ source: `/dashboard/${oldPath}`, destination: `/dashboard/${newPath}`, permanent: true })
      out.push({ source: `/dashboard/${oldPath}/:path*`, destination: `/dashboard/${newPath}/:path*`, permanent: true })
    }
    out.push({ source: '/dashboard/settings/vardiye', destination: '/dashboard/settings/shifts', permanent: true })
    out.push({ source: '/dashboard/settings/vardiye/:path*', destination: '/dashboard/settings/shifts/:path*', permanent: true })
    // ai-actions → assistant-actions
    out.push({ source: '/dashboard/ai-actions', destination: '/dashboard/assistant-actions', permanent: true })
    out.push({ source: '/dashboard/ai-actions/:path*', destination: '/dashboard/assistant-actions/:path*', permanent: true })
    // asistan-aksiyonlari → assistant-actions (geçici Türkçe slug geri alındı)
    out.push({ source: '/dashboard/asistan-aksiyonlari', destination: '/dashboard/assistant-actions', permanent: true })
    return out
  },
}

module.exports = withSentryConfig(nextConfig, {
  // Build loglarını bastır
  silent: true,
  // Kaynak harita yüklemesi SENTRY_AUTH_TOKEN varsa aktif olur
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Üretimde kaynak haritaları istemci paketinden gizle
  hideSourceMaps: true,
  // Sentry CLI log çıktısını bastır
  disableLogger: true,
})
