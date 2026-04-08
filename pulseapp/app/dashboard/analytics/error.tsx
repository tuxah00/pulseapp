'use client'

import ErrorFallback from '@/components/ui/error-fallback'

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorFallback
      error={error}
      reset={reset}
      title="Analitik veriler yüklenemedi"
      description="Gelir-gider tablosu getirilirken bir hata oluştu. Lütfen tekrar deneyin."
    />
  )
}
