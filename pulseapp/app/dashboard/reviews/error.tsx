'use client'

import ErrorFallback from '@/components/ui/error-fallback'

export default function ReviewsError({
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
      title="Yorumlar yüklenemedi"
      description="Yorum verileri getirilirken bir hata oluştu. Lütfen tekrar deneyin."
    />
  )
}
