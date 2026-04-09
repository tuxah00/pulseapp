'use client'

import ErrorFallback from '@/components/ui/error-fallback'

export default function PackagesError({
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
      title="Paketler yüklenemedi"
      description="Paket verileri getirilirken bir hata oluştu. Lütfen tekrar deneyin."
    />
  )
}
