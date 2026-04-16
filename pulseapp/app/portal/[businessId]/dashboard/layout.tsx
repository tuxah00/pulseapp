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
    redirect(`/portal/${businessId}`)
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
      .select('id, name, logo_url, sector, is_active')
      .eq('id', businessId)
      .single(),
  ])

  if (!customerRes.data || !businessRes.data || businessRes.data.is_active === false) {
    // Oturum geçersiz — çıkışa yönlendir
    redirect(`/portal/${businessId}`)
  }

  const customer = customerRes.data
  const business = businessRes.data
  const showTreatments = CLINIC_SECTORS.has(business.sector || '')

  return (
    <PortalShell
      businessId={businessId}
      business={{ id: business.id, name: business.name, logo_url: business.logo_url, sector: business.sector }}
      customer={{ id: customer.id, name: customer.name, phone: customer.phone, segment: customer.segment }}
      showTreatments={showTreatments}
    >
      {children}
    </PortalShell>
  )
}
