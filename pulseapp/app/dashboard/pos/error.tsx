'use client'

import ErrorFallback from '@/components/ui/error-fallback'

export default function PosError({
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
      title="Kasa verileri yüklenemedi"
      description="Kasa verileri getirilirken bir hata oluştu. Lütfen tekrar deneyin."
    />
  )
}
