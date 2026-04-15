'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { useTutorial } from '@/lib/hooks/use-tutorial'
import { Loader2, RotateCcw, Save, ShieldCheck, Sparkles } from 'lucide-react'
import { CustomSelect } from '@/components/ui/custom-select'
import { logAudit } from '@/lib/utils/audit'
import { CUSTOM_INSTRUCTIONS_MAX, DEFAULT_TONE } from '@/lib/ai/assistant-prompts'
import type { AIAssistantTone, AIPermissionCategory, AIPermissions, AIPreferences, BusinessSettings } from '@/types'
import { DEFAULT_AI_PERMISSIONS } from '@/types'

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

/** Kullanıcıya gösterilecek yetki grupları. Her grupta okuma + yazma toggle'ları. */
const PERMISSION_GROUPS: {
  label: string
  description: string
  read?: AIPermissionCategory
  write?: AIPermissionCategory
}[] = [
  { label: 'Randevular', description: 'Randevu listesi, slot, istatistik / oluşturma, iptal, taşıma', read: 'appointments_read', write: 'appointments_write' },
  { label: 'Müşteriler', description: 'Müşteri arama ve profil / müşteri ekleme, güncelleme, silme', read: 'customers_read', write: 'customers_write' },
  { label: 'Hizmetler', description: 'Hizmet listesi ve paketler / hizmet ekleme ve güncelleme', read: 'services_read', write: 'services_write' },
  { label: 'Personel', description: 'Personel listesi ve performans / personel daveti, yetki değişikliği', read: 'staff_read', write: 'staff_write' },
  { label: 'Vardiya', description: 'Vardiya okuma / vardiya oluşturma ve tanım', read: 'shifts_read', write: 'shifts_write' },
  { label: 'Mesajlar', description: 'Bekleyen ve geçmiş mesajlar / asistan üzerinden mesaj gönderme', read: 'messages_read', write: 'messages_write' },
  { label: 'Kampanyalar', description: 'Kampanya listesi ve kitle tahmini / kampanya oluşturma ve gönderme', read: 'campaigns_read', write: 'campaigns_write' },
  { label: 'Mesaj akışları', description: 'Workflow listeleme / oluşturma ve aktif/pasif yapma', read: 'workflows_read', write: 'workflows_write' },
  { label: 'Analitik', description: 'Gelir, gider, doluluk, performans, karşılaştırma raporları', read: 'analytics_read' },
  { label: 'Faturalar', description: 'Ödenmemiş faturaları listele / fatura oluşturma, ödeme alma', read: 'invoices_read', write: 'invoices_write' },
  { label: 'Kasa (POS)', description: 'Kasa işlemi oluşturma', write: 'pos_write' },
  { label: 'Gelir & Gider', description: 'Manuel gelir/gider kaydı', write: 'expenses_write' },
  { label: 'Ayarlar', description: 'İşletme bilgileri ve çalışma saatleri okuma / güncelleme', read: 'settings_read', write: 'settings_write' },
  { label: 'Denetim kaydı', description: 'Denetim kayıtlarını okuma', read: 'audit_read' },
]

export default function AISettingsPage() {
  const supabase = createClient()
  const { confirm } = useConfirm()
  const { businessId, staffId, staffName, permissions, loading: ctxLoading } = useBusinessContext()
  const tutorial = useTutorial()
  const [prefs, setPrefs] = useState<AIPreferences>(DEFAULT_PREFS)
  const [aiPermissions, setAiPermissions] = useState<AIPermissions>(DEFAULT_AI_PERMISSIONS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [tutorialBusy, setTutorialBusy] = useState(false)

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
      setPrefs({ ...DEFAULT_PREFS, ...(settings.ai_preferences || {}) })
      setAiPermissions({ ...DEFAULT_AI_PERMISSIONS, ...(settings.ai_permissions || {}) })
    }
    setLoading(false)
  }, [businessId, supabase])

  useEffect(() => {
    if (!ctxLoading && businessId) fetchPrefs()
  }, [ctxLoading, businessId, fetchPrefs])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!businessId) return
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
                  <th className="text-center py-2 px-2 font-medium text-gray-500 dark:text-gray-400 text-xs w-20">Yazma</th>
                </tr>
              </thead>
              <tbody>
                {PERMISSION_GROUPS.map((g) => (
                  <tr key={g.label} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                    <td className="py-2 px-2">
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
              </tbody>
            </table>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          {saveSuccess && (
            <span className="text-sm text-green-700 dark:text-green-300">✓ Kaydedildi</span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Kaydet
          </button>
        </div>
      </form>
    </div>
  )
}
