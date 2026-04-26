'use client'

import { Check } from 'lucide-react'

/**
 * Kurulum sihirbazı kabuğu — gradient arka plan, üstte step indicator,
 * ortada içerik, altta [Geri] [Daha sonra] [Devam] action bar.
 *
 * `currentStep` 0 = welcome, 1-5 = gerçek adımlar, 6 = completion.
 * Step indicator yalnızca 1-5 arası gösterilir.
 */

export const WIZARD_STEPS = [
  { key: 'services', label: 'Hizmetler' },
  { key: 'staff_tags', label: 'Etiketler' },
  { key: 'packages', label: 'Paketler' },
  { key: 'workflows', label: 'Mesajlar' },
  { key: 'rewards', label: 'Ödüller' },
  { key: 'campaigns', label: 'Kampanyalar' },
] as const

export type WizardStepKey = typeof WIZARD_STEPS[number]['key']

interface WizardShellProps {
  currentStep: number
  showIndicator?: boolean
  showActionBar?: boolean
  onBack?: () => void
  onSkip?: () => void
  onNext?: () => void
  backLabel?: string
  skipLabel?: string
  nextLabel?: string
  nextDisabled?: boolean
  nextLoading?: boolean
  children: React.ReactNode
}

export default function WizardShell({
  currentStep,
  showIndicator = true,
  showActionBar = true,
  onBack,
  onSkip,
  onNext,
  backLabel = 'Geri',
  skipLabel = 'Daha sonra',
  nextLabel = 'Devam',
  nextDisabled = false,
  nextLoading = false,
  children,
}: WizardShellProps) {
  // currentStep: 1-5 arası gerçek adım indeksi
  const showSteps = showIndicator && currentStep >= 1 && currentStep <= WIZARD_STEPS.length

  return (
    <div className="flex min-h-screen flex-col">
      {/* Step indicator (üst) */}
      {showSteps && (
        <div className="px-6 pt-8 pb-4">
          <div className="mx-auto flex max-w-2xl items-center justify-center gap-2">
            {WIZARD_STEPS.map((step, idx) => {
              const stepNum = idx + 1
              const isActive = stepNum === currentStep
              const isDone = stepNum < currentStep
              return (
                <div key={step.key} className="flex items-center gap-2">
                  <div
                    className={[
                      'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300',
                      isActive
                        ? 'scale-110 bg-white text-pulse-900 shadow-lg ring-2 ring-white/40'
                        : isDone
                          ? 'bg-white/90 text-pulse-900'
                          : 'bg-white/20 text-white/70',
                    ].join(' ')}
                  >
                    {isDone ? <Check size={14} strokeWidth={3} /> : stepNum}
                  </div>
                  {idx < WIZARD_STEPS.length - 1 && (
                    <div
                      className={[
                        'h-0.5 w-6 rounded-full transition-colors duration-300 sm:w-10',
                        isDone ? 'bg-white/80' : 'bg-white/20',
                      ].join(' ')}
                    />
                  )}
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-center text-sm text-white/70">
            Adım {currentStep} / {WIZARD_STEPS.length} · {WIZARD_STEPS[currentStep - 1]?.label}
          </p>
        </div>
      )}

      {/* İçerik — key={currentStep} her adım geçişinde remount + slide-in tetikler */}
      <div className="flex flex-1 items-center justify-center px-6 py-8">
        <div key={currentStep} className="animate-wizard-step w-full max-w-3xl">
          {children}
        </div>
      </div>

      {/* Action bar (alt) */}
      {showActionBar && (
        <div className="border-t border-white/10 bg-black/10 backdrop-blur-sm">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
            <button
              type="button"
              onClick={onBack}
              disabled={!onBack}
              className="cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              {backLabel}
            </button>
            <div className="flex items-center gap-3">
              {onSkip && (
                <button
                  type="button"
                  onClick={onSkip}
                  disabled={nextLoading}
                  className="cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white disabled:opacity-50"
                >
                  {skipLabel}
                </button>
              )}
              <button
                type="button"
                onClick={onNext}
                disabled={nextDisabled || nextLoading}
                className="cursor-pointer rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-pulse-900 shadow-lg transition-all hover:bg-white/95 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
              >
                {nextLoading ? 'Kaydediliyor…' : `${nextLabel} →`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
