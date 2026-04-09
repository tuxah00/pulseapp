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
      title="Stok verileri yüklenemedi"
      description="Stok bilgileri getirilirken bir hata oluştu. Lütfen tekrar deneyin."
    />
  )
}
