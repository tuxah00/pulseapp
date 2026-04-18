import { redirect, notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidUUID } from '@/lib/utils/validate'

export const dynamic = 'force-dynamic'

interface LayoutProps {
  params: { businessId: string }
  children: React.ReactNode
}

/**
 * Portal rewards rotası, işletme ödüller özelliğini kapatmışsa
 * doğrudan URL üzerinden erişilmesin diye burada engellenir.
 * Kapalıysa portal ana sayfasına yönlendirir.
 */
export default async function PortalRewardsGuard({ params, children }: LayoutProps) {
  const { businessId } = params
  if (!isValidUUID(businessId)) notFound()

  const admin = createAdminClient()
  const { data: business } = await admin
    .from('businesses')
    .select('settings')
    .eq('id', businessId)
    .single()

  const enabled = (business?.settings as { rewards_enabled?: boolean } | null)?.rewards_enabled === true
  if (!enabled) {
    redirect(`/portal/${businessId}/dashboard`)
  }

  return <>{children}</>
}
