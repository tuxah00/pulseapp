'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { SECTOR_LABELS, type SectorType } from '@/types'

export default function RegisterPage() {
  const router = useRouter()

  const [step, setStep] = useState<1 | 2>(1)  // 1: hesap, 2: işletme bilgisi
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Hesap
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')

  // Step 2: İşletme
  const [businessName, setBusinessName] = useState('')
  const [sector, setSector] = useState<SectorType>('hair_salon')
  const [city, setCity] = useState('')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()

    if (step === 1) {
      // Validasyon
      if (password.length < 6) {
        setError('Şifre en az 6 karakter olmalı.')
        return
      }
      setError(null)
      setStep(2)
      return
    }

    // Step 2: Kayıt ol
    setLoading(true)
    setError(null)

    const supabase = createClient()

    // 1. Supabase Auth'a kayıt
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // E-posta onayı gerekiyorsa (Supabase varsayılan ayarı)
    if (authData.user && !authData.session) {
      // 2. İşletme oluştur (kullanıcı henüz login olmadı ama user.id var)
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: authData.user.id,
          business_name: businessName,
          sector,
          phone,
          city,
        }),
      })

      if (!res.ok) {
        console.error('Onboarding hatası:', await res.text())
      }

      setLoading(false)
      setError(null)
      alert('Kayıt başarılı! E-posta adresinize onay linki gönderildi. Lütfen kontrol edin.')
      return
    }

    // E-posta onayı kapalıysa direkt session var
    if (authData.user && authData.session) {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: authData.user.id,
          business_name: businessName,
          sector,
          phone,
          city,
        }),
      })

      if (!res.ok) {
        setError('İşletme oluşturulurken bir hata oluştu.')
        setLoading(false)
        return
      }

      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">
        {step === 1 ? 'Hesap Oluştur' : 'İşletme Bilgileri'}
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        {step === 1
          ? '14 gün ücretsiz deneyin, kart bilgisi gerekmez.'
          : 'Son adım — işletmenizi tanımlayın.'}
      </p>

      {/* İlerleme göstergesi */}
      <div className="mb-6 flex gap-2">
        <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-pulse-500' : 'bg-gray-200'}`} />
        <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-pulse-500' : 'bg-gray-200'}`} />
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        {step === 1 ? (
          <>
            <div>
              <label htmlFor="fullName" className="label">Ad Soyad</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input"
                placeholder="Ahmet Yılmaz"
                required
              />
            </div>
            <div>
              <label htmlFor="email" className="label">E-posta</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="ornek@email.com"
                required
              />
            </div>
            <div>
              <label htmlFor="phone" className="label">Telefon</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
                placeholder="0532 123 45 67"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="label">Şifre</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="En az 6 karakter"
                required
                minLength={6}
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label htmlFor="businessName" className="label">İşletme Adı</label>
              <input
                id="businessName"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="input"
                placeholder="Güzellik Salonu Nur"
                required
              />
            </div>
            <div>
              <label htmlFor="sector" className="label">Sektör</label>
              <select
                id="sector"
                value={sector}
                onChange={(e) => setSector(e.target.value as SectorType)}
                className="input"
                required
              >
                {Object.entries(SECTOR_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="city" className="label">Şehir</label>
              <input
                id="city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="input"
                placeholder="Erzincan"
                required
              />
            </div>
          </>
        )}

        {error && (
          <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="btn-secondary flex-1"
            >
              Geri
            </button>
          )}
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {step === 1 ? 'Devam Et' : 'Hesap Oluştur'}
          </button>
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Zaten hesabınız var mı?{' '}
        <Link href="/auth/login" className="font-medium text-pulse-600 hover:text-pulse-700">
          Giriş yapın
        </Link>
      </p>
    </div>
  )
}
