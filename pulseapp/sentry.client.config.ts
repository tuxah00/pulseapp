import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Üretim ortamında aktif; geliştirmede sessiz
  enabled: process.env.NODE_ENV === 'production',
  // %10 işlem izleme örneklemesi — ücretsiz kota için yeterli
  tracesSampleRate: 0.1,
  // Kullanıcıya gösterilen hata dialog'unu kapat (PWA uyumluluğu)
  beforeSend(event) {
    return event
  },
})
