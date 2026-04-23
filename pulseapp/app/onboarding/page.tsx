'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import WelcomeStep from './_components/welcome-step'
import WizardShell, { WIZARD_STEPS } from './_components/wizard-shell'

/**
 * Kurulum sihirbazı ana sayfası — client-side state makinesi.
 *
 * Step index:
 *  0 = welcome
 *  1-5 = sihirbaz adımları (services, packages, workflows, rewards, campaigns)
 *  6 = completion
 *
 * Her adım DB commit'ini `/api/onboarding/wizard/*` endpoint'leri üzerinden
 * kendi içinde halleder; bu page sadece navigasyonu yönetir.
 *
 * Adım içerikleri sonraki alt-sprint'lerde dolacak — şu an iskelet + welcome var.
 */

export default function OnboardingWizardPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [skipAllLoading, setSkipAllLoading] = useState(false)

  const markCompleteAndExit = async () => {
    setSkipAllLoading(true)
    try {
      await fetch('/api/onboarding/wizard/complete', { method: 'POST' })
    } catch {
      // sessiz — yönlendirme yine yapılsın
    }
    router.push('/dashboard')
  }

  const goNext = () => {
    setCurrentStep(s => Math.min(s + 1, WIZARD_STEPS.length + 1))
  }

  const goBack = () => {
    setCurrentStep(s => Math.max(s - 1, 0))
  }

  // Adım 0 — Karşılama
  if (currentStep === 0) {
    return (
      <WelcomeStep
        onStart={goNext}
        onSkipAll={markCompleteAndExit}
        skipLoading={skipAllLoading}
      />
    )
  }

  // Adım 1-5 — Şimdilik placeholder; sonraki alt-sprint'lerde doldurulacak
  return (
    <WizardShell
      currentStep={currentStep}
      onBack={goBack}
      onSkip={goNext}
      onNext={goNext}
    >
      <div className="rounded-2xl bg-white/10 p-8 text-center backdrop-blur-sm">
        <h2 className="text-2xl font-semibold text-white">
          {WIZARD_STEPS[currentStep - 1]?.label}
        </h2>
        <p className="mt-2 text-white/70">
          Bu adımın içeriği sonraki alt-sprint&apos;te eklenecek.
        </p>
      </div>
    </WizardShell>
  )
}
