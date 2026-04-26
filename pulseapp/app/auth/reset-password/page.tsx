'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Loader2, KeyRound, CheckCircle, AlertCircle } from 'lucide-react'

type PageState = 'loading' | 'ready' | 'success' | 'error'

export default function ResetPasswordPage() {
  const [pageState, setPageState] = useState<PageState>('loading')
  const [initError, setInitError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Supabase client'ı yalnızca tarayıcıda (client-side) başlat — SSR sırasında çağrılmaz
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  function getClient() {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }

  const router = useRouter()

  useEffect(() => {
    // Hash fragment'tan token'ları oku (#access_token=...&refresh_token=...&type=recovery)
    const hash = window.location.hash.slice(1) // '#' karakterini atla
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type = params.get('type')

    if (!accessToken || !refreshToken || type !== 'recovery') {
      setInitError('Geçersiz veya süresi dolmuş şifre sıfırlama linki. Lütfen yöneticinizden yeni bir link isteyin.')
      setPageState('error')
      return
    }

    // Token'ları kullanarak oturumu başlat
    getClient().auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          setInitError('Oturum başlatılamadı: ' + error.message)
          setPageState('error')
        } else {
          setPageState('ready')
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (password.length < 6) {
      setFormError('Şifre en az 6 karakter olmalıdır.')
      return
    }
    if (password !== confirmPassword) {
      setFormError('Şifreler eşleşmiyor.')
      return
    }

    setSaving(true)
    const { error } = await getClient().auth.updateUser({ password })
    setSaving(false)

    if (error) {
      setFormError('Şifre güncellenemedi: ' + error.message)
    } else {
      setPageState('success')
      setTimeout(() => router.push('/dashboard'), 2000)
    }
  }

  // Yükleniyor
  if (pageState === 'loading') {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-pulse-900" />
        <p className="text-sm text-gray-500">Link doğrulanıyor...</p>
      </div>
    )
  }

  // Hatalı link
  if (pageState === 'error') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/20 p-6 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-500" />
        <h2 className="font-semibold text-red-700 dark:text-red-400 mb-2">Geçersiz Link</h2>
        <p className="text-sm text-red-600 dark:text-red-300 mb-4">{initError}</p>
        <a href="/auth/login" className="text-sm font-medium text-pulse-900 hover:underline">
          Giriş sayfasına dön →
        </a>
      </div>
    )
  }

  // Başarılı
  if (pageState === 'success') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-900/20 p-6 text-center">
        <CheckCircle className="mx-auto mb-3 h-8 w-8 text-green-500" />
        <h2 className="font-semibold text-green-700 dark:text-green-400 mb-1">Şifreniz güncellendi!</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Dashboard&apos;a yönlendiriliyorsunuz...</p>
      </div>
    )
  }

  // Şifre güncelleme formu
  return (
    <div>
      <div className="mb-8">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-pulse-900">
          <KeyRound className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Yeni Şifre Belirle</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          PulseApp hesabınız için yeni şifrenizi girin.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="label">Yeni Şifre</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="En az 6 karakter"
            required
            minLength={6}
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="label">Şifre Tekrar</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input"
            placeholder="Aynı şifreyi tekrar girin"
            required
          />
        </div>

        {formError && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {formError}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />}
          Şifremi Güncelle
        </button>

        <p className="text-center text-xs text-gray-400">
          Sorun mu yaşıyorsunuz?{' '}
          <a href="/auth/login" className="text-pulse-900 hover:underline">
            Giriş sayfasına dönün
          </a>
        </p>
      </form>
    </div>
  )
}
