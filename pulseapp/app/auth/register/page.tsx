'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Loader2, User, Mail, Phone, Lock, Building2, MapPin } from 'lucide-react'
import { SECTOR_LABELS, type SectorType } from '@/types'
import { CustomSelect } from '@/components/ui/custom-select'

export default function RegisterPage() {
  const router = useRouter()

  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

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
      setNotice('Kayıt başarılı! E-posta adresinize onay linki gönderildi. Lütfen gelen kutunuzu kontrol edin.')
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

      // Öncelikli sektörlerde kurulum sihirbazına yönlen; diğerleri dashboard modalı
      const isPriority = sector === 'medical_aesthetic' || sector === 'dental_clinic'
      router.push(isPriority ? '/onboarding' : '/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      {/* Başlık */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {step === 1 ? 'Hesap oluştur' : 'İşletme bilgileri'}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {step === 1
            ? '14 gün ücretsiz deneyin, kart bilgisi gerekmez.'
            : 'Son adım — işletmenizi tanımlayın.'}
        </p>
      </div>

      {/* Adım göstergesi */}
      <div className="mb-7 flex items-center gap-2">
        {[1, 2].map((n) => (
          <div key={n} className="flex items-center gap-2 flex-1">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold
              transition-colors duration-200
              ${step === n
                ? 'bg-pulse-800 text-white shadow-sm shadow-pulse-300'
                : step > n
                  ? 'bg-pulse-100 text-pulse-900'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {step > n ? '✓' : n}
            </div>
            <span className={`text-xs font-medium ${step === n ? 'text-gray-900' : 'text-gray-400'}`}>
              {n === 1 ? 'Hesap' : 'İşletme'}
            </span>
            {n < 2 && (
              <div className={`flex-1 h-px ${step > n ? 'bg-pulse-300' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        {step === 1 ? (
          <>
            <div>
              <label htmlFor="fullName" className="label">Ad Soyad</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input pl-9"
                  placeholder="Ahmet Yılmaz"
                  required
                />
              </div>
            </div>
            <div>
              <label htmlFor="email" className="label">E-posta</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-9"
                  placeholder="ornek@email.com"
                  required
                />
              </div>
            </div>
            <div>
              <label htmlFor="phone" className="label">Telefon</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input pl-9"
                  placeholder="0532 123 45 67"
                  required
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="label">Şifre</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-9"
                  placeholder="En az 6 karakter"
                  required
                  minLength={6}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <label htmlFor="businessName" className="label">İşletme Adı</label>
              <div className="relative">
                <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="businessName"
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="input pl-9"
                  placeholder="Güzellik Salonu Nur"
                  required
                />
              </div>
            </div>
            <div>
              <label htmlFor="sector" className="label">Sektör</label>
              <CustomSelect
                value={sector}
                onChange={(v) => setSector(v as SectorType)}
                options={Object.entries(SECTOR_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </div>
            <div>
              <label htmlFor="city" className="label">Şehir</label>
              <div className="relative">
                <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="input pl-9"
                  placeholder="Erzincan"
                  required
                />
              </div>
            </div>
          </>
        )}

        {notice && !error && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900/40 dark:text-emerald-300">
            {notice}
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="btn-secondary flex-1"
            >
              Geri
            </button>
          )}
          <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center py-3">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {step === 1 ? 'Devam Et →' : 'Hesap Oluştur'}
          </button>
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Zaten hesabınız var mı?{' '}
        <Link href="/auth/login" className="font-semibold text-pulse-900 hover:text-pulse-900">
          Giriş yapın
        </Link>
      </p>
    </div>
  )
}
