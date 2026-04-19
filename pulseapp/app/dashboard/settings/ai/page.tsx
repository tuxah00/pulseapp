'use client'

import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { useTutorial } from '@/lib/hooks/use-tutorial'
import { requirePermission } from '@/lib/hooks/use-require-permission'
import { Loader2, RotateCcw, Save, ShieldCheck, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CustomSelect } from '@/components/ui/custom-select'
import { logAudit } from '@/lib/utils/audit'
import { CUSTOM_INSTRUCTIONS_MAX, DEFAULT_TONE } from '@/lib/ai/assistant-prompts'
import type { AIAssistantTone, AIPermissionCategory, AIPermissions, AIPreferences, BusinessSettings } from '@/types'
import { DEFAULT_AI_PERMISSIONS } from '@/types'

const TONE_OPTIONS: { value: AIAssistantTone; label: string; description: string }[] = [
  { value: 'samimi', label: 'Samimi', description: 'Doğal, sıcak, profesyonel' },
  { value: 'formal', label: 'Resmi', description: 'Siz, rica ederim, arz ederim' },
  { value: 'kisa', label: 'Kısa', description: 'Doğrudan sonuç, gereksiz açıklama yok (varsayılan)' },
]

const DEFAULT_PREFS: AIPreferences = {
  tone: DEFAULT_TONE,
  auto_brief_enabled: false,
  brief_time: '08:00',
  default_reminder_hours: 24,
  custom_instructions: '',
}

/** Her satırda okuma + yazma yetkisi bulunur. */
type PermissionGroup = {
  label: string
  description: string
  read?: AIPermissionCategory
  write?: AIPermissionCategory
}

/** Kullanıcıya gösterilecek yetki kategorileri — 5 tematik grup. */
const PERMISSION_CATEGORIES: { category: string; subtitle: string; groups: PermissionGroup[] }[] = [
  {
    category: 'Müşteri & Randevu',
    subtitle: 'Randevu, müşteri bilgisi ve hizmet listesi',
    groups: [
      { label: 'Randevular', description: 'Randevu listesi, slot, istatistik / oluşturma, iptal, taşıma', read: 'appointments_read', write: 'appointments_write' },
      { label: 'Müşteriler', description: 'Müşteri arama ve profil / müşteri ekleme, güncelleme, silme', read: 'customers_read', write: 'customers_write' },
      { label: 'Hizmetler', description: 'Hizmet listesi ve paketler / hizmet ekleme ve güncelleme', read: 'services_read', write: 'services_write' },
    ],
  },
  {
    category: 'Mesajlaşma & Kampanya',
    subtitle: 'Gelen mesajlar, toplu kampanya ve otomatik mesaj akışları',
    groups: [
      { label: 'Mesajlar', description: 'Bekleyen ve geçmiş mesajlar / asistan üzerinden mesaj gönderme', read: 'messages_read', write: 'messages_write' },
      { label: 'Kampanyalar', description: 'Kampanya listesi ve kitle tahmini / kampanya oluşturma ve gönderme', read: 'campaigns_read', write: 'campaigns_write' },
      { label: 'Otomatik Mesajlar', description: 'Akış listeleme / oluşturma ve aktif/pasif yapma', read: 'workflows_read', write: 'workflows_write' },
    ],
  },
  {
    category: 'Personel & Operasyon',
    subtitle: 'Personel, vardiya ve işletme ayarları',
    groups: [
      { label: 'Personel', description: 'Personel listesi ve performans / personel daveti, yetki değişikliği', read: 'staff_read', write: 'staff_write' },
      { label: 'Vardiya', description: 'Vardiya okuma / vardiya oluşturma ve tanım', read: 'shifts_read', write: 'shifts_write' },
      { label: 'Ayarlar', description: 'İşletme bilgileri ve çalışma saatleri okuma / güncelleme', read: 'settings_read', write: 'settings_write' },
    ],
  },
  {
    category: 'Finans',
    subtitle: 'Fatura, kasa ve gelir-gider',
    groups: [
      { label: 'Faturalar', description: 'Ödenmemiş faturaları listele / fatura oluşturma, ödeme alma', read: 'invoices_read', write: 'invoices_write' },
      { label: 'Kasa', description: 'Kasa işlemi oluşturma', write: 'pos_write' },
      { label: 'Gelir & Gider', description: 'Manuel gelir/gider kaydı', write: 'expenses_write' },
    ],
  },
  {
    category: 'Rapor & Güvenlik',
    subtitle: 'Analitik raporlar ve denetim kaydı',
    groups: [
      { label: 'Analitik', description: 'Gelir, gider, doluluk, performans, karşılaştırma raporları', read: 'analytics_read' },
      { label: 'Denetim Kaydı', description: 'Denetim kayıtlarını okuma', read: 'audit_read' },
    ],
  },
]

export default function AISettingsPage() {
  const supabase = createClient()
  const { confirm } = useConfirm()
  const { businessId, staffId, staffName, permissions, sector, loading: ctxLoading } = useBusinessContext()
  const tutorial = useTutorial(sector)
  const [prefs, setPrefs] = useState<AIPreferences>(DEFAULT_PREFS)
  const [savedPrefs, setSavedPrefs] = useState<AIPreferences>(DEFAULT_PREFS)
  const [aiPermissions, setAiPermissions] = useState<AIPermissions>(DEFAULT_AI_PERMISSIONS)
  const [savedAiPermissions, setSavedAiPermissions] = useState<AIPermissions>(DEFAULT_AI_PERMISSIONS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [tutorialBusy, setTutorialBusy] = useState(false)

  // Sticky save bar
  const saveBtnRef = useRef<HTMLButtonElement>(null)
  const [saveBtnVisible, setSaveBtnVisible] = useState(true)
  const prevSaveBtnVisibleRef = useRef(true)
  const [saveBtnAnimating, setSaveBtnAnimating] = useState(false)
  const isDirty = useMemo(
    () =>
      JSON.stringify(prefs) !== JSON.stringify(savedPrefs) ||
      JSON.stringify(aiPermissions) !== JSON.stringify(savedAiPermissions),
    [prefs, savedPrefs, aiPermissions, savedAiPermissions]
  )

  const fetchPrefs = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    const { data, error: err } = await supabase
      .from('businesses')
      .select('settings')
      .eq('id', businessId)
      .single()

    if (err) {
      setError('Tercihler yüklenemedi: ' + err.message)
    } else {
      const settings = (data?.settings || {}) as BusinessSettings
      const loaded = { ...DEFAULT_PREFS, ...(settings.ai_preferences || {}) }
      setPrefs(loaded)
      setSavedPrefs(loaded)
      const loadedPerms = { ...DEFAULT_AI_PERMISSIONS, ...(settings.ai_permissions || {}) }
      setAiPermissions(loadedPerms)
      setSavedAiPermissions(loadedPerms)
    }
    setLoading(false)
  }, [businessId, supabase])

  useEffect(() => {
    if (!ctxLoading && businessId) fetchPrefs()
  }, [ctxLoading, businessId, fetchPrefs])

  useEffect(() => {
    const el = saveBtnRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setSaveBtnVisible(entry.isIntersecting),
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loading, ctxLoading])

  // Orijinal buton alanı ekrana girdiğinde (false→true) slide-in animasyonu tetikle
  useEffect(() => {
    if (saveBtnVisible && !prevSaveBtnVisibleRef.current) {
      setSaveBtnAnimating(true)
      const t = setTimeout(() => setSaveBtnAnimating(false), 500)
      prevSaveBtnVisibleRef.current = true
      return () => clearTimeout(t)
    }
    if (!saveBtnVisible) {
      prevSaveBtnVisibleRef.current = false
    }
  }, [saveBtnVisible])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!businessId) return
    const snapshot = { ...prefs }
    const permsSnapshot = { ...aiPermissions }
    setSaving(true)
    setError(null)
    setSaveSuccess(false)

    // Fetch current settings to merge (avoid overwriting unrelated keys)
    const { data: biz } = await supabase
      .from('businesses')
      .select('settings')
      .eq('id', businessId)
      .single()

    const current = (biz?.settings || {}) as BusinessSettings
    const mergedSettings: BusinessSettings = {
      ...current,
      ai_preferences: { ...(current.ai_preferences || {}), ...prefs },
      ai_permissions: { ...(current.ai_permissions || {}), ...aiPermissions },
    }

    const { error: upErr } = await supabase
      .from('businesses')
      .update({ settings: mergedSettings })
      .eq('id', businessId)

    if (upErr) {
      setError('Kaydetme hatası: ' + upErr.message)
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: upErr.message } }))
    } else {
      setSaveSuccess(true)
      setSavedPrefs(snapshot)
      setSavedAiPermissions(permsSnapshot)
      setTimeout(() => setSaveSuccess(false), 3000)
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'AI tercihleri kaydedildi' } }))
      logAudit({
        businessId, staffId, staffName,
        action: 'update', resource: 'settings', resourceId: businessId,
        details: { section: 'AI Tercihleri', keys: Object.keys(prefs).join(', ') },
      })
    }
    setSaving(false)
  }

  requirePermission(permissions, 'settings')

  if (loading || ctxLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-pulse-900" />
      </div>
    )
  }

  const charCount = (prefs.custom_instructions || '').length

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      {/* Sticky Save Bar */}
      {isDirty && !saveBtnVisible && (
        <div className="fixed bottom-0 left-0 lg:left-64 right-0 z-40 sticky-save-bar">
          <div className="border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
            <div className="flex items-center justify-end gap-3 px-6 py-4">
              <span className="text-sm text-gray-400 dark:text-gray-500 mr-2">Kaydedilmemiş değişiklikler var</span>
              <button
                type="button"
                onClick={() => { setPrefs(savedPrefs); setAiPermissions(savedAiPermissions) }}
                className="btn-secondary"
              >
                <X className="mr-1.5 h-4 w-4" />
                Değişiklikleri Geri Al
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave({ preventDefault: () => {} } as React.FormEvent)}
                className="btn-primary"
              >
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">AI Asistan Tercihleri</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Asistanın tonu, hatırlatma varsayılanı ve işletmene özel talimatlar.</p>
        </div>
      </header>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Tone */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Üslup</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Asistan yanıtlarının genel tonu.</p>
          <div className="grid sm:grid-cols-3 gap-2">
            {TONE_OPTIONS.map(opt => (
              <button
                type="button"
                key={opt.value}
                onClick={() => setPrefs(p => ({ ...p, tone: opt.value }))}
                className={`text-left rounded-xl border p-3 transition ${
                  prefs.tone === opt.value
                    ? 'border-pulse-900 bg-pulse-900/5 dark:bg-pulse-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{opt.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.description}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Default reminder */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Varsayılan Hatırlatma Zamanı</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Asistan, kullanıcı saat belirtmediğinde bu süreyi kullanır.</p>
          <CustomSelect
            value={String(prefs.default_reminder_hours ?? 24)}
            onChange={v => setPrefs(p => ({ ...p, default_reminder_hours: Number(v) }))}
            options={[
              { value: '2', label: '2 saat önce' },
              { value: '4', label: '4 saat önce' },
              { value: '12', label: '12 saat önce' },
              { value: '24', label: '24 saat önce' },
              { value: '48', label: '48 saat önce' },
              { value: '72', label: '3 gün önce' },
            ]}
          />
        </section>

        {/* Daily brief */}
        <section className="card p-5">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Günlük Brief</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Sabahları özet bildirim (cron aboneliği gerektirir).</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={!!prefs.auto_brief_enabled}
                onChange={e => setPrefs(p => ({ ...p, auto_brief_enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:ring-2 peer-focus:ring-pulse-900/30 rounded-full peer-checked:bg-pulse-900 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
            </label>
          </div>
          {prefs.auto_brief_enabled && (
            <div className="mt-3">
              <label className="text-xs text-gray-600 dark:text-gray-300 block mb-1">Brief Saati</label>
              <CustomSelect
                value={prefs.brief_time || '08:00'}
                onChange={v => setPrefs(p => ({ ...p, brief_time: v }))}
                options={['06:00', '07:00', '08:00', '09:00', '10:00'].map(t => ({ value: t, label: t }))}
              />
            </div>
          )}
        </section>

        {/* Custom instructions */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">İşletmeye Özel Talimatlar</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Asistanın her sohbette hatırlaması gereken özel kurallar. Örnek: &ldquo;Ayşe Hanım&apos;la her zaman resmi konuş&rdquo;, &ldquo;Pazartesi öğleden önce randevu önermeden önce bana sor&rdquo;.
          </p>
          <textarea
            value={prefs.custom_instructions || ''}
            onChange={e => setPrefs(p => ({ ...p, custom_instructions: e.target.value.slice(0, CUSTOM_INSTRUCTIONS_MAX) }))}
            rows={5}
            className="input w-full resize-none"
            placeholder="İsteğe bağlı — asistan her zaman göz önünde bulundursun..."
          />
          <div className="text-right text-[11px] text-gray-400 mt-1 tabular-nums">
            {charCount} / {CUSTOM_INSTRUCTIONS_MAX}
          </div>
        </section>

        {/* Başlangıç ipuçları */}
        <section className="card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Başlangıç İpuçları</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md">
                Her sayfada &ldquo;Kısa bir ipucu ister misin?&rdquo; balonu belirir; tıkladığında asistan o sayfayı açıklar.
                Kapat (X) yalnızca o sayfada gizler, diğer sayfalarda yine çıkar. Tamamen kapatmak için bu ayarı kapatabilirsin.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={tutorial.progress?.enabled !== false}
                disabled={tutorialBusy || tutorial.loading}
                onChange={async (e) => {
                  setTutorialBusy(true)
                  try { await tutorial.setEnabled(e.target.checked) } finally { setTutorialBusy(false) }
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:ring-2 peer-focus:ring-pulse-900/30 rounded-full peer-checked:bg-pulse-900 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-disabled:opacity-50" />
            </label>
          </div>

          {tutorial.seenTopics.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 dark:text-gray-500 mb-2">
                Gördüğün ipuçları
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tutorial.seenTopics.map(t => (
                  <span
                    key={t.pageKey}
                    className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-[11px] text-gray-600 dark:text-gray-300"
                  >
                    {t.title}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {tutorial.progress?.setup_completed_at
                ? 'Kurulum sihirbazı tamamlandı.'
                : 'Kurulum sihirbazı henüz tamamlanmadı.'}
            </p>
            <button
              type="button"
              disabled={tutorialBusy || tutorial.loading}
              onClick={async () => {
                const ok = await confirm({
                  title: 'İpuçlarını sıfırla',
                  message: 'Gördüğün tüm sayfa ipuçları ve kurulum durumu sıfırlanacak. Tekrar baştan başlamak ister misin?',
                  confirmText: 'Sıfırla',
                  cancelText: 'Vazgeç',
                  variant: 'warning',
                })
                if (!ok) return
                setTutorialBusy(true)
                try { await tutorial.reset() } finally { setTutorialBusy(false) }
              }}
              className="inline-flex items-center gap-1.5 text-xs text-pulse-900 dark:text-pulse-300 hover:underline disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              İpuçlarını sıfırla
            </button>
          </div>
        </section>

        {/* AI Asistan Yetkileri */}
        <section className="card p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-pulse-900/10 dark:bg-pulse-300/20 flex items-center justify-center text-pulse-900 dark:text-pulse-300 flex-shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Asistan Yetkileri</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Asistan sadece işaretli yetkilere sahip araçları kullanabilir. Ek olarak onay veren kullanıcının kendi yetkileri de kontrol edilir &mdash; ikisi birden açık değilse işlem yapılmaz.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left py-2 px-2 font-medium text-gray-500 dark:text-gray-400 text-xs">Kategori</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-500 dark:text-gray-400 text-xs w-20">Okuma</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-500 dark:text-gray-400 text-xs w-20">Eylem</th>
                </tr>
              </thead>
              <tbody>
                {PERMISSION_CATEGORIES.map((cat) => (
                  <React.Fragment key={cat.category}>
                    <tr className="bg-gray-50 dark:bg-gray-800/40">
                      <td colSpan={3} className="py-2 px-2">
                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">{cat.category}</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">{cat.subtitle}</div>
                      </td>
                    </tr>
                    {cat.groups.map((g) => (
                      <tr key={g.label} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                        <td className="py-2 px-2 pl-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{g.label}</div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400">{g.description}</div>
                        </td>
                        <td className="py-2 px-2 text-center">
                          {g.read ? (
                            <label className="inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!aiPermissions[g.read]}
                                onChange={(e) => setAiPermissions((p) => ({ ...p, [g.read as AIPermissionCategory]: e.target.checked }))}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:ring-2 peer-focus:ring-pulse-900/30 rounded-full peer-checked:bg-pulse-900 peer-checked:after:translate-x-full after:content-[''] relative after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                            </label>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {g.write ? (
                            <label className="inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!aiPermissions[g.write]}
                                onChange={(e) => setAiPermissions((p) => ({ ...p, [g.write as AIPermissionCategory]: e.target.checked }))}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:ring-2 peer-focus:ring-pulse-900/30 rounded-full peer-checked:bg-pulse-900 peer-checked:after:translate-x-full after:content-[''] relative after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                            </label>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className={cn("flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800", isDirty && saveBtnAnimating && "save-btn-animate")}>
          {saveSuccess && (
            <span className="text-sm text-green-700 dark:text-green-300 mr-2">✓ Kaydedildi</span>
          )}
          {isDirty && (
            <button
              type="button"
              onClick={() => { setPrefs(savedPrefs); setAiPermissions(savedAiPermissions) }}
              className="btn-secondary"
            >
              <X className="mr-1.5 h-4 w-4" />
              Değişiklikleri Geri Al
            </button>
          )}
          <button
            ref={saveBtnRef}
            type="submit"
            disabled={saving || !isDirty}
            className={cn('btn-primary inline-flex items-center gap-2', !isDirty && 'opacity-50 cursor-not-allowed')}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Kaydet
          </button>
        </div>
      </form>
    </div>
  )
}
