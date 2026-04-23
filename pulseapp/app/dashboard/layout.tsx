import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import OnboardingForm from '@/components/dashboard/onboarding-form'
import DashboardShell from '@/components/dashboard/dashboard-shell'
import { BusinessProvider } from '@/lib/hooks/business-context-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { ConfirmProvider } from '@/lib/hooks/use-confirm'
import { resolveActiveStaff } from '@/lib/auth/active-business'
import SignOutLink from '@/components/auth/sign-out-link'
import SessionWatcher from '@/components/auth/session-watcher'
import { getEffectivePermissions, getEffectiveWritePermissions, type StaffRole, type SectorType, type PlanType, type BusinessSettings } from '@/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const result = await resolveActiveStaff(supabase, user.id)

  if (result.status === 'needs_selection') {
    redirect('/auth/select-business')
  }

  if (result.status === 'needs_onboarding') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
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
          <div className="mt-6 text-center">
            <SignOutLink />
          </div>
        </div>
      </div>
    )
  }

  const staffMember = result.staffMember!
  const business = (staffMember as unknown as { businesses: { name?: string; sector?: string; subscription_plan?: string; settings?: BusinessSettings | null } }).businesses
  const userName = staffMember.name || user.user_metadata?.full_name || user.email || 'Kullanıcı'
  const businessName = business?.name || 'İşletme'
  const sector = (business?.sector || 'other') as SectorType
  const plan = (business?.subscription_plan || 'starter') as PlanType
  const staffRole = (staffMember.role || 'staff') as StaffRole
  const permissions = getEffectivePermissions(staffRole, staffMember.permissions)
  const writePermissions = getEffectiveWritePermissions(staffRole, (staffMember as any).write_permissions ?? null)
  const settings: BusinessSettings | null = business?.settings ?? null

  return (
    <ThemeProvider>
      <SessionWatcher expectedUserId={user.id} />
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
        settings,
      }}>
        <DashboardShell
          businessName={businessName}
          userName={userName}
          sector={sector}
          plan={plan}
          permissions={permissions}
          staffRole={staffRole}
          settings={settings}
        >
          <ConfirmProvider>
            {children}
          </ConfirmProvider>
        </DashboardShell>
      </BusinessProvider>
    </ThemeProvider>
  )
}
