'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { logAudit } from '@/lib/utils/audit'
import { Loader2, Save, ToggleRight, Gift } from 'lucide-react'
import type { BusinessSettings } from '@/types'

function ToggleSetting({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-start gap-4">
      <label className="relative inline-flex cursor-pointer items-center mt-0.5 flex-shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <div className="h-6 w-11 rounded-full bg-gray-300 dark:bg-gray-600 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-pulse-900 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-2 peer-focus:ring-pulse-300" />
      </label>
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
      </div>
    </div>
  )
}

export default function FeaturesSettingsPage() {
  const { businessId, staffId, staffName, loading: ctxLoading, permissions } = useBusinessContext()
  const supabase = createClient()
  const [settings, setSettings] = useState<Partial<BusinessSettings>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    const { data } = await supabase
      .from('businesses')
      .select('settings')
      .eq('id', businessId)
      .single()
    setSettings((data?.settings as Partial<BusinessSettings>) || {})
    setLoading(false)
  }, [businessId, supabase])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!businessId) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('businesses')
        .update({ settings })
        .eq('id', businessId)
      if (error) throw error
      await logAudit({
        businessId,
        staffId: staffId || '',
        staffName: staffName || '',
        action: 'update',
        resource: 'settings',
        details: { section: 'features', rewards_enabled: settings.rewards_enabled === true },
      })
      setSavedAt(Date.now())
      // Sidebar'ın anında güncellenmesi için sayfayı yenile
      setTimeout(() => { window.location.reload() }, 400)
    } catch (err: any) {
      alert('Kaydedilemedi: ' + (err?.message || 'Bilinmeyen hata'))
    } finally {
      setSaving(false)
    }
  }

  if (ctxLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-pulse-900" />
      </div>
    )
  }

  if (permissions && !permissions.settings) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-gray-500 dark:text-gray-400">Bu sayfaya erişim yetkiniz yok.</p>
      </div>
    )
  }

  const rewardsOn = settings.rewards_enabled === true

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center text-white shadow-sm">
            <ToggleRight className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Özellikler</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              İşletmenizde aktif olmasını istediğiniz opsiyonel modülleri buradan yönetin.
            </p>
          </div>
        </div>
      </header>

      <div className="card">
        <div className="flex items-center gap-2 mb-1">
          <Gift className="w-4 h-4 text-pulse-900 dark:text-pulse-300" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Ödüller Sistemi</h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Müşterilere ödül (indirim, hediye, ücretsiz hizmet) tanımlama ve atama modülü.
          Kapatılırsa Ödüller sayfası ve müşteri portalındaki ödül sekmesi gizlenir.
        </p>

        <ToggleSetting
          label={rewardsOn ? 'Açık' : 'Kapalı'}
          description={
            rewardsOn
              ? 'Ödüller modülü aktif. Sol menüde ve müşteri portalında görünür.'
              : 'Ödüller modülü kapalı. Açmak için anahtarı işaretleyin.'
          }
          checked={rewardsOn}
          onChange={(v) => setSettings(prev => ({ ...prev, rewards_enabled: v }))}
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        {savedAt && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">Kaydedildi ✓</span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Kaydet
        </button>
      </div>
    </div>
  )
}
