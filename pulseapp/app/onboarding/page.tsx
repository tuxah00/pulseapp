import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolveActiveStaff } from '@/lib/auth/active-business'
import { getSeedForSector } from '@/lib/config/sector-seeds'
import type { BusinessSettings, SectorType } from '@/types'
import WizardContainer from './_components/wizard-container'

/**
 * Kurulum sihirbazı sayfası — server component.
 *
 * Sektöre özel seed verilerini server'da hazırlayıp client container'a geçirir.
 * Guard kontrolleri layout.tsx'te yapıldı; burada yalnızca veri hazırlığı.
 */

export default async function OnboardingWizardPage() {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const result = await resolveActiveStaff(supabase, user.id)
  if (result.status !== 'active' || !result.staffMember) {
    redirect('/dashboard')
  }

  const business = (result.staffMember as unknown as { businesses: { sector?: string; settings?: BusinessSettings | null } }).businesses
  const sector = (business?.sector || 'other') as SectorType
  const initialStep = business?.settings?.wizard_step ?? 0
  const seed = getSeedForSector(sector)

  if (!seed) {
    // Bu yakalama defensive — layout zaten öncelikli sektör guard'ı yapıyor
    redirect('/dashboard')
  }

  return (
    <WizardContainer
      sector={sector}
      seed={seed}
      initialStep={initialStep}
    />
  )
}
