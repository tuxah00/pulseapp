'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react'

export default function PortalVerifyPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const businessId = params.businessId as string
  const phone = searchParams.get('phone') || ''

  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(60)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!phone) {
      router.replace(`/portal/${businessId}`)
    }
  }, [phone, businessId, router])

  useEffect(() => {
    // Geri sayım
    const timer = setInterval(() => {
      setResendCooldown(prev => prev > 0 ? prev - 1 : 0)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // OTP input handlers
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
    // Tüm haneler dolduğunda otomatik doğrula
    if (newOtp.every(d => d !== '') && newOtp.join('').length === 6) {
      handleVerify(newOtp.join(''))
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setOtp(pasted.split(''))
      handleVerify(pasted)
    }
  }

  const handleVerify = async (code?: string) => {
    const verifyCode = code || otp.join('')
    if (verifyCode.length < 6) return
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/portal/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, phone, otp: verifyCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Doğrulama başarısız')
        setOtp(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
        return
      }
      // Başarılı — dashboard'a yönlendir
      router.replace(`/portal/${businessId}/dashboard`)
    } catch {
      setError('Bağlantı hatası. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setResending(true)
    setError(null)
    try {
      const res = await fetch('/api/portal/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, phone }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Gönderilemedi')
      } else {
        setResendCooldown(60)
        setOtp(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      }
    } catch {
      setError('Bağlantı hatası')
    } finally {
      setResending(false)
    }
  }

  const maskedPhone = phone ? `${phone.slice(0, 4)}****${phone.slice(-2)}` : ''

  return (
    <div className="portal-page min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />Geri
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="text-center mb-6">
            <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="h-7 w-7 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">SMS Kodu Gönderildi</h2>
            <p className="text-sm text-gray-500 mt-1">
              <span className="font-medium text-gray-700">{maskedPhone}</span> numarasına 6 haneli doğrulama kodu gönderdik.
            </p>
          </div>

          <div className="flex gap-2 justify-center mb-5" onPaste={handleOtpPaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={el => { inputRefs.current[index] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                className="w-11 h-12 text-center text-lg font-bold border-2 rounded-xl outline-none text-gray-900
                  border-gray-200 focus:border-pulse-900 focus:ring-2 focus:ring-pulse-900/20 transition-colors
                  disabled:opacity-50"
                disabled={loading}
                autoFocus={index === 0}
              />
            ))}
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 mb-4 text-center">
              {error}
            </div>
          )}

          <button
            onClick={() => handleVerify()}
            disabled={otp.join('').length < 6 || loading}
            className="w-full flex items-center justify-center gap-2 bg-pulse-900 text-white font-medium py-2.5 px-4 rounded-xl hover:bg-pulse-800 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Doğrula'}
          </button>

          <div className="text-center mt-4">
            {resendCooldown > 0 ? (
              <p className="text-sm text-gray-400">{resendCooldown} saniye sonra tekrar gönderebilirsiniz</p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-sm text-pulse-900 hover:underline disabled:opacity-50"
              >
                {resending ? 'Gönderiliyor...' : 'Kodu Tekrar Gönder'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
