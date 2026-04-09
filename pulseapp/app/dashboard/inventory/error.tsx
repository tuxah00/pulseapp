'use client'

import ErrorFallback from '@/components/ui/error-fallback'

export default function InventoryError({
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
      title="Sayfa yüklenemedi"
      description="Beklenmeyen bir hata oluştu. Yeniden denemek ister misiniz?"
    />
  )
}
