'use client'

import { useEffect, useState } from 'react'
import { User, Mail, Cake, MessageCircle, Download, Trash2, Loader2, CheckCircle2, AlertCircle, LogOut } from 'lucide-react'
import { cn, formatDateISO } from '@/lib/utils'
import { SectionHeader } from '../_components/section-header'
import { DataDeletionModal } from '../_components/data-deletion-modal'

interface Profile {
  id: string
  name: string
  phone: string
  email: string | null
  birthday: string | null
  preferred_channel: 'sms' | 'whatsapp' | 'auto' | null
  segment: string
}

interface DeletionRequest {
  id: string
  status: string
  reason_category: string | null
  scheduled_deletion_at: string | null
  requested_at: string
}

const CHANNEL_OPTIONS: Array<{ value: 'sms' | 'whatsapp' | 'auto'; label: string; subtitle: string }> = [
  { value: 'auto', label: 'Otomatik', subtitle: 'Sistem uygun kanalı seçer' },
  { value: 'sms', label: 'SMS', subtitle: 'Klasik kısa mesaj' },
  { value: 'whatsapp', label: 'WhatsApp', subtitle: 'WhatsApp mesajı olarak' },
]

function formatDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return iso
  }
}

export default function PortalSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [deletionRequest, setDeletionRequest] = useState<DeletionRequest | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [birthday, setBirthday] = useState('')
  const [channel, setChannel] = useState<'sms' | 'whatsapp' | 'auto'>('auto')

  async function loadProfile() {
    const res = await fetch('/api/portal/profile')
    if (res.ok) {
      const data = await res.json()
      setProfile(data.profile)
      setName(data.profile.name || '')
      setEmail(data.profile.email || '')
      setBirthday(data.profile.birthday || '')
      setChannel(data.profile.preferred_channel || 'auto')
    }
  }

  async function loadDeletion() {
    const res = await fetch('/api/portal/data-deletion')
    if (res.ok) {
      const data = await res.json()
      setDeletionRequest(data.request || null)
    }
  }

  useEffect(() => {
    (async () => {
      await Promise.all([loadProfile(), loadDeletion()])
      setLoading(false)
    })()
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch('/api/portal/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          birthday: birthday || null,
          preferred_channel: channel,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSaveMsg({ type: 'err', text: data.error || 'Kaydedilemedi' })
      } else {
        setProfile(data.profile)
        setSaveMsg({ type: 'ok', text: 'Profilin güncellendi' })
        setTimeout(() => setSaveMsg(null), 3000)
      }
    } catch (e) {
      setSaveMsg({ type: 'err', text: 'Bağlantı hatası' })
    } finally {
      setSaving(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch('/api/portal/data-export')
      if (!res.ok) {
        alert('Veri indirilemedi')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // Content-Disposition'dan dosya adını al
      const cd = res.headers.get('content-disposition') || ''
      const match = cd.match(/filename="([^"]+)"/)
      a.download = match?.[1] || `pulseapp-veri-${formatDateISO(new Date())}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  async function handleCancelDeletion() {
    setCancelling(true)
    try {
      const res = await fetch('/api/portal/data-deletion', { method: 'DELETE' })
      if (res.ok) {
        setDeletionRequest(null)
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'İptal edilemedi')
      }
    } finally {
      setCancelling(false)
    }
  }

  async function handleLogout() {
    await fetch('/api/portal/logout', { method: 'POST' })
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Ayarlar</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Profilin, iletişim tercihlerin ve verilerin — tek yerden yönet.
        </p>
      </div>

      {/* Profil */}
      <section>
        <SectionHeader title="Profil" icon={User} />
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
              Adın Soyadın
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-pulse-900/30 focus:border-pulse-900"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                <Mail className="h-3.5 w-3.5 inline mr-1" /> E-posta
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@posta.com"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-pulse-900/30 focus:border-pulse-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                <Cake className="h-3.5 w-3.5 inline mr-1" /> Doğum Tarihi
              </label>
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-pulse-900/30 focus:border-pulse-900"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
              Telefon
            </label>
            <input
              type="tel"
              value={profile?.phone || ''}
              disabled
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-500 dark:text-gray-400"
            />
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              Telefon değişikliği için işletmeyle iletişime geç.
            </p>
          </div>

          {saveMsg && (
            <div className={cn(
              'flex items-center gap-2 text-sm rounded-lg p-3',
              saveMsg.type === 'ok'
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
            )}>
              {saveMsg.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {saveMsg.text}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-pulse-900 hover:bg-pulse-800 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Kaydet
          </button>
        </div>
      </section>

      {/* İletişim Tercihleri */}
      <section>
        <SectionHeader
          title="İletişim Tercihi"
          subtitle="Sana nasıl ulaşalım?"
          icon={MessageCircle}
        />
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
          <div className="grid grid-cols-3 gap-2">
            {CHANNEL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setChannel(opt.value)}
                className={cn(
                  'py-3 px-2 rounded-xl border text-center transition-all',
                  channel === opt.value
                    ? 'border-pulse-900 dark:border-pulse-300 bg-pulse-900/5 dark:bg-pulse-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                )}
              >
                <p className={cn(
                  'text-sm font-semibold',
                  channel === opt.value ? 'text-pulse-900 dark:text-pulse-300' : 'text-gray-700 dark:text-gray-300'
                )}>{opt.label}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{opt.subtitle}</p>
              </button>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-pulse-900 hover:bg-pulse-800 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Tercihi Kaydet
          </button>
        </div>
      </section>

      {/* Veri İndirme */}
      <section>
        <SectionHeader
          title="Verilerini İndir"
          subtitle="Tüm profil, randevu, fatura ve diğer kayıtların tek bir JSON dosyası olarak."
          icon={Download}
        />
        <div className="bg-gradient-to-br from-pulse-50 to-indigo-50 dark:from-pulse-900/20 dark:to-indigo-900/20 border border-pulse-100 dark:border-pulse-900/40 rounded-2xl p-5">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Bu dosya KVKK taşınabilirlik hakkın kapsamındadır — başka bir hizmete taşıyabilir veya arşivleyebilirsin.
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-pulse-900 dark:hover:border-pulse-300 text-pulse-900 dark:text-pulse-300 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            JSON Olarak İndir
          </button>
        </div>
      </section>

      {/* Hesap Silme */}
      <section>
        <SectionHeader title="Hesap Silme" icon={Trash2} />
        {deletionRequest ? (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-700 dark:text-amber-300 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Aktif bir silme talebin var
                </p>
                <p className="text-xs text-amber-800/80 dark:text-amber-200/80 mt-1">
                  Planlanan silme tarihi: <strong>{formatDate(deletionRequest.scheduled_deletion_at)}</strong>
                  {' · '}30 gün içinde istediğin zaman iptal edebilirsin.
                </p>
                <button
                  onClick={handleCancelDeletion}
                  disabled={cancelling}
                  className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-800 hover:border-amber-500 text-amber-900 dark:text-amber-200 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Talebi İptal Et
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-red-100 dark:border-red-900/40 p-5">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Hesabını kalıcı olarak silmek istiyor musun?
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
              Silme talebin 30 gün sonra uygulanır — bu süre içinde iptal edebilirsin. Yasal zorunluluk gereği fatura ve sağlık kayıtları saklanabilir.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Hesabımı Silmek İstiyorum
            </button>
          </div>
        )}
      </section>

      {/* Çıkış */}
      <section className="pt-4 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Portalden Çıkış Yap
        </button>
      </section>

      <DataDeletionModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onSubmitted={loadDeletion}
      />
    </div>
  )
}
