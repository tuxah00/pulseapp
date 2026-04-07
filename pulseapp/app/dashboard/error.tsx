'use client'

import ErrorFallback from '@/components/ui/error-fallback'

export default function DashboardError({
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
      title="Panel yüklenemedi"
      description="Dashboard'da beklenmeyen bir hata oluştu. Yeniden denemek ister misiniz?"
    />
  )
}
