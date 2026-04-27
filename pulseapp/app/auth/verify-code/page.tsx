'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Loader2, ChevronLeft, ShieldCheck } from 'lucide-react'

export default function VerifyCodePage() {
  return (
    <Suspense fallback={<div className="card p-8 text-center text-gray-400">Yükleniyor...</div>}>
      <VerifyCodeForm />
    </Suspense>
  )
}

/**
 * Doğrulama kodu girişi.
 *
 * URL: /auth/verify-code?email=xxx
 *
 * Akış:
 *   1) Kullanıcı 6 haneli kodu girer (e-postadan kopyaladığı)
 *   2) supabase.auth.verifyOtp({ email, token, type: 'email' })
 *   3) Başarılıysa session kurulur → /auth/set-new-password'e yönlendirilir
 */
function VerifyCodeForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''

  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  // E-posta yoksa /forgot-password'e geri yönlendir
  useEffect(() => {
    if (!email) router.replace('/auth/forgot-password')
  }, [email, router])

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1) // sadece son rakam
    const newCode = [...code]
    newCode[index] = digit
    setCode(newCode)
    // Bir sonraki input'a otomatik geç
    if (digit && index < 5) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      e.preventDefault()
      setCode(pasted.split(''))
      inputsRef.current[5]?.focus()
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const token = code.join('')
    if (token.length !== 6) {
      setError('Lütfen 6 haneli kodu eksiksiz gir.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })

    if (verifyError) {
      setLoading(false)
      const msg = verifyError.message.toLowerCase()
      if (msg.includes('expired')) {
        setError('Kodun süresi dolmuş. Yeni kod iste.')
      } else if (msg.includes('invalid')) {
        setError('Kod hatalı. Lütfen tekrar dene.')
      } else {
        setError('Doğrulama başarısız: ' + verifyError.message)
      }
      return
    }

    // Session kuruldu — yeni şifre belirleme sayfasına yönlendir
    router.push('/auth/set-new-password')
    router.refresh()
  }

  async function handleResend() {
    if (resending || resendCooldown > 0) return
    setResending(true)
    setError(null)

    const supabase = createClient()
    const { error: resendError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })

    setResending(false)
    if (resendError && resendError.message.toLowerCase().includes('rate limit')) {
      setError('Çok fazla deneme. Birkaç dakika sonra tekrar dene.')
      setResendCooldown(60)
      return
    }
    setResendCooldown(60)
  }

  if (!email) return null

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <div className="mb-7">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-pulse-900">
          <ShieldCheck className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Kodu Gir</h2>
        <p className="mt-1 text-sm text-gray-500">
          <span className="font-medium text-gray-700">{email}</span> adresine 6 haneli bir doğrulama kodu gönderdik.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="label">Doğrulama Kodu</label>
          <div className="flex gap-2 justify-between">
            {code.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputsRef.current[i] = el }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                autoFocus={i === 0}
                className="w-12 h-14 text-center text-xl font-bold rounded-lg border border-gray-200 focus:border-pulse-900 focus:ring-2 focus:ring-pulse-900/20 outline-none"
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Kodu Doğrula
        </button>
      </form>

      <div className="mt-5 text-center text-sm text-gray-500">
        Kod gelmedi mi?{' '}
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || resendCooldown > 0}
          className="font-medium text-pulse-900 hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
        >
          {resending
            ? 'Gönderiliyor...'
            : resendCooldown > 0
              ? `Tekrar gönder (${resendCooldown}s)`
              : 'Tekrar gönder'}
        </button>
      </div>

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
