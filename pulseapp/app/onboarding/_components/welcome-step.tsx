'use client'

import { Sparkles } from 'lucide-react'

/**
 * Adım 0 — Karşılama ekranı.
 * İki fade-in başlık + pulsing "Başla" butonu.
 * "Daha sonra yap" linki sağ üstte: sihirbazı atlayıp `wizard_completed = true`
 * yapar ve dashboard'a yönlendirir.
 */

interface WelcomeStepProps {
  onStart: () => void
  onSkipAll: () => void
  skipLoading?: boolean
}

export default function WelcomeStep({ onStart, onSkipAll, skipLoading = false }: WelcomeStepProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6">
      {/* Sağ üst: Daha sonra yap */}
      <button
        type="button"
        onClick={onSkipAll}
        disabled={skipLoading}
        className="absolute right-6 top-6 text-sm text-white/70 transition-colors hover:text-white disabled:opacity-50"
      >
        {skipLoading ? 'Atlanıyor…' : 'Daha sonra yap →'}
      </button>

      {/* Orta içerik */}
      <div className="flex w-full max-w-2xl flex-col items-center text-center">
        <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm animate-welcome-icon">
          <Sparkles size={32} className="text-white" />
        </div>

        <h1 className="animate-welcome-title-1 text-4xl font-bold text-white sm:text-5xl">
          PulseApp kurulumuna hoş geldiniz
        </h1>

        <p className="animate-welcome-title-2 mt-6 text-lg text-blue-100 sm:text-xl">
          İşletmenizin kurulumunu yapalım
        </p>

        <p className="animate-welcome-sub mt-4 max-w-md text-sm text-white/70">
          Sadece birkaç dakika — hizmetlerinizi, paketlerinizi ve otomatik mesajlarınızı
          birlikte ayarlayalım. Her adımı atlayabilir, sonradan dönebilirsiniz.
        </p>

        <button
          type="button"
          onClick={onStart}
          className="animate-welcome-cta mt-12 rounded-xl bg-white px-10 py-4 text-base font-semibold text-pulse-900 shadow-2xl transition-all hover:scale-105 hover:bg-white/95"
        >
          Başla →
        </button>
      </div>
    </div>
  )
}
