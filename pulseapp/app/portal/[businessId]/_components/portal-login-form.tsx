'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, Loader2, ArrowRight, Calendar } from 'lucide-react'

export type PortalLoginMode = 'otp' | 'direct' | 'birthdate'

interface Props {
  businessId: string
  mode: PortalLoginMode
}

export function PortalLoginForm({ businessId, mode }: Props) {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [birthDate, setBirthDate] = useState('')
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
    if (mode === 'birthdate' && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      setError('Doğum tarihinizi seçin')
      return
    }

    setLoading(true)
    try {
      let endpoint = '/api/portal/direct-login'
      let body: Record<string, string> = { businessId, phone: cleanPhone }
      if (mode === 'otp') {
        endpoint = '/api/portal/otp'
      } else if (mode === 'birthdate') {
        endpoint = '/api/portal/login'
        body = { businessId, phone: cleanPhone, birthDate }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.')
        return
      }
      if (mode === 'otp') {
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
        <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-3 bg-white transition-all">
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

      {mode === 'birthdate' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Doğum Tarihi
          </label>
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-3 bg-white transition-all">
            <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="flex-1 outline-none text-sm text-gray-900 bg-transparent placeholder-gray-400"
              required
            />
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            İşletmeye randevu sırasında verdiğiniz doğum tarihi.
          </p>
        </div>
      )}

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
