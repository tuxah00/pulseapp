'use client'

import { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { useTutorial } from '@/lib/hooks/use-tutorial'
import { Loader2, RotateCcw, Save, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CustomSelect } from '@/components/ui/custom-select'
import { logAudit } from '@/lib/utils/audit'
import { CUSTOM_INSTRUCTIONS_MAX, DEFAULT_TONE } from '@/lib/ai/assistant-prompts'
import type { AIAssistantTone, AIPreferences, BusinessSettings } from '@/types'

const TONE_OPTIONS: { value: AIAssistantTone; label: string; description: string }[] = [
  { value: 'samimi', label: 'Samimi', description: 'Doğal, sıcak, profesyonel (varsayılan)' },
  { value: 'formal', label: 'Resmi', description: 'Siz, rica ederim, arz ederim' },
  { value: 'kisa', label: 'Kısa', description: 'Doğrudan sonuç, gereksiz açıklama yok' },
]

const DEFAULT_PREFS: AIPreferences = {
  tone: DEFAULT_TONE,
  auto_brief_enabled: false,
  brief_time: '08:00',
  default_reminder_hours: 24,
  custom_instructions: '',
}

export default function AISettingsPage() {
  const supabase = createClient()
  const { confirm } = useConfirm()
  const { businessId, staffId, staffName, permissions, sector, loading: ctxLoading } = useBusinessContext()
  const tutorial = useTutorial(sector)
  const [prefs, setPrefs] = useState<AIPreferences>(DEFAULT_PREFS)
  const [savedPrefs, setSavedPrefs] = useState<AIPreferences>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [tutorialBusy, setTutorialBusy] = useState(false)

  // Sticky save bar
  const saveBtnRef = useRef<HTMLButtonElement>(null)
  const [saveBtnVisible, setSaveBtnVisible] = useState(true)
  const isDirty = useMemo(
    () => JSON.stringify(prefs) !== JSON.stringify(savedPrefs),
    [prefs, savedPrefs]
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!businessId) return
    const snapshot = { ...prefs }
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

  if (permissions && !permissions.settings) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">İşletme sahibinizle iletişime geçin.</p>
        </div>
      </div>
    )
  }

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
                onClick={() => setPrefs(savedPrefs)}
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

        {/* Tutorial ipuçları */}
        <section className="card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Tutorial İpuçları</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md">
                Yeni ziyaret ettiğin kritik sayfalarda kısa bir ipucu balonu görünür.
                Kapattığında aynı sayfada bir daha çıkmaz.
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

        {error && (
          <div className="rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
          {saveSuccess && (
            <span className="text-sm text-green-700 dark:text-green-300 mr-2">✓ Kaydedildi</span>
          )}
          {isDirty && (
            <button
              type="button"
              onClick={() => setPrefs(savedPrefs)}
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
