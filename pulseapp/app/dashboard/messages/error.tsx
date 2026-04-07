'use client'

import ErrorFallback from '@/components/ui/error-fallback'

export default function MessagesError({
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
      title="Mesajlar yüklenemedi"
      description="Mesaj kutusu getirilirken bir hata oluştu. Lütfen tekrar deneyin."
    />
  )
}
