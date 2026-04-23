'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, Mail, Lock } from 'lucide-react'

// Next.js 14 useSearchParams() için Suspense gerekli
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="card p-8 text-center text-gray-400">Yükleniyor...</div>}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(
        authError.message === 'Invalid login credentials'
          ? 'E-posta veya şifre hatalı.'
          : authError.message
      )
      setLoading(false)
      return
    }

    router.push(redirect)
    router.refresh()
  }

  async function handleMagicLink() {
    if (!email) {
      setError('Lütfen e-posta adresinizi girin.')
      return
    }
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    setError(null)
    setNotice('Giriş linki e-posta adresinize gönderildi. Lütfen gelen kutunuzu kontrol edin.')
    setLoading(false)
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <div className="mb-7">
        <h2 className="text-2xl font-bold text-gray-900">Tekrar hoş geldiniz</h2>
        <p className="mt-1 text-sm text-gray-500">Hesabınıza giriş yapın</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-5">
        {/* E-posta */}
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
              autoComplete="email"
            />
          </div>
        </div>

        {/* Şifre */}
        <div>
          <label htmlFor="password" className="label">Şifre</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input pl-9 pr-10"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Bilgi */}
        {notice && !error && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900/40 dark:text-emerald-300">
            {notice}
          </div>
        )}

        {/* Hata */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Giriş butonu */}
        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Giriş Yap
        </button>
      </form>

      {/* Ayırıcı */}
      <div className="my-5 flex items-center gap-3">
        <div className="flex-1 border-t border-gray-200" />
        <span className="text-xs text-gray-400">veya</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      {/* Magic Link */}
      <button
        onClick={handleMagicLink}
        disabled={loading}
        className="btn-secondary w-full justify-center"
      >
        <Mail size={15} />
        Şifresiz giriş linki gönder
      </button>

      {/* Kayıt linki */}
      <p className="mt-6 text-center text-sm text-gray-500">
        Hesabınız yok mu?{' '}
        <Link href="/auth/register" className="font-semibold text-pulse-900 hover:text-pulse-900">
          Ücretsiz deneyin →
        </Link>
      </p>
    </div>
  )
}
