import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import OnboardingForm from '@/components/dashboard/onboarding-form'
import DashboardShell from '@/components/dashboard/dashboard-shell'
import { BusinessProvider } from '@/lib/hooks/business-context-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { ConfirmProvider } from '@/lib/hooks/use-confirm'
import { getEffectivePermissions, getEffectiveWritePermissions, type StaffRole, type SectorType, type PlanType } from '@/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: staffMember, error: staffError } = await supabase
    .from('staff_members')
    .select('*, businesses(*)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!staffMember || staffError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pulse-50 via-white to-pulse-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-pulse-900">
              Pulse<span className="text-gray-900 dark:text-white">App</span>
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Hoş geldiniz! İşletmenizi tanımlayarak başlayın.
            </p>
          </div>
          <OnboardingForm userId={user.id} userEmail={user.email || ''} userName={user.user_metadata?.full_name || ''} />
        </div>
      </div>
    )
  }

  const business = (staffMember as unknown as { businesses: { name?: string; sector?: string; subscription_plan?: string } }).businesses
  const userName = staffMember.name || user.user_metadata?.full_name || user.email || 'Kullanıcı'
  const businessName = business?.name || 'İşletme'
  const sector = (business?.sector || 'other') as SectorType
  const plan = (business?.subscription_plan || 'starter') as PlanType
  const staffRole = (staffMember.role || 'staff') as StaffRole
  const permissions = getEffectivePermissions(staffRole, staffMember.permissions)
  const writePermissions = getEffectiveWritePermissions(staffRole, (staffMember as any).write_permissions ?? null)

  return (
    <ThemeProvider>
      <DashboardShell
        businessName={businessName}
        userName={userName}
        sector={sector}
        plan={plan}
        permissions={permissions}
      >
        <BusinessProvider value={{
          businessId: staffMember.business_id,
          userId: user.id,
          staffId: staffMember.id,
          staffName: staffMember.name || userName,
          sector,
          plan,
          businessName,
          staffRole,
          permissions,
          writePermissions,
        }}>
          <ConfirmProvider>
            {children}
          </ConfirmProvider>
        </BusinessProvider>
      </DashboardShell>
    </ThemeProvider>
  )
}
