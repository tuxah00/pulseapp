/** @type {import('next').NextConfig} */
const nextConfig = {
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
    return out
  },
}

module.exports = nextConfig
