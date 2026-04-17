import { redirect, notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidUUID } from '@/lib/utils/validate'
import { getPortalSession } from '@/lib/portal/auth'
import { PortalShell } from './_components/portal-shell'

export const dynamic = 'force-dynamic'

const CLINIC_SECTORS = new Set(['dental_clinic', 'medical_aesthetic', 'physiotherapy', 'veterinary'])

interface LayoutProps {
  params: { businessId: string }
  children: React.ReactNode
}

export default async function PortalDashboardLayout({ params, children }: LayoutProps) {
  const { businessId } = params
  if (!isValidUUID(businessId)) notFound()

  const session = getPortalSession()
  if (!session || session.businessId !== businessId) {
    redirect(`/api/portal/logout?businessId=${businessId}`)
  }

  const admin = createAdminClient()

  const [customerRes, businessRes] = await Promise.all([
    admin
      .from('customers')
      .select('id, name, phone, segment, birthday')
      .eq('id', session.customerId)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .single(),
    admin
      .from('businesses')
      .select('id, name, sector, is_active, settings')
      .eq('id', businessId)
      .single(),
  ])

  if (!customerRes.data || !businessRes.data || businessRes.data.is_active === false) {
    redirect(`/api/portal/logout?businessId=${businessId}`)
  }

  const customer = customerRes.data
  const business = businessRes.data
  const showTreatments = CLINIC_SECTORS.has(business.sector || '')
  const logoUrl = (business.settings as { logo_url?: string | null } | null)?.logo_url ?? null
  const rewardsEnabled = (business.settings as { rewards_enabled?: boolean } | null)?.rewards_enabled === true

  return (
    <PortalShell
      businessId={businessId}
      business={{ id: business.id, name: business.name, logo_url: logoUrl, sector: business.sector }}
      customer={{ id: customer.id, name: customer.name, phone: customer.phone, segment: customer.segment }}
      showTreatments={showTreatments}
      rewardsEnabled={rewardsEnabled}
    >
      {children}
    </PortalShell>
  )
}
