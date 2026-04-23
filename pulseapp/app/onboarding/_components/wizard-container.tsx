'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SectorSeed } from '@/lib/config/sector-seeds'
import type { SectorType } from '@/types'
import WelcomeStep from './welcome-step'
import WizardShell, { WIZARD_STEPS } from './wizard-shell'
import ServicesStep, { type ServiceDraft } from './services-step'
import PackagesStep, { type PackageDraft } from './packages-step'
import WorkflowsStep, { type WorkflowSelection } from './workflows-step'

/**
 * Sihirbaz state makinesi — client component.
 *
 * Step index:
 *  0 = welcome
 *  1-5 = sihirbaz adımları (services, packages, workflows, rewards, campaigns)
 *  6 = completion
 *
 * Her "Devam" tıklamasında ilgili adım kendi commit API'sini çağırır;
 * başarılıysa bir sonraki adıma geçilir. "Daha sonra" commit'siz atlar.
 */

interface WizardContainerProps {
  sector: SectorType
  seed: SectorSeed
  initialStep: number
}

function emitToast(type: 'system' | 'error', title: string, body?: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type, title, body } }))
}

export default function WizardContainer({ seed, initialStep }: WizardContainerProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(() => {
    // Kullanıcı daha önce Adım N'e kadar gelmişse, welcome'ı geç Adım N+1'den başla
    return initialStep > 0 ? Math.min(initialStep + 1, WIZARD_STEPS.length) : 0
  })
  const [skipAllLoading, setSkipAllLoading] = useState(false)
  const [commitLoading, setCommitLoading] = useState(false)

  // Adım 1 state
  const [selectedServices, setSelectedServices] = useState<ServiceDraft[]>([])
  // Adım 2 state
  const [selectedPackages, setSelectedPackages] = useState<PackageDraft[]>([])
  // Adım 3 state
  const [workflowSelection, setWorkflowSelection] = useState<WorkflowSelection | null>(null)

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

  /**
   * Ortak commit akışı: POST → başarı toast → sonraki adım.
   * Hata durumunda: toast göster, adımda kal.
   */
  const commitStep = async (
    endpoint: string,
    payload: Record<string, unknown>,
    successLabel: (inserted: number) => string | null,
    errorTitle: string,
  ) => {
    setCommitLoading(true)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Bilinmeyen hata' }))
        emitToast('error', errorTitle, data.error ?? undefined)
        return
      }
      const data = await res.json()
      const msg = successLabel(data.inserted ?? 0)
      if (msg) emitToast('system', msg)
      goNext()
    } catch {
      emitToast('error', 'Bağlantı hatası', 'Lütfen tekrar deneyin.')
    } finally {
      setCommitLoading(false)
    }
  }

  const commitServicesAndNext = () =>
    commitStep(
      '/api/onboarding/wizard/services',
      { services: selectedServices },
      n => (n > 0 ? `${n} hizmet eklendi` : null),
      'Hizmetler kaydedilemedi',
    )

  const commitPackagesAndNext = () =>
    commitStep(
      '/api/onboarding/wizard/packages',
      { packages: selectedPackages },
      n => (n > 0 ? `${n} paket eklendi` : null),
      'Paketler kaydedilemedi',
    )

  const commitWorkflowsAndNext = () => {
    if (!workflowSelection) {
      goNext()
      return Promise.resolve()
    }
    return commitStep(
      '/api/onboarding/wizard/workflows',
      { ...workflowSelection },
      n => (n > 0 ? `${n} otomatik mesaj etkin` : null),
      'Mesaj ayarları kaydedilemedi',
    )
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

  // Adım 1 — Hizmetler
  if (currentStep === 1) {
    return (
      <WizardShell
        currentStep={1}
        onBack={goBack}
        onSkip={goNext}
        onNext={commitServicesAndNext}
        nextLoading={commitLoading}
      >
        <ServicesStep
          seedServices={seed.services}
          onServicesChange={setSelectedServices}
        />
      </WizardShell>
    )
  }

  // Adım 2 — Paketler
  if (currentStep === 2) {
    return (
      <WizardShell
        currentStep={2}
        onBack={goBack}
        onSkip={goNext}
        onNext={commitPackagesAndNext}
        nextLoading={commitLoading}
      >
        <PackagesStep
          seedPackages={seed.packages}
          onPackagesChange={setSelectedPackages}
        />
      </WizardShell>
    )
  }

  // Adım 3 — Otomatik mesajlar
  if (currentStep === 3) {
    return (
      <WizardShell
        currentStep={3}
        onBack={goBack}
        onSkip={goNext}
        onNext={commitWorkflowsAndNext}
        nextLoading={commitLoading}
      >
        <WorkflowsStep onSelectionChange={setWorkflowSelection} />
      </WizardShell>
    )
  }

  // Adım 4-5 — Placeholder; sonraki alt-sprint'lerde doldurulacak
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
