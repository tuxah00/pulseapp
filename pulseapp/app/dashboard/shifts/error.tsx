'use client'

import ErrorFallback from '@/components/ui/error-fallback'

export default function ShiftsError({
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
      title="Vardiya verileri yüklenemedi"
      description="Vardiya verileri getirilirken bir hata oluştu. Lütfen tekrar deneyin."
    />
  )
}
