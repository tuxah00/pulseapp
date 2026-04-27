'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, Lock, KeyRound, CheckCircle } from 'lucide-react'

/**
 * Yeni şifre belirleme sayfası — OTP ile doğrulama yapmış kullanıcı için.
 *
 * Akış:
 *   1) Kullanıcı /auth/forgot-password → /auth/verify-code akışından geçti, session var
 *   2) Bu sayfada yeni şifresini belirler (mevcut şifre sorulmaz — OTP zaten doğruladı)
 *   3) supabase.auth.updateUser({ password }) → /dashboard'a yönlendirilir
 *
 * Güvenlik:
 *   - Session kontrolü: yoksa /auth/login'e yönlendir
 *   - updateUser zaten authenticated kullanıcı gerektirir
 */
export default function SetNewPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Session var mı kontrol et — yoksa OTP doğrulanmamış demek, login'e gönder
  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return
      if (!user) {
        router.replace('/auth/login')
        return
      }
      setChecking(false)
    })
    return () => { cancelled = true }
  }, [supabase.auth, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalı.')
      return
    }
    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError('Şifre güncellenemedi: ' + updateError.message)
      setLoading(false)
      return
    }
    setDone(true)
    setLoading(false)
    setTimeout(() => {
      router.push('/dashboard')
      router.refresh()
    }, 1200)
  }

  if (checking) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
      </div>
    )
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-6 w-6 text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Şifre güncellendi</h2>
        <p className="text-sm text-gray-500">Panele yönlendiriliyorsun...</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <div className="mb-7">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-pulse-900">
          <KeyRound className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Yeni şifre belirle</h2>
        <p className="mt-1 text-sm text-gray-500">
          Bundan sonra hesabına bu yeni şifreyle giriş yapacaksın.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="password" className="label">Yeni Şifre</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input pl-9 pr-10"
              placeholder="En az 6 karakter"
              required
              minLength={6}
              autoComplete="new-password"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="label">Yeni Şifre (Tekrar)</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input pl-9"
              placeholder="Şifreyi tekrar gir"
              required
              minLength={6}
              autoComplete="new-password"
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
          Şifreyi Güncelle
        </button>
      </form>
    </div>
  )
}
