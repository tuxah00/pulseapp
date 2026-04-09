'use client'

import ErrorFallback from '@/components/ui/error-fallback'

export default function MembershipsError({
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
      title="Üyelikler yüklenemedi"
      description="Üyelik verileri getirilirken bir hata oluştu. Lütfen tekrar deneyin."
    />
  )
}
