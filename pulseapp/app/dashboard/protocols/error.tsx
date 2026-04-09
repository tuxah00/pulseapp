'use client'

import ErrorFallback from '@/components/ui/error-fallback'

export default function ProtocolsError({
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
      title="Protokoller yüklenemedi"
      description="Tedavi protokolleri getirilirken bir hata oluştu. Lütfen tekrar deneyin."
    />
  )
}
