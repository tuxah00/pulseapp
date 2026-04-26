'use client'

import { useState } from 'react'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { Eye, EyeOff, KeyRound, Loader2, Mail, Shield, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

/**
 * Hesabım sayfası — tüm personellere açık (settings izni şart değil).
 *
 * Şu anda sadece şifre değiştirme. İleride:
 *   - 2FA / cihaz oturumları
 *   - bildirim tercihleri
 *   - aktif oturumlar
 * gibi alanlar buraya eklenebilir.
 */
export default function AccountSettingsPage() {
  const { staffName, staffRole, loading } = useBusinessContext()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ROLE_LABELS: Record<string, string> = {
    owner: 'İşletme Sahibi', manager: 'Yönetici', staff: 'Personel',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 6) {
      setError('Yeni şifre en az 6 karakter olmalı.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Yeni şifreler eşleşmiyor.')
      return
    }
    if (currentPassword === newPassword) {
      setError('Yeni şifre mevcut şifreden farklı olmalı.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Şifre değiştirilemedi.')
        setSaving(false)
        return
      }
      window.dispatchEvent(new CustomEvent('pulse-toast', {
        detail: { type: 'success', title: 'Şifre güncellendi', body: 'Yeni şifrenizle giriş yapmaya devam edebilirsiniz.' },
      }))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      setError('Bağlantı hatası')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-pulse-900" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
      <Link href="/dashboard/settings" className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
        <ChevronLeft className="h-3.5 w-3.5" />
        Ayarlar
      </Link>

      <header>
        <h1 className="h-page">Hesabım</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Hesap güvenliğini yönet ve şifreni değiştir.
        </p>
      </header>

      {/* Profil özeti */}
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-pulse-900 text-white flex items-center justify-center font-semibold text-lg flex-shrink-0">
            {staffName?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{staffName || 'Personel'}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
              <Shield className="h-3 w-3" />
              {staffRole ? ROLE_LABELS[staffRole] : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Şifre değiştir */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="h-4 w-4 text-pulse-900 dark:text-pulse-300" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Şifre Değiştir</h2>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Güvenliğin için kimseyle paylaşmadığın güçlü bir şifre kullan.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="currentPassword" className="label">Mevcut Şifre</label>
            <div className="relative">
              <input
                id="currentPassword"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input pr-10"
                placeholder="Mevcut şifren"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showCurrent ? 'Şifreyi gizle' : 'Şifreyi göster'}
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="newPassword" className="label">Yeni Şifre</label>
            <div className="relative">
              <input
                id="newPassword"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input pr-10"
                placeholder="En az 6 karakter"
                required
                minLength={6}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showNew ? 'Şifreyi gizle' : 'Şifreyi göster'}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="label">Yeni Şifre (Tekrar)</label>
            <input
              id="confirmPassword"
              type={showNew ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
              placeholder="Yeni şifreyi tekrar gir"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-900/40 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-50">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Şifreyi Güncelle
            </button>
          </div>
        </form>
      </div>

      {/* Yardım kutusu */}
      <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 p-4 flex items-start gap-3">
        <Mail className="h-4 w-4 text-blue-600 dark:text-blue-300 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Şifreni unuttuysan</p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 leading-relaxed">
            İşletme sahibinden yeni bir şifre üretmesini iste. Sahibe Personel listesinden senin için yeni bir
            şifre oluşturma yetkisi var.
          </p>
        </div>
      </div>
    </div>
  )
}
