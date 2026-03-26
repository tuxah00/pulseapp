import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import Sidebar from '@/components/dashboard/sidebar'
import TopBar from '@/components/dashboard/top-bar'
import OnboardingForm from '@/components/dashboard/onboarding-form'
import { BusinessProvider } from '@/lib/hooks/business-context-provider'
import { ThemeProvider } from '@/components/theme-provider'
import ToastContainer from '@/components/ui/toast'
import { ConfirmProvider } from '@/lib/hooks/use-confirm'
import { getEffectivePermissions, type StaffRole } from '@/types'

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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pulse-50 via-white to-pulse-100 p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-pulse-600">
              Pulse<span className="text-gray-900">App</span>
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

  const business = (staffMember as any).businesses
  const userName = staffMember.name || user.user_metadata?.full_name || user.email || 'Kullanıcı'
  const businessName = business?.name || 'İşletme'
  const sector = business?.sector || 'other'
  const plan = business?.subscription_plan || 'starter'
  const staffRole = (staffMember.role || 'staff') as StaffRole
  const permissions = getEffectivePermissions(staffRole, staffMember.permissions)

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar businessName={businessName} userName={userName} sector={sector} plan={plan} permissions={permissions} />
        <main className="lg:pl-64 transition-all duration-200">
          <TopBar businessName={businessName} userName={userName} />
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
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
            }}>
              <ConfirmProvider>
                {children}
              </ConfirmProvider>
            </BusinessProvider>
            <ToastContainer />
          </div>
        </main>
      </div>
    </ThemeProvider>
  )
}
