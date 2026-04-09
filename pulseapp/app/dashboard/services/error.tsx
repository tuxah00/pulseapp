'use client'

import ErrorFallback from '@/components/ui/error-fallback'

export default function ServicesError({
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
      title="Hizmetler yüklenemedi"
      description="Hizmet verileri getirilirken bir hata oluştu. Lütfen tekrar deneyin."
    />
  )
}
