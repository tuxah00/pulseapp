'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, UserPlus, CheckCircle, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [invitation, setInvitation] = useState<{ business_name: string; role: string; email: string | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const supabase = createClient()

  useEffect(() => {
    async function validate() {
      const res = await fetch(`/api/invite?token=${token}`)
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Geçersiz davet linki')
      } else {
        const d = await res.json()
        const inv = d.invitation
        setInvitation({
          business_name: (inv.businesses as any)?.name ?? 'İşletme',
          role: inv.role,
          email: inv.email,
        })
        if (inv.email) setEmail(inv.email)
      }
      setLoading(false)
    }
    validate()
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    // 1. Create Supabase Auth user
    const { data: authData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })

    if (signUpErr || !authData.user) {
      setError(signUpErr?.message || 'Hesap oluşturulamadı')
      setSubmitting(false)
      return
    }

    // 2. Register via API to create staff_member record
    const res = await fetch(`/api/invite/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, user_id: authData.user.id, name }),
    })

    if (!res.ok) {
      const d = await res.json()
      setError(d.error || 'Kayıt tamamlanamadı')
      setSubmitting(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/auth/login'), 3000)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-pulse-500" />
      </div>
    )
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card max-w-sm w-full text-center p-8">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Davet Linki Geçersiz</h2>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card max-w-sm w-full text-center p-8">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Kayıt Başarılı!</h2>
          <p className="text-sm text-gray-500">Giriş sayfasına yönlendiriliyorsunuz...</p>
        </div>
      </div>
    )
  }

  const ROLE_LABELS: Record<string, string> = { owner: 'İşletme Sahibi', manager: 'Yönetici', staff: 'Personel' }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <div className="card max-w-md w-full p-8">
        <div className="text-center mb-6">
          <UserPlus className="mx-auto h-12 w-12 text-pulse-500 mb-3" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sisteme Katıl</h1>
          <p className="text-sm text-gray-500 mt-1">
            <strong>{invitation?.business_name}</strong> işletmesine{' '}
            <strong>{ROLE_LABELS[invitation?.role ?? 'staff']}</strong> olarak davet edildiniz
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Ad Soyad</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" required placeholder="Adınız Soyadınız" />
          </div>
          <div>
            <label className="label">E-posta</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required placeholder="email@ornek.com" readOnly={!!invitation?.email} />
          </div>
          <div>
            <label className="label">Şifre</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" required minLength={6} placeholder="En az 6 karakter" />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Sisteme Katıl
          </button>
        </form>
      </div>
    </div>
  )
}
