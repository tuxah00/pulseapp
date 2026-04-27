'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mail, Loader2, ChevronLeft, KeyRound } from 'lucide-react'

/**
 * Şifremi Unuttum — E-posta OTP isteme sayfası.
 *
 * Akış:
 *   1) Kullanıcı e-posta yazar
 *   2) supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
 *      Supabase 6 haneli kod içeren bir e-posta gönderir.
 *   3) /auth/verify-code?email=xxx adresine yönlendirilir
 *
 * Güvenlik:
 *   - shouldCreateUser:false → bu endpoint hesap oluşturmaz, sadece var olanlara kod gönderir
 *   - "Kod gönderildi" mesajı e-posta var olsa da olmasa da gösterilir (enumeration koruması;
 *      Supabase de aynı şekilde davranır)
 *   - Supabase'in built-in rate limit'i çalışır (varsayılan: aynı e-postaya sık istek yapamaz)
 */
export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setError('Lütfen e-posta adresini gir.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: { shouldCreateUser: false },
    })

    // Hata durumunda bile genel mesaj göster — saldırganın "bu e-posta kayıtlı mı?"
    // sorgusunu yapamaması için. Supabase rate-limit hatalarını bile yutuyoruz.
    if (otpError && !otpError.message.toLowerCase().includes('rate limit')) {
      // Sadece rate-limit'i bilgilendirici olarak gösteriyoruz; diğer tüm hataları yut
      // (hesap yok, e-posta gönderilemedi vb.)
    }

    setLoading(false)
    if (otpError && otpError.message.toLowerCase().includes('rate limit')) {
      setError('Çok fazla deneme yaptın. Birkaç dakika sonra tekrar dene.')
      return
    }

    // Her durumda verify-code sayfasına yönlendir — saldırgan "kod gönderildi mi?"
    // bilgisinden faydalanamaz
    router.push(`/auth/verify-code?email=${encodeURIComponent(trimmedEmail)}`)
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <div className="mb-7">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-pulse-900">
          <KeyRound className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Şifreni mi unuttun?</h2>
        <p className="mt-1 text-sm text-gray-500">
          E-posta adresine 6 haneli bir doğrulama kodu göndereceğiz.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="label">E-posta</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input pl-9"
              placeholder="ornek@email.com"
              required
              autoFocus
              autoComplete="email"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Doğrulama Kodu Gönder
        </button>
      </form>

      <Link
        href="/auth/login"
        className="mt-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ChevronLeft className="h-4 w-4" />
        Giriş sayfasına dön
      </Link>
    </div>
  )
}
