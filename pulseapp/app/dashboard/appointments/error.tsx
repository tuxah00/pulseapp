'use client'

import ErrorFallback from '@/components/ui/error-fallback'

export default function AppointmentsError({
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
      title="Randevular yüklenemedi"
      description="Randevu listesi getirilirken bir hata oluştu. Lütfen tekrar deneyin."
    />
  )
}
