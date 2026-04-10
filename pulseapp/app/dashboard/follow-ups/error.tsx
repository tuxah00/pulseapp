'use client'

import ErrorFallback from '@/components/ui/error-fallback'

export default function FollowUpsError({
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
      title="Sayfa y\u00fcklenemedi"
      description="Beklenmeyen bir hata olu\u015ftu. Yeniden denemek ister misiniz?"
    />
  )
}
