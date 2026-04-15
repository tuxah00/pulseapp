'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, Loader2, ArrowRight } from 'lucide-react'

interface Props {
  businessId: string
  useOtp: boolean
}

export function PortalLoginForm({ businessId, useOtp }: Props) {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      const endpoint = useOtp ? '/api/portal/otp' : '/api/portal/direct-login'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, phone: cleanPhone }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Enumerasyon güvenli tek tip hata mesajı
        setError(data.error || 'Giriş başarısız. Lütfen telefon numaranızı kontrol edin.')
        return
      }
      if (useOtp) {
        router.push(`/portal/${businessId}/verify?phone=${encodeURIComponent(cleanPhone)}`)
      } else {
        router.push(`/portal/${businessId}/dashboard`)
      }
    } catch {
      setError('Bağlantı hatası. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Telefon Numarası
        </label>
        <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-3 bg-white focus-within:border-pulse-900 focus-within:ring-2 focus-within:ring-pulse-900/20 transition-all">
          <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0532 123 45 67"
            className="flex-1 outline-none text-sm text-gray-900 bg-transparent placeholder-gray-400"
            autoFocus
            required
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-pulse-900 to-indigo-700 text-white font-medium py-3 px-4 rounded-xl hover:from-pulse-800 hover:to-indigo-600 shadow-lg shadow-pulse-900/25 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>Devam Et <ArrowRight className="h-4 w-4" /></>
        )}
      </button>
    </form>
  )
}
