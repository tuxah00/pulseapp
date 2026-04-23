/**
 * Tüm Sentry config dosyaları (client / server / edge) bu temel yapılandırmayı paylaşır.
 * Her ortam dosyası bu nesneyi spread ederek ortama özgü seçenekleri ekler.
 */
export const SENTRY_BASE_CONFIG = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Yalnızca production'da aktif — geliştirme ortamında hata gönderilmez
  enabled: process.env.NODE_ENV === 'production',
  // %10 işlem izleme örneklemesi — ücretsiz kota (5K event/ay) için yeterli
  tracesSampleRate: 0.1,
} as const
