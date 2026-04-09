'use client'

import ErrorFallback from '@/components/ui/error-fallback'

export default function ReservationsError({
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
      title="Rezervasyonlar yüklenemedi"
      description="Rezervasyon verileri getirilirken bir hata oluştu. Lütfen tekrar deneyin."
    />
  )
}
