import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidUUID } from '@/lib/utils/validate'
import { shouldUseOtp, getPortalSession } from '@/lib/portal/auth'
import { PortalLoginForm } from './_components/portal-login-form'
import { Sparkles, Info } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { businessId: string }
  searchParams: { no_customer?: string }
}

export default async function PortalLoginPage({ params, searchParams }: PageProps) {
  const { businessId } = params
  const noCustomerNotice = searchParams?.no_customer === '1'
  if (!isValidUUID(businessId)) notFound()

  const admin = createAdminClient()
  const { data: business } = await admin
    .from('businesses')
    .select('id, name, sector, is_active, settings')
    .eq('id', businessId)
    .single()

  if (!business || business.is_active === false) notFound()

  const logoUrl = (business.settings as { logo_url?: string | null } | null)?.logo_url ?? null

  // Oturum varsa DB'de doğrula; geçerliyse dashboard'a yönlendir, değilse çerezi temizleyerek burada kal
  const session = getPortalSession()
  if (session && session.businessId === businessId) {
    const { data: customer } = await admin
      .from('customers')
      .select('id')
      .eq('id', session.customerId)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .maybeSingle()

    if (customer) {
      redirect(`/portal/${businessId}/dashboard`)
    }
    // Çerez geçersiz — logout route'u çerezleri temizleyip bu sayfaya geri döner (döngü kırılır)
    redirect(`/api/portal/logout?businessId=${businessId}`)
  }

  const useOtp = shouldUseOtp()

  return (
    <div className="portal-page min-h-screen relative flex items-center justify-center bg-gradient-to-br from-pulse-900 via-pulse-800 to-indigo-900 p-4 overflow-hidden">
      {/* Arka plan dekorları */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Hero — işletme logo + adı */}
        <div className="text-center mb-7">
          {logoUrl ? (
            <div className="relative inline-block">
              <Image
                src={logoUrl}
                alt={business.name}
                width={80}
                height={80}
                className="rounded-3xl object-cover mx-auto shadow-2xl ring-4 ring-white/20"
              />
            </div>
          ) : (
            <div className="h-20 w-20 rounded-3xl bg-white/10 backdrop-blur-md ring-4 ring-white/20 flex items-center justify-center mx-auto shadow-2xl">
              <span className="text-3xl font-bold text-white">
                {business.name?.slice(0, 1).toUpperCase() || '?'}
              </span>
            </div>
          )}
          <h1 className="mt-4 text-2xl font-bold text-white tracking-tight">
            {business.name}
          </h1>
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
            <Sparkles className="h-3 w-3 text-amber-300" />
            <span className="text-xs font-medium text-white/90">Müşteri Portalı</span>
          </div>
        </div>

        {/* Giriş kartı — glassmorphism */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 p-6">
          {noCustomerNotice && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900">
                Önizleme için uygun bir müşteri bulunamadı. Önce müşteri ekleyin ya da mevcut bir müşterinin telefonuyla giriş yapın.
              </p>
            </div>
          )}

          <h2 className="text-lg font-semibold text-gray-900 mb-1">Hesabınıza Giriş</h2>
          <p className="text-sm text-gray-500 mb-5">
            {useOtp
              ? 'Kayıtlı telefon numaranızı girin, size SMS ile doğrulama kodu gönderelim.'
              : 'Kayıtlı telefon numaranızı girerek portala erişin.'}
          </p>

          <PortalLoginForm businessId={businessId} useOtp={useOtp} />
        </div>

        <div className="text-center mt-5 space-y-2">
          <p className="text-xs text-white/70">
            Bu portala sadece işletmeye kayıtlı müşteriler girebilir.
          </p>
          <a
            href={`/book/${businessId}`}
            className="inline-block text-xs text-amber-300 hover:text-amber-200 underline underline-offset-2 transition-colors"
          >
            Randevu almak için tıklayın →
          </a>
        </div>
      </div>
    </div>
  )
}
