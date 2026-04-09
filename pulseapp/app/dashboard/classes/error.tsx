'use client'

import ErrorFallback from '@/components/ui/error-fallback'

export default function ClassesError({
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
      title="Sınıf programı yüklenemedi"
      description="Sınıf verileri getirilirken bir hata oluştu. Lütfen tekrar deneyin."
    />
  )
}
