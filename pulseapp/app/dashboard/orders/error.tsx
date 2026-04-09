'use client'

import ErrorFallback from '@/components/ui/error-fallback'

export default function OrdersError({
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
      title="Siparişler yüklenemedi"
      description="Sipariş verileri getirilirken bir hata oluştu. Lütfen tekrar deneyin."
    />
  )
}
