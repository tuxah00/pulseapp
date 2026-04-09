'use client'

import ErrorFallback from '@/components/ui/error-fallback'

export default function StaffError({
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
      title="Personel verileri yüklenemedi"
      description="Personel verileri getirilirken bir hata oluştu. Lütfen tekrar deneyin."
    />
  )
}
