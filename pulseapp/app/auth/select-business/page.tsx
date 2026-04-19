import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolveActiveStaff } from '@/lib/auth/active-business'
import BusinessPicker from './_components/business-picker'

/**
 * Birden fazla işletmede personel olan kullanıcılar için seçim sayfası.
 * Login sonrası veya dashboard layout'u `needs_selection` döndürünce buraya yönlenir.
 */
export default async function SelectBusinessPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const result = await resolveActiveStaff(
    supabase,
    user.id,
    'business_id, role, businesses(name, sector)'
  )

  if (result.status === 'needs_onboarding') {
    redirect('/dashboard')
  }

  // Tek işletme veya cookie eşleşti → direkt dashboard
  if (result.status === 'active') {
    redirect('/dashboard')
  }

  const businesses = result.businesses ?? []

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">İşletme Seçin</h2>
        <p className="mt-1 text-sm text-gray-500">
          Birden fazla işletmede personel kaydınız var. Hangisine giriş yapmak istiyorsunuz?
        </p>
      </div>

      <BusinessPicker businesses={businesses} />
    </div>
  )
}
