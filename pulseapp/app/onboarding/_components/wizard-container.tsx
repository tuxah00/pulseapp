'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SectorSeed } from '@/lib/config/sector-seeds'
import type { SectorType } from '@/types'
import WelcomeStep from './welcome-step'
import WizardShell, { WIZARD_STEPS } from './wizard-shell'
import ServicesStep, { type ServiceDraft } from './services-step'
import StaffTagsStep from './staff-tags-step'
import PackagesStep, { type PackageDraft } from './packages-step'
import WorkflowsStep, { type WorkflowSelection } from './workflows-step'
import RewardsStep, { type RewardDraft } from './rewards-step'
import CampaignsStep, { type CampaignDraft } from './campaigns-step'
import CompletionStep from './completion-step'

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

const STEP_INDEX = {
  WELCOME: 0,
  SERVICES: 1,
  STAFF_TAGS: 2,
  PACKAGES: 3,
  WORKFLOWS: 4,
  REWARDS: 5,
  CAMPAIGNS: 6,
  COMPLETION: 7,
} as const

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
  // Adım 2 state — personel etiket havuzu (sektör default'u ile başlar)
  const [selectedStaffTags, setSelectedStaffTags] = useState<string[]>(seed.staff_tags)
  // Adım 3 state
  const [selectedPackages, setSelectedPackages] = useState<PackageDraft[]>([])
  // Adım 4 state
  const [workflowSelection, setWorkflowSelection] = useState<WorkflowSelection | null>(null)
  // Adım 5 state
  const [rewardsEnabled, setRewardsEnabled] = useState(false)
  const [selectedRewards, setSelectedRewards] = useState<RewardDraft[]>([])
  // Adım 6 state
  const [selectedCampaigns, setSelectedCampaigns] = useState<CampaignDraft[]>([])
  // Tamamlama özeti — her commit başarısı bu nesneye yazar
  const [summary, setSummary] = useState({
    services: 0,
    staff_tags: 0,
    packages: 0,
    workflows: 0,
    rewards: 0,
    campaigns: 0,
  })

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
    summaryKey?: keyof typeof summary,
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
      const inserted = data.inserted ?? 0
      if (summaryKey) {
        setSummary(prev => ({ ...prev, [summaryKey]: inserted }))
      }
      const msg = successLabel(inserted)
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
      'services',
    )

  const commitStaffTagsAndNext = () =>
    commitStep(
      '/api/onboarding/wizard/staff-tags',
      { tags: selectedStaffTags },
      n => (n > 0 ? `${n} etiket kaydedildi` : null),
      'Etiketler kaydedilemedi',
      'staff_tags',
    )

  const commitPackagesAndNext = () =>
    commitStep(
      '/api/onboarding/wizard/packages',
      { packages: selectedPackages },
      n => (n > 0 ? `${n} paket eklendi` : null),
      'Paketler kaydedilemedi',
      'packages',
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
      'workflows',
    )
  }

  const commitRewardsAndNext = () =>
    commitStep(
      '/api/onboarding/wizard/rewards',
      { enabled: rewardsEnabled, rewards: selectedRewards },
      n => (n > 0 ? `${n} ödül şablonu eklendi` : null),
      'Ödüller kaydedilemedi',
      'rewards',
    )

  const handleRewardsChange = (enabled: boolean, rewards: RewardDraft[]) => {
    setRewardsEnabled(enabled)
    setSelectedRewards(rewards)
  }

  const commitCampaignsAndNext = () =>
    commitStep(
      '/api/onboarding/wizard/campaigns',
      { campaigns: selectedCampaigns },
      n => (n > 0 ? `${n} taslak kampanya eklendi` : null),
      'Kampanyalar kaydedilemedi',
      'campaigns',
    )

  // Adım 0 — Karşılama
  if (currentStep === STEP_INDEX.WELCOME) {
    return (
      <WelcomeStep
        onStart={goNext}
        onSkipAll={markCompleteAndExit}
        skipLoading={skipAllLoading}
      />
    )
  }

  // Adım 1 — Hizmetler
  if (currentStep === STEP_INDEX.SERVICES) {
    return (
      <WizardShell
        currentStep={STEP_INDEX.SERVICES}
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

  // Adım 2 — Personel Etiketleri
  if (currentStep === STEP_INDEX.STAFF_TAGS) {
    return (
      <WizardShell
        currentStep={STEP_INDEX.STAFF_TAGS}
        onBack={goBack}
        onSkip={goNext}
        onNext={commitStaffTagsAndNext}
        nextLoading={commitLoading}
      >
        <StaffTagsStep
          seedTags={seed.staff_tags}
          onTagsChange={setSelectedStaffTags}
        />
      </WizardShell>
    )
  }

  // Adım 3 — Paketler
  if (currentStep === STEP_INDEX.PACKAGES) {
    return (
      <WizardShell
        currentStep={STEP_INDEX.PACKAGES}
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

  // Adım 4 — Otomatik mesajlar
  if (currentStep === STEP_INDEX.WORKFLOWS) {
    return (
      <WizardShell
        currentStep={STEP_INDEX.WORKFLOWS}
        onBack={goBack}
        onSkip={goNext}
        onNext={commitWorkflowsAndNext}
        nextLoading={commitLoading}
      >
        <WorkflowsStep onSelectionChange={setWorkflowSelection} />
      </WizardShell>
    )
  }

  // Adım 5 — Ödüller
  if (currentStep === STEP_INDEX.REWARDS) {
    return (
      <WizardShell
        currentStep={STEP_INDEX.REWARDS}
        onBack={goBack}
        onSkip={goNext}
        onNext={commitRewardsAndNext}
        nextLoading={commitLoading}
      >
        <RewardsStep
          seedRewards={seed.rewards}
          onSelectionChange={handleRewardsChange}
        />
      </WizardShell>
    )
  }

  // Adım 6 — Kampanyalar
  if (currentStep === STEP_INDEX.CAMPAIGNS) {
    return (
      <WizardShell
        currentStep={STEP_INDEX.CAMPAIGNS}
        onBack={goBack}
        onSkip={goNext}
        onNext={commitCampaignsAndNext}
        nextLoading={commitLoading}
      >
        <CampaignsStep
          seedCampaigns={seed.campaigns}
          onCampaignsChange={setSelectedCampaigns}
        />
      </WizardShell>
    )
  }

  // Adım 6 — Tamamlama: konfeti + özet + dashboard'a git
  return (
    <WizardShell currentStep={currentStep} showIndicator={false} showActionBar={false}>
      <CompletionStep
        summary={summary}
        onFinish={markCompleteAndExit}
        finishLoading={skipAllLoading}
      />
    </WizardShell>
  )
}
