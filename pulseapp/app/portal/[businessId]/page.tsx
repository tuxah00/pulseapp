'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Phone, Loader2, ArrowRight } from 'lucide-react'

interface Business {
  id: string
  name: string
  logo_url?: string
  sector?: string
}

export default function PortalLoginPage() {
  const params = useParams()
  const router = useRouter()
  const businessId = params.businessId as string

  const [business, setBusiness] = useState<Business | null>(null)
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bizLoading, setBizLoading] = useState(true)

  useEffect(() => {
    async function fetchBusiness() {
      try {
        const res = await fetch(`/api/public/business/${businessId}`)
        if (!res.ok) return
        const data = await res.json()
        setBusiness(data.business)
      } catch { /* sessizce devam et */ } finally {
        setBizLoading(false)
      }
    }
    if (businessId) fetchBusiness()
  }, [businessId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const cleanPhone = phone.replace(/\s+/g, '').replace(/-/g, '')
    if (!cleanPhone || cleanPhone.length < 10) {
      setError('Geçerli bir telefon numarası giriniz')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/portal/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, phone: cleanPhone }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Bir hata oluştu')
        return
      }
      // OTP gönderildi — doğrulama sayfasına yönlendir
      router.push(`/portal/${businessId}/verify?phone=${encodeURIComponent(cleanPhone)}`)
    } catch {
      setError('Bağlantı hatası. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  if (bizLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="portal-page min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        {/* Logo/Başlık */}
        <div className="text-center mb-8">
          {business?.logo_url ? (
            <img src={business.logo_url} alt={business.name} className="h-16 w-16 rounded-2xl object-cover mx-auto mb-4" />
          ) : (
            <div className="h-16 w-16 rounded-2xl bg-pulse-900 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-white">
                {business?.name?.slice(0, 1) || '?'}
              </span>
            </div>
          )}
          <h1 className="text-xl font-bold text-gray-900">{business?.name || 'İşletme Portalı'}</h1>
          <p className="mt-1 text-sm text-gray-500">Müşteri Portalı</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Giriş Yap</h2>
          <p className="text-sm text-gray-500 mb-5">Telefon numaranızı girin, SMS ile doğrulama kodu gönderelim.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefon Numarası</label>
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-pulse-900 focus-within:ring-1 focus-within:ring-pulse-900 transition-colors">
                <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0532 123 45 67"
                  className="flex-1 outline-none text-sm text-gray-900 bg-transparent"
                  autoFocus
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-pulse-900 text-white font-medium py-2.5 px-4 rounded-xl hover:bg-pulse-800 transition-colors disabled:opacity-70"
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <>SMS Kodu Gönder <ArrowRight className="h-4 w-4" /></>
              }
            </button>
          </form>
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          Bu portala sadece işletmeye kayıtlı müşteriler girebilir.
        </p>
      </div>
    </div>
  )
}
