import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolveActiveStaff } from '@/lib/auth/active-business'
import type { BusinessSettings, SectorType } from '@/types'

/**
 * Kurulum sihirbazı route'u — yalnızca `medical_aesthetic` ve `dental_clinic`
 * sektörleri için aktif. Diğer sektörler dashboard'daki mevcut OnboardingForm
 * modal'ına yönlendirilir.
 *
 * Guard akışı:
 *  1. Oturum yoksa → `/auth/login`
 *  2. Personel kaydı yoksa → dashboard'daki onboarding modal'a yönlen
 *  3. Çoklu işletme seçilmemişse → `/auth/select-business`
 *  4. Sektör öncelikli iki sektör DEĞİLSE → `/dashboard`
 *  5. `wizard_completed = true` ise → `/dashboard`
 */

const PRIORITY_SECTORS: SectorType[] = ['medical_aesthetic', 'dental_clinic']

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const result = await resolveActiveStaff(supabase, user.id)

  if (result.status === 'needs_onboarding') {
    // Wizard için bile önce temel işletme kaydı şart (create_business_for_user RPC)
    // Bu yüzden önce dashboard onboarding modal'ından geçsin; oradaki form bitince
    // sektör `medical_aesthetic | dental_clinic` ise `/onboarding`'a yönlendirilecek
    redirect('/dashboard')
  }

  if (result.status === 'needs_selection') {
    redirect('/auth/select-business')
  }

  const staffMember = result.staffMember!
  const business = (staffMember as unknown as { businesses: { sector?: string; settings?: BusinessSettings | null } }).businesses
  const sector = (business?.sector || 'other') as SectorType
  const settings = business?.settings ?? null

  // Öncelikli sektör değilse — sihirbaz yok, dashboard'a
  if (!PRIORITY_SECTORS.includes(sector)) {
    redirect('/dashboard')
  }

  // Zaten tamamlanmışsa — dashboard
  if (settings?.wizard_completed === true) {
    redirect('/dashboard')
  }

  return (
    <div className="public-page min-h-screen cursor-default bg-gradient-to-br from-pulse-900 via-pulse-800 to-pulse-700">
      {children}
    </div>
  )
}
