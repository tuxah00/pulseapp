'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

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
    alert('Giriş linki e-posta adresinize gönderildi. Lütfen kontrol edin.')
    setLoading(false)
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Giriş Yap</h2>

      <form onSubmit={handleLogin} className="space-y-4">
        {/* E-posta */}
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
            autoComplete="email"
          />
        </div>

        {/* Şifre */}
        <div>
          <label htmlFor="password" className="label">Şifre</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input pr-10"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Hata */}
        {error && (
          <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {error}
          </div>
        )}

        {/* Giriş butonu */}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Giriş Yap
        </button>
      </form>

      {/* Ayırıcı */}
      <div className="my-6 flex items-center">
        <div className="flex-1 border-t border-gray-200" />
        <span className="px-3 text-xs text-gray-400">veya</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      {/* Magic Link */}
      <button
        onClick={handleMagicLink}
        disabled={loading}
        className="btn-secondary w-full"
      >
        Şifresiz giriş linki gönder
      </button>

      {/* Kayıt linki */}
      <p className="mt-6 text-center text-sm text-gray-500">
        Hesabınız yok mu?{' '}
        <Link href="/auth/register" className="font-medium text-pulse-600 hover:text-pulse-700">
          Ücretsiz deneyin
        </Link>
      </p>
    </div>
  )
}
