'use client'

import ErrorFallback from '@/components/ui/error-fallback'

export default function AuditError({
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
      title="Denetim verileri yüklenemedi"
      description="Denetim kayıtları getirilirken bir hata oluştu. Lütfen tekrar deneyin."
    />
  )
}
