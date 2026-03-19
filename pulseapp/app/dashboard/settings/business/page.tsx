'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import {
  Loader2, Save, Building2, Clock, Bell, Sparkles,
  CreditCard, MapPin, Phone, Mail, Globe,
  MessageSquare, ChevronDown, ChevronUp, Sun, Moon,
} from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import {
  SECTOR_LABELS, PLAN_LABELS, PLAN_PRICES,
  type Business, type SectorType, type WorkingHours, type DayHours, type BusinessSettings,
} from '@/types'
import { formatCurrency } from '@/lib/utils'

const DAY_LABELS: Record<string, string> = {
  mon: 'Pazartesi',
  tue: 'Salı',
  wed: 'Çarşamba',
  thu: 'Perşembe',
  fri: 'Cuma',
  sat: 'Cumartesi',
  sun: 'Pazar',
}

const DAY_KEYS: (keyof WorkingHours)[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const DEFAULT_WORKING_HOURS: WorkingHours = {
  mon: { open: '09:00', close: '18:00' },
  tue: { open: '09:00', close: '18:00' },
  wed: { open: '09:00', close: '18:00' },
  thu: { open: '09:00', close: '18:00' },
  fri: { open: '09:00', close: '18:00' },
  sat: { open: '10:00', close: '16:00' },
  sun: null,
}

const DEFAULT_SETTINGS: BusinessSettings = {
  reminder_24h: true,
  reminder_2h: true,
  auto_review_request: true,
  review_request_delay_minutes: 60,
  winback_days: 30,
  ai_auto_reply: false,
  language: 'tr',
}

function generateTimeOptions(): string[] {
  const times: string[] = []
  for (let h = 0; h < 24; h++) {
    times.push(`${String(h).padStart(2, '0')}:00`)
    times.push(`${String(h).padStart(2, '0')}:30`)
  }
  return times
}

const TIME_OPTIONS = generateTimeOptions()

type TabId = 'info' | 'hours' | 'settings' | 'subscription'

export default function BusinessSettingsPage() {
  const { businessId, loading: ctxLoading } = useBusinessContext()
  const supabase = createClient()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()

  const [business, setBusiness] = useState<Business | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('info')

  // İşletme bilgileri formu
  const [name, setName] = useState('')
  const [sector, setSector] = useState<SectorType>('other')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [googleMapsUrl, setGoogleMapsUrl] = useState('')

  // Çalışma saatleri
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS)

  // Ayarlar
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS)

  const fetchBusiness = useCallback(async () => {
    if (!businessId) return
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single()

    if (error) {
      console.error('İşletme bilgisi çekme hatası:', error)
      setLoading(false)
      return
    }

    if (data) {
      setBusiness(data)
      setName(data.name || '')
      setSector(data.sector || 'other')
      setPhone(data.phone || '')
      setEmail(data.email || '')
      setAddress(data.address || '')
      setCity(data.city || '')
      setDistrict(data.district || '')
      setGoogleMapsUrl(data.google_maps_url || '')
      setWorkingHours(data.working_hours || DEFAULT_WORKING_HOURS)
      setSettings({ ...DEFAULT_SETTINGS, ...(data.settings || {}) })
    }
    setLoading(false)
  }, [businessId])

  useEffect(() => {
    if (!ctxLoading) fetchBusiness()
  }, [fetchBusiness, ctxLoading])

  function updateDayHours(day: keyof WorkingHours, field: 'open' | 'close', value: string) {
    setWorkingHours(prev => ({
      ...prev,
      [day]: { ...(prev[day] || { open: '09:00', close: '18:00' }), [field]: value },
    }))
  }

  function toggleDay(day: keyof WorkingHours) {
    setWorkingHours(prev => ({
      ...prev,
      [day]: prev[day] ? null : { open: '09:00', close: '18:00' },
    }))
  }

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault()
    await saveBusiness({
      name,
      sector,
      phone: phone || null,
      email: email || null,
      address: address || null,
      city: city || null,
      district: district || null,
      google_maps_url: googleMapsUrl || null,
    })
    window.location.reload()
  }

  async function handleSaveHours(e: React.FormEvent) {
    e.preventDefault()
    await saveBusiness({ working_hours: workingHours })
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    await saveBusiness({ settings })
  }

  async function saveBusiness(updates: Record<string, any>) {
    if (!businessId) return
    setSaving(true)
    setError(null)
    setSaveSuccess(false)

    const { error } = await supabase
      .from('businesses')
      .update(updates)
      .eq('id', businessId)

    if (error) {
      setError('Kaydetme hatası: ' + error.message)
    } else {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      fetchBusiness()
      router.refresh()
    }
    setSaving(false)
  }

  if (loading || ctxLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-pulse-500" />
      </div>
    )
  }

  if (!business) {
    return (
      <div className="card flex flex-col items-center justify-center py-16">
        <Building2 className="mb-4 h-12 w-12 text-gray-300" />
        <p className="text-gray-500">İşletme bilgisi bulunamadı.</p>
      </div>
    )
  }

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'info', label: 'İşletme Bilgileri', icon: <Building2 className="h-4 w-4" /> },
    { id: 'hours', label: 'Çalışma Saatleri', icon: <Clock className="h-4 w-4" /> },
    { id: 'settings', label: 'Bildirim & AI', icon: <Bell className="h-4 w-4" /> },
    { id: 'subscription', label: 'Abonelik', icon: <CreditCard className="h-4 w-4" /> },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">İşletme Ayarları</h1>
        <p className="mt-1 text-sm text-gray-500">
          İşletmenizin bilgilerini, çalışma saatlerini ve tercihlerini yönetin.
        </p>
      </div>

      {/* Başarı / Hata mesajları */}
      {saveSuccess && (
        <div className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Değişiklikler başarıyla kaydedildi.
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tab Navigasyonu */}
      <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* İşletme Bilgileri */}
      {activeTab === 'info' && (
        <form onSubmit={handleSaveInfo}>
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Temel Bilgiler</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="businessName" className="label">İşletme Adı</label>
                  <input
                    id="businessName"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Sektör</label>
                  <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value as SectorType)}
                    className="input"
                  >
                    {(Object.entries(SECTOR_LABELS) as [SectorType, string][]).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-amber-600">Sektör değişikliği sidebar menüsünü etkiler. Kaydet sonrası sayfa yenilenir.</p>
                </div>
                <div>
                  <label htmlFor="businessPhone" className="label">Telefon</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="businessPhone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input pl-10"
                      placeholder="0532 123 45 67"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="businessEmail" className="label">E-posta</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="businessEmail"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input pl-10"
                      placeholder="info@isletme.com"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Adres Bilgileri</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="address" className="label">Adres</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <textarea
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="input pl-10"
                      rows={2}
                      placeholder="Cadde, sokak, bina no..."
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="city" className="label">Şehir</label>
                  <input
                    id="city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="input"
                    placeholder="İstanbul"
                  />
                </div>
                <div>
                  <label htmlFor="district" className="label">İlçe</label>
                  <input
                    id="district"
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="input"
                    placeholder="Kadıköy"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="googleMaps" className="label">Google Maps Linki</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="googleMaps"
                      type="url"
                      value={googleMapsUrl}
                      onChange={(e) => setGoogleMapsUrl(e.target.value)}
                      className="input pl-10"
                      placeholder="https://maps.google.com/..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Görünüm */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Görünüm</h2>
              <p className="text-sm text-gray-500 mb-4">Uygulama temasını kişiselleştirin.</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {theme === 'dark' ? (
                    <Moon className="h-5 w-5 text-pulse-400" />
                  ) : (
                    <Sun className="h-5 w-5 text-amber-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {theme === 'dark' ? 'Karanlık Mod' : 'Aydınlık Mod'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {theme === 'dark' ? 'Koyu arka plan kullanılıyor' : 'Açık arka plan kullanılıyor'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-pulse-500 focus:ring-offset-2 ${
                    theme === 'dark' ? 'bg-pulse-500' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      theme === 'dark' ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Bilgileri Kaydet
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Çalışma Saatleri */}
      {activeTab === 'hours' && (
        <form onSubmit={handleSaveHours}>
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Çalışma Saatleri</h2>
            <p className="text-sm text-gray-500 mb-6">
              İşletmenizin açık olduğu gün ve saatleri belirleyin.
            </p>

            <div className="space-y-3">
              {DAY_KEYS.map((day) => {
                const hours = workingHours[day]
                const isOpen = hours !== null

                return (
                  <div
                    key={day}
                    className={`flex items-center gap-4 rounded-lg border p-4 transition-colors ${
                      isOpen ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <div className="w-28 flex-shrink-0">
                      <span className={`text-sm font-medium ${isOpen ? 'text-gray-900' : 'text-gray-400'}`}>
                        {DAY_LABELS[day]}
                      </span>
                    </div>

                    <label className="relative inline-flex cursor-pointer items-center flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={isOpen}
                        onChange={() => toggleDay(day)}
                        className="peer sr-only"
                      />
                      <div className="h-6 w-11 rounded-full bg-gray-300 dark:bg-gray-600 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-pulse-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-2 peer-focus:ring-pulse-300" />
                    </label>

                    {isOpen ? (
                      <div className="flex flex-1 items-center gap-2">
                        <select
                          value={hours?.open || '09:00'}
                          onChange={(e) => updateDayHours(day, 'open', e.target.value)}
                          className="input w-28"
                        >
                          {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <span className="text-sm text-gray-400">—</span>
                        <select
                          value={hours?.close || '18:00'}
                          onChange={(e) => updateDayHours(day, 'close', e.target.value)}
                          className="input w-28"
                        >
                          {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Kapalı</span>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-6 flex justify-end">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Saatleri Kaydet
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Bildirim & AI Ayarları */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings}>
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Hatırlatma Bildirimleri</h2>
              <p className="text-sm text-gray-500 mb-6">
                Müşterilerinize otomatik randevu hatırlatmaları gönderin.
              </p>

              <div className="space-y-4">
                <ToggleSetting
                  label="24 saat önce hatırlatma"
                  description="Randevudan bir gün önce hatırlatma gönderilir."
                  checked={settings.reminder_24h}
                  onChange={(v) => setSettings(prev => ({ ...prev, reminder_24h: v }))}
                />
                <ToggleSetting
                  label="2 saat önce hatırlatma"
                  description="Randevudan 2 saat önce hatırlatma gönderilir."
                  checked={settings.reminder_2h}
                  onChange={(v) => setSettings(prev => ({ ...prev, reminder_2h: v }))}
                />
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Yorum & Geri Bildirim</h2>
              <p className="text-sm text-gray-500 mb-6">
                Randevu sonrası müşteri memnuniyet anketi gönderin.
              </p>

              <div className="space-y-4">
                <ToggleSetting
                  label="Otomatik yorum talebi"
                  description="Randevu tamamlandığında müşteriye yorum bağlantısı gönderilir."
                  checked={settings.auto_review_request}
                  onChange={(v) => setSettings(prev => ({ ...prev, auto_review_request: v }))}
                />

                {settings.auto_review_request && (
                  <div className="ml-14">
                    <label className="label">Gönderim gecikmesi</label>
                    <select
                      value={settings.review_request_delay_minutes}
                      onChange={(e) => setSettings(prev => ({ ...prev, review_request_delay_minutes: Number(e.target.value) }))}
                      className="input w-48"
                    >
                      <option value={30}>30 dakika sonra</option>
                      <option value={60}>1 saat sonra</option>
                      <option value={120}>2 saat sonra</option>
                      <option value={1440}>1 gün sonra</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Müşteri Geri Kazanımı</h2>
              <p className="text-sm text-gray-500 mb-6">
                Uzun süredir gelmeyen müşterileri geri kazanmak için otomatik mesaj gönderin.
              </p>

              <div>
                <label className="label">Gelmeme süresi eşiği</label>
                <select
                  value={settings.winback_days}
                  onChange={(e) => setSettings(prev => ({ ...prev, winback_days: Number(e.target.value) }))}
                  className="input w-48"
                >
                  <option value={14}>14 gün</option>
                  <option value={21}>21 gün</option>
                  <option value={30}>30 gün</option>
                  <option value={45}>45 gün</option>
                  <option value={60}>60 gün</option>
                  <option value={90}>90 gün</option>
                </select>
                <p className="mt-1.5 text-xs text-gray-400">
                  Bu süreden uzun süre gelmeyen müşteriler &quot;riskli&quot; olarak işaretlenir.
                </p>
              </div>
            </div>

            <div className="card border-purple-200 bg-gradient-to-br from-purple-50/50 to-white dark:from-gray-800 dark:to-gray-800 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">AI Asistan</h2>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                Claude AI ile gelen mesajlara otomatik yanıt verin.
              </p>

              <ToggleSetting
                label="AI otomatik yanıt"
                description="Gelen mesajları AI sınıflandırır ve uygun yanıt önerisi oluşturur. Randevu talepleri otomatik işlenir."
                checked={settings.ai_auto_reply}
                onChange={(v) => setSettings(prev => ({ ...prev, ai_auto_reply: v }))}
              />

              {settings.ai_auto_reply && (
                <div className="mt-4 rounded-lg bg-purple-50 border border-purple-100 px-4 py-3 text-sm text-purple-700">
                  AI asistan aktif olduğunda, gelen mesajlar otomatik olarak sınıflandırılır
                  (randevu talebi, soru, şikayet vb.) ve uygun yanıt önerisi oluşturulur.
                  Yanıtlar onayınız olmadan gönderilmez.
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Ayarları Kaydet
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Abonelik */}
      {activeTab === 'subscription' && (
        <div className="space-y-6">
          {/* Mevcut plan */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Mevcut Abonelik</h2>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pulse-100">
                <CreditCard className="h-6 w-6 text-pulse-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">
                  {PLAN_LABELS[business.subscription_plan]} Plan
                </p>
                <p className="text-sm text-gray-500">
                  Durum:{' '}
                  <span className={`font-medium ${
                    business.subscription_status === 'active' || business.subscription_status === 'trial'
                      ? 'text-green-600'
                      : 'text-amber-600'
                  }`}>
                    {business.subscription_status === 'trial' && 'Deneme Süreci'}
                    {business.subscription_status === 'active' && 'Aktif'}
                    {business.subscription_status === 'past_due' && 'Ödeme Bekliyor'}
                    {business.subscription_status === 'cancelled' && 'İptal Edildi'}
                    {business.subscription_status === 'expired' && 'Süresi Doldu'}
                  </span>
                </p>
                {business.trial_ends_at && business.subscription_status === 'trial' && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Deneme bitiş: {new Date(business.trial_ends_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-price">
                  {formatCurrency(PLAN_PRICES[business.subscription_plan])}
                </p>
                <p className="text-xs text-gray-400">/ ay</p>
              </div>
            </div>
          </div>

          {/* Plan karşılaştırma */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Planları Karşılaştır</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <PlanCard
                name="Başlangıç"
                price={499}
                current={business.subscription_plan === 'starter'}
                features={[
                  '100 müşteri',
                  '200 randevu/ay',
                  'Otomatik hatırlatma',
                  'Temel analitik',
                ]}
              />
              <PlanCard
                name="Standart"
                price={999}
                current={business.subscription_plan === 'standard'}
                popular
                features={[
                  '500 müşteri',
                  'Sınırsız randevu',
                  'AI mesaj yanıtlama',
                  'Google Yorum entegrasyonu',
                  'Gelişmiş analitik',
                ]}
              />
              <PlanCard
                name="Asistan Pro"
                price={1999}
                current={business.subscription_plan === 'pro'}
                features={[
                  'Sınırsız müşteri',
                  'Sınırsız randevu',
                  'AI tam otomasyon',
                  'Çoklu personel',
                  'API erişimi',
                  'Öncelikli destek',
                ]}
              />
            </div>
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
            Plan değişikliği ve ödeme sistemi yakında aktif olacaktır. Sorularınız için
            destek@pulseapp.com.tr adresine yazabilirsiniz.
          </div>
        </div>
      )}
    </div>
  )
}

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
        <div className="h-6 w-11 rounded-full bg-gray-300 dark:bg-gray-600 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-pulse-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-2 peer-focus:ring-pulse-300" />
      </label>
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
    </div>
  )
}

function PlanCard({
  name,
  price,
  features,
  current,
  popular,
}: {
  name: string
  price: number
  features: string[]
  current?: boolean
  popular?: boolean
}) {
  return (
    <div
      className={`relative flex flex-col rounded-xl border p-6 ${
        current
          ? 'border-pulse-500 bg-pulse-50/30 dark:bg-gray-700/50 ring-1 ring-pulse-500'
          : popular
          ? 'border-purple-200 bg-white'
          : 'border-gray-200 bg-white'
      }`}
    >
      {popular && !current && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-purple-600 px-3 py-1 text-xs font-medium text-white">
            Popüler
          </span>
        </div>
      )}
      {current && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-pulse-600 px-3 py-1 text-xs font-medium text-white">
            Mevcut Plan
          </span>
        </div>
      )}

      <div className="text-center mb-4">
        <h3 className="font-semibold text-gray-900">{name}</h3>
        <div className="mt-2">
          <span className="text-3xl font-bold text-price">{formatCurrency(price)}</span>
          <span className="text-sm text-gray-400"> / ay</span>
        </div>
      </div>

      <ul className="flex-1 space-y-2.5 mb-6">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
            <svg className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      <button
        disabled={current}
        className={`mt-auto w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
          current
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : popular
            ? 'bg-purple-600 text-white hover:bg-purple-700'
            : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        {current ? 'Mevcut Planınız' : 'Plan Seç'}
      </button>
    </div>
  )
}
