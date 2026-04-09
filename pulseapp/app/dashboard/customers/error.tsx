'use client'

import ErrorFallback from '@/components/ui/error-fallback'

export default function CustomersError({
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
      title="Müşteriler yüklenemedi"
      description="Müşteri listesi getirilirken bir hata oluştu. Lütfen tekrar deneyin."
    />
  )
}
