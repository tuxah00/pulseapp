'use client'

import ErrorFallback from '@/components/ui/error-fallback'

export default function SettingsError({
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
      title="Ayarlar yüklenemedi"
      description="Ayarlar sayfası getirilirken bir hata oluştu. Lütfen tekrar deneyin."
    />
  )
}
