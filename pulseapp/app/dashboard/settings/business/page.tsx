'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import {
  Loader2, Save, Building2, Bell, Sparkles, Cake,
  CreditCard, MapPin, Phone, Mail, Globe,
  MessageSquare, ChevronDown, ChevronUp, Camera, X, Smartphone,
  DoorOpen, Plus, Pencil, Trash2, Users,
} from 'lucide-react'
import {
  SECTOR_LABELS, PLAN_LABELS, PLAN_PRICES,
  type Business, type SectorType, type WorkingHours, type DayHours, type BusinessSettings,
  type Room,
} from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import { Portal } from '@/components/ui/portal'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { CustomSelect } from '@/components/ui/custom-select'
import { logAudit } from '@/lib/utils/audit'

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
  reservation_duration_minutes: 90,
  birthday_sms_enabled: false,
  birthday_sms_template: 'Doğum gününüz kutlu olsun {name}! 🎂 Size özel sürprizimiz var, bizi ziyaret edin!',
  birthday_sms_hour: 9,
  confirmation_sms_enabled: false,
  no_show_auto_score: true,
  max_no_shows: 3,
  periodic_reminder_enabled: false,
  periodic_reminder_advance_days: 3,
  gap_fill_enabled: false,
  gap_fill_lookback_months: 6,
  loyalty_enabled: false,
  points_per_currency: 1,
  visit_bonus_points: 50,
  auto_reward_threshold: 500,
  redemption_rate: 10,
  whatsapp_enabled: false,
  whatsapp_mode: 'sandbox',
  default_channel: 'auto',
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

type TabId = 'info' | 'settings' | 'rooms' | 'subscription'

const ROOM_COLORS = ['#6366f1', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4']

export default function BusinessSettingsPage() {
  const { businessId, staffId: currentStaffId, staffName: currentStaffName, loading: ctxLoading, permissions } = useBusinessContext()
  const supabase = createClient()
  const router = useRouter()
  const { confirm } = useConfirm()

  const [business, setBusiness] = useState<Business | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('info')

  // Logo
  const [logoUploading, setLogoUploading] = useState(false)

  // Odalar
  const [rooms, setRooms] = useState<Room[]>([])
  const [roomsLoading, setRoomsLoading] = useState(false)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [isClosingRoomModal, setIsClosingRoomModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [roomName, setRoomName] = useState('')
  const [roomCapacity, setRoomCapacity] = useState(1)
  const [roomColor, setRoomColor] = useState('#6366f1')
  const [roomSaving, setRoomSaving] = useState(false)

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
  const [savedSettings, setSavedSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS)

  // Sticky save bar
  const saveBtnRef = useRef<HTMLButtonElement>(null)
  const [saveBtnVisible, setSaveBtnVisible] = useState(true)
  const prevSaveBtnVisibleRef = useRef(true)
  const [saveBtnAnimating, setSaveBtnAnimating] = useState(false)
  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [settings, savedSettings]
  )

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
      const loadedSettings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) }
      setSettings(loadedSettings)
      setSavedSettings(loadedSettings)
    }
    setLoading(false)
  }, [businessId])

  useEffect(() => {
    if (!ctxLoading) fetchBusiness()
  }, [fetchBusiness, ctxLoading])

  const fetchRooms = useCallback(async () => {
    if (!businessId) return
    setRoomsLoading(true)
    try {
      const res = await fetch('/api/rooms')
      if (res.ok) {
        const { rooms: data } = await res.json()
        setRooms(data || [])
      }
    } catch (err) {
      console.error('Oda listesi çekme hatası:', err)
    }
    setRoomsLoading(false)
  }, [businessId])

  // IntersectionObserver: orijinal kaydet butonu görünürse floating bar gizlenir
  useEffect(() => {
    const el = saveBtnRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setSaveBtnVisible(entry.isIntersecting),
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [activeTab])

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

  useEffect(() => {
    if (businessId) fetchRooms()
  }, [fetchRooms, businessId])

  function resetRoomForm() {
    setRoomName('')
    setRoomCapacity(1)
    setRoomColor('#6366f1')
    setEditingRoom(null)
    setIsClosingRoomModal(true)
  }

  function openNewRoomModal() {
    setRoomName('')
    setRoomCapacity(1)
    setRoomColor('#6366f1')
    setEditingRoom(null)
    setShowRoomModal(true)
  }

  function openEditRoomModal(room: Room) {
    setRoomName(room.name)
    setRoomCapacity(room.capacity)
    setRoomColor(room.color)
    setEditingRoom(room)
    setShowRoomModal(true)
  }

  async function handleSaveRoom() {
    if (!roomName.trim()) return
    setRoomSaving(true)
    setError(null)
    try {
      if (editingRoom) {
        const res = await fetch(`/api/rooms?id=${editingRoom.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: roomName.trim(), capacity: roomCapacity, color: roomColor }),
        })
        if (!res.ok) {
          const { error: msg } = await res.json()
          setError(msg || 'Oda güncellenemedi')
        } else {
          resetRoomForm()
          fetchRooms()
        }
      } else {
        const res = await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: roomName.trim(), capacity: roomCapacity, color: roomColor }),
        })
        if (!res.ok) {
          const { error: msg } = await res.json()
          setError(msg || 'Oda eklenemedi')
        } else {
          resetRoomForm()
          fetchRooms()
        }
      }
    } catch {
      setError('Bir hata oluştu')
    }
    setRoomSaving(false)
  }

  async function handleDeleteRoom(id: string) {
    const ok = await confirm({
      title: 'Odayı Sil',
      message: 'Bu odayı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
      confirmText: 'Sil',
      cancelText: 'İptal',
      variant: 'danger',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/rooms?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchRooms()
      } else {
        const { error: msg } = await res.json()
        setError(msg || 'Oda silinemedi')
      }
    } catch {
      setError('Bir hata oluştu')
    }
  }

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
  }

  async function handleSaveHours(e: React.FormEvent) {
    e.preventDefault()
    await saveBusiness({ working_hours: workingHours })
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    const snapshot = { ...settings }
    const ok = await saveBusiness({ settings })
    if (ok) setSavedSettings(snapshot)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/business/logo', { method: 'POST', body: fd })
    if (res.ok) {
      fetchBusiness()
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Kaydedildi' } }))
    } else {
      const { error } = await res.json()
      setError(error || 'Logo yüklenemedi')
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: error || 'Logo yüklenemedi' } }))
    }
    setLogoUploading(false)
    e.target.value = ''
  }

  async function handleLogoRemove() {
    await fetch('/api/business/logo', { method: 'DELETE' })
    fetchBusiness()
    window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Silindi' } }))
  }

  async function saveBusiness(updates: Record<string, any>): Promise<boolean> {
    if (!businessId) return false
    setSaving(true)
    setError(null)
    setSaveSuccess(false)

    const { error } = await supabase
      .from('businesses')
      .update(updates)
      .eq('id', businessId)

    if (error) {
      setError('Kaydetme hatası: ' + error.message)
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: 'Kaydetme hatası: ' + error.message } }))
      setSaving(false)
      return false
    } else {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      fetchBusiness()
      router.refresh()
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Kaydedildi' } }))
      logAudit({ businessId: businessId!, staffId: currentStaffId, staffName: currentStaffName, action: 'update', resource: 'settings', resourceId: businessId!, details: { section: 'İşletme Bilgileri', fields: Object.keys(updates).join(', ') } })
      setSaving(false)
      return true
    }
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
    { id: 'settings', label: 'Bildirim & AI', icon: <Bell className="h-4 w-4" /> },
    { id: 'rooms', label: 'Odalar', icon: <DoorOpen className="h-4 w-4" /> },
    { id: 'subscription', label: 'Abonelik', icon: <CreditCard className="h-4 w-4" /> },
  ]

  return (
    <div>
      {/* Sticky Save Bar — alttan yükselen şerit, sidebar hariç content alanı */}
      {activeTab === 'settings' && isDirty && !saveBtnVisible && (
        <div className="fixed bottom-0 left-0 lg:left-64 right-0 z-40 sticky-save-bar">
          <div className="border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
            <div className="flex items-center justify-end gap-3 px-6 py-4">
              <span className="text-sm text-gray-400 dark:text-gray-500 mr-2">Kaydedilmemiş değişiklikler var</span>
              <button
                type="button"
                onClick={() => setSettings(savedSettings)}
                className="btn-secondary"
              >
                <X className="mr-1.5 h-4 w-4" />
                Değişiklikleri Geri Al
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveSettings({ preventDefault: () => {} } as React.FormEvent)}
                className="btn-primary"
              >
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                Ayarları Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

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
      <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
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
            {/* Logo */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">İşletme Logosu</h2>
              <div className="flex items-center gap-5">
                <div className="relative flex-shrink-0">
                  {settings.logo_url ? (
                    <img
                      src={settings.logo_url}
                      alt="Logo"
                      className="h-20 w-20 rounded-2xl object-cover border border-gray-200 dark:border-gray-700"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-pulse-100 dark:bg-pulse-900/30 text-pulse-900 dark:text-pulse-400 text-2xl font-bold border-2 border-dashed border-pulse-300 dark:border-pulse-700">
                      {name.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                  {settings.logo_url && (
                    <button
                      type="button"
                      onClick={handleLogoRemove}
                      className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Profil Fotoğrafı</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">JPG, PNG veya WebP. Maks 5 MB.<br />Müşteri randevu sayfasında görünür.</p>
                  <label className="btn-secondary text-sm cursor-pointer flex items-center gap-2 w-fit">
                    {logoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    {logoUploading ? 'Yükleniyor...' : 'Fotoğraf Seç'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleLogoUpload}
                      disabled={logoUploading}
                    />
                  </label>
                </div>
              </div>
            </div>

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
                  <CustomSelect
                    options={(Object.entries(SECTOR_LABELS) as [SectorType, string][]).map(([value, label]) => ({ value, label }))}
                    value={sector}
                    onChange={v => setSector(v as SectorType)}
                  />
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

            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Bilgileri Kaydet
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Bildirim & AI Ayarları */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings}>
          <div className="space-y-6">
            {/* ── BÖLÜM 1: İletişim (SMS / WhatsApp / Hatırlatma) ── */}
            <SectionHeader
              icon={<Bell className="h-4 w-4" />}
              title="İletişim"
              subtitle="Müşterilere ne zaman ve nasıl mesaj gittiğini yönetin"
            />

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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Randevu Onay & No-Show</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Müşterilerden randevu onayı isteyin ve no-show takibi yapın.
              </p>

              <div className="space-y-4">
                <ToggleSetting
                  label="Onay SMS'i gönder"
                  description="24 saat önce 'EVET/HAYIR' ile yanıtlanabilen onay mesajı gönderilir. Kapalıysa sadece hatırlatma gönderilir."
                  checked={settings.confirmation_sms_enabled ?? false}
                  onChange={(v) => setSettings(prev => ({ ...prev, confirmation_sms_enabled: v }))}
                />
                <ToggleSetting
                  label="Otomatik no-show skoru"
                  description="Gelmeyen müşterilere otomatik risk skoru atanır."
                  checked={settings.no_show_auto_score ?? true}
                  onChange={(v) => setSettings(prev => ({ ...prev, no_show_auto_score: v }))}
                />

                {(settings.no_show_auto_score ?? true) && (
                  <div className="ml-14">
                    <label className="label">Maksimum gelmeme sayısı</label>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Bu sayıya ulaşan müşteriler randevu sayfasında uyarı ile gösterilir.</p>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      className="input w-24"
                      value={settings.max_no_shows ?? 3}
                      onChange={(e) => setSettings(prev => ({ ...prev, max_no_shows: Number(e.target.value) || 3 }))}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ── BÖLÜM 2: Otomasyon (otomatik hatırlatıcılar ve akıllı doldurma) ── */}
            <SectionHeader
              icon={<Sparkles className="h-4 w-4" />}
              title="Otomasyon"
              subtitle="Tekrarlayan işlerin kendiliğinden yürümesi için kurallar"
            />

            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Periyodik Kontrol Hatırlatıcı</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Hizmetlere tanımlanan tekrar süresine göre müşterilere otomatik hatırlatma gönderin.
              </p>

              <div className="space-y-4">
                <ToggleSetting
                  label="Periyodik hatırlatma"
                  description="Hizmetlerin 'önerilen tekrar süresi' dolduğunda müşterilere otomatik SMS/WhatsApp gönderilir. Hizmet ayarlarından süreleri tanımlayın."
                  checked={settings.periodic_reminder_enabled ?? false}
                  onChange={(v) => setSettings(prev => ({ ...prev, periodic_reminder_enabled: v }))}
                />

                {(settings.periodic_reminder_enabled ?? false) && (
                  <div className="ml-14">
                    <label className="label">Kaç gün önceden gönderilsin?</label>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Örn: 3 gün önceden gönderilirse müşteri randevu alabilir.</p>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      className="input w-24"
                      value={settings.periodic_reminder_advance_days ?? 3}
                      onChange={(e) => setSettings(prev => ({ ...prev, periodic_reminder_advance_days: Number(e.target.value) || 0 }))}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Akıllı Boşluk Doldurma</h2>
              <p className="text-sm text-gray-500 mb-6">
                Randevu iptal edildiğinde boş slota uygun müşterileri otomatik olarak bilgilendirin.
              </p>
              <div className="space-y-4">
                <ToggleSetting
                  label="Boşluk doldurma bildirimi"
                  description="İptal edilen randevu için önce bekleme listesi, sonra geçmiş müşteriler arasından uygun adaylar bulunur ve SMS/WhatsApp gönderilir."
                  checked={settings.gap_fill_enabled ?? false}
                  onChange={(v) => setSettings(prev => ({ ...prev, gap_fill_enabled: v }))}
                />
                {(settings.gap_fill_enabled ?? false) && (
                  <div className="ml-14">
                    <label className="label">Geriye bakış süresi (ay)</label>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Bu hizmeti son kaç ay içinde alan müşteriler bilgilendirilsin?</p>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      className="input w-24"
                      value={settings.gap_fill_lookback_months ?? 6}
                      onChange={(e) => setSettings(prev => ({ ...prev, gap_fill_lookback_months: Number(e.target.value) || 6 }))}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ── BÖLÜM 3: Sadakat & Müşteri Deneyimi ── */}
            <SectionHeader
              icon={<Cake className="h-4 w-4" />}
              title="Sadakat & Müşteri Deneyimi"
              subtitle="Müşteri memnuniyeti, ödül ve geri kazanım"
            />

            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Sadakat Puan Sistemi</h2>
              <p className="text-sm text-gray-500 mb-6">
                Müşteriler randevu tamamladığında otomatik puan kazanır. Belirli eşiklere ulaşınca seviye yükseltilir.
              </p>
              <div className="space-y-4">
                <ToggleSetting
                  label="Sadakat puanı aktif"
                  description="Randevu tamamlandığında müşteriye hizmet bedeline göre puan ve ziyaret bonusu eklenir."
                  checked={settings.loyalty_enabled ?? false}
                  onChange={(v) => setSettings(prev => ({ ...prev, loyalty_enabled: v }))}
                />
                {(settings.loyalty_enabled ?? false) && (
                  <div className="ml-14 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">1₺ = kaç puan</label>
                        <input
                          type="number" min={0} step={0.1} className="input w-full"
                          value={settings.points_per_currency ?? 1}
                          onChange={(e) => setSettings(prev => ({ ...prev, points_per_currency: parseFloat(e.target.value) || 1 }))}
                        />
                      </div>
                      <div>
                        <label className="label">Ziyaret bonusu (puan)</label>
                        <input
                          type="number" min={0} className="input w-full"
                          value={settings.visit_bonus_points ?? 50}
                          onChange={(e) => setSettings(prev => ({ ...prev, visit_bonus_points: Number(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label">Otomatik ödül eşiği (puan bakiyesi)</label>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Bu eşiğe ulaşıldığında müşteriye ödül bildirimi gösterilir.</p>
                      <input
                        type="number" min={0} className="input w-32"
                        value={settings.auto_reward_threshold ?? 500}
                        onChange={(e) => setSettings(prev => ({ ...prev, auto_reward_threshold: Number(e.target.value) || 500 }))}
                      />
                    </div>
                    <div>
                      <label className="label">Harcama oranı — kaç puan = 1₺ indirim</label>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                        Örn: 10 → 100 puan = 10₺ indirim (%10 cashback). Değer düşüldükçe indirim oranı artar.
                      </p>
                      <input
                        type="number" min={1} className="input w-32"
                        value={settings.redemption_rate ?? 10}
                        onChange={(e) => setSettings(prev => ({ ...prev, redemption_rate: Number(e.target.value) || 10 }))}
                      />
                    </div>
                  </div>
                )}
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
                    <CustomSelect
                      options={[
                        { value: '30', label: '30 dakika sonra' },
                        { value: '60', label: '1 saat sonra' },
                        { value: '120', label: '2 saat sonra' },
                        { value: '1440', label: '1 gün sonra' },
                      ]}
                      value={String(settings.review_request_delay_minutes)}
                      onChange={v => setSettings(prev => ({ ...prev, review_request_delay_minutes: Number(v) }))}
                    />
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
                <CustomSelect
                  options={[
                    { value: '14', label: '14 gün' },
                    { value: '21', label: '21 gün' },
                    { value: '30', label: '30 gün' },
                    { value: '45', label: '45 gün' },
                    { value: '60', label: '60 gün' },
                    { value: '90', label: '90 gün' },
                  ]}
                  value={String(settings.winback_days)}
                  onChange={v => setSettings(prev => ({ ...prev, winback_days: Number(v) }))}
                />
                <p className="mt-1.5 text-xs text-gray-400">
                  Bu süreden uzun süre gelmeyen müşteriler &quot;riskli&quot; olarak işaretlenir.
                </p>
              </div>
            </div>

            {/* ── BÖLÜM 4: Ek Kanallar & AI ── */}
            <SectionHeader
              icon={<Smartphone className="h-4 w-4" />}
              title="Ek Kanallar & AI"
              subtitle="Doğum günü, rezervasyon, WhatsApp ve AI asistan"
            />

            <div className="card">
              <div className="flex items-center gap-3 mb-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-100">
                  <Cake className="h-5 w-5 text-pink-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Doğum Günü SMS</h2>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                Müşterilerinizin doğum günlerinde otomatik kutlama SMS&apos;i gönderin.
              </p>

              <div className="space-y-4">
                <ToggleSetting
                  label="Doğum günü SMS gönder"
                  description="Doğum günü olan müşterilere otomatik kutlama mesajı gönderilir."
                  checked={settings.birthday_sms_enabled}
                  onChange={(v) => setSettings(prev => ({ ...prev, birthday_sms_enabled: v }))}
                />

                {settings.birthday_sms_enabled && (
                  <div className="ml-14 space-y-4">
                    <div>
                      <label className="label">Mesaj Şablonu</label>
                      <textarea
                        value={settings.birthday_sms_template}
                        onChange={(e) => setSettings(prev => ({ ...prev, birthday_sms_template: e.target.value }))}
                        className="input w-full"
                        rows={3}
                        placeholder="Doğum gününüz kutlu olsun {name}!"
                      />
                      <p className="mt-1.5 text-xs text-gray-400">
                        {'{name}'} yazdığınız yere müşterinin adı otomatik eklenir.
                      </p>
                    </div>
                    <div>
                      <label className="label">Gönderim Saati</label>
                      <CustomSelect
                        options={[
                          { value: '8', label: '08:00' },
                          { value: '9', label: '09:00' },
                          { value: '10', label: '10:00' },
                          { value: '11', label: '11:00' },
                          { value: '12', label: '12:00' },
                        ]}
                        value={String(settings.birthday_sms_hour)}
                        onChange={v => setSettings(prev => ({ ...prev, birthday_sms_hour: Number(v) }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Rezervasyon Ayarları</h2>
              <p className="text-sm text-gray-500 mb-6">
                Masa rezervasyonu süresini ve çakışma kontrolünü ayarlayın.
              </p>

              <div>
                <label className="label">Rezervasyon Süresi</label>
                <CustomSelect
                  options={[
                    { value: '30', label: '30 dakika' },
                    { value: '60', label: '60 dakika' },
                    { value: '90', label: '90 dakika' },
                    { value: '120', label: '120 dakika' },
                    { value: '150', label: '150 dakika' },
                    { value: '180', label: '180 dakika' },
                  ]}
                  value={String(settings.reservation_duration_minutes)}
                  onChange={v => setSettings(prev => ({ ...prev, reservation_duration_minutes: Number(v) }))}
                />
                <p className="mt-1.5 text-xs text-gray-400">
                  Her rezervasyonun varsayılan süresi. Aynı masaya bu süre içinde çakışan rezervasyon yapılamaz.
                </p>
              </div>
            </div>

            {/* WhatsApp */}
            <div className="card border-green-200 bg-gradient-to-br from-green-50/40 to-white dark:from-gray-800 dark:to-gray-800 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100">
                  <Smartphone className="h-5 w-5 text-green-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">WhatsApp Business</h2>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                Müşterilerinize SMS yerine WhatsApp üzerinden mesaj gönderin. Açılma oranı %90+.
              </p>

              <div className="space-y-4">
                <ToggleSetting
                  label="WhatsApp aktif"
                  description="Twilio WhatsApp Business API üzerinden mesaj gönderimi etkinleştirilir."
                  checked={settings.whatsapp_enabled ?? false}
                  onChange={(v) => setSettings(prev => ({ ...prev, whatsapp_enabled: v }))}
                />

                {settings.whatsapp_enabled && (
                  <div className="ml-14 space-y-4">
                    <div>
                      <label className="label">Mod</label>
                      <CustomSelect
                        options={[
                          { value: 'sandbox', label: 'Sandbox (test modu)' },
                          { value: 'production', label: 'Production (canlı)' },
                        ]}
                        value={settings.whatsapp_mode ?? 'sandbox'}
                        onChange={v => setSettings(prev => ({ ...prev, whatsapp_mode: v as 'sandbox' | 'production' }))}
                      />
                      <p className="mt-1.5 text-xs text-gray-400">
                        Sandbox modunda yalnızca Twilio sandbox numarasına katılmış kişilere ulaşabilirsiniz.
                      </p>
                    </div>
                    <div>
                      <label className="label">Varsayılan Mesajlaşma Kanalı</label>
                      <CustomSelect
                        options={[
                          { value: 'auto', label: 'Otomatik (WhatsApp tercihli, yoksa SMS)' },
                          { value: 'whatsapp', label: 'Her zaman WhatsApp' },
                          { value: 'sms', label: 'Her zaman SMS' },
                        ]}
                        value={settings.default_channel ?? 'auto'}
                        onChange={v => setSettings(prev => ({ ...prev, default_channel: v as 'auto' | 'sms' | 'whatsapp' }))}
                      />
                    </div>
                    <div className="rounded-lg bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">
                      <p className="font-medium mb-1">Kurulum adımları:</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>Twilio konsolunda WhatsApp Sandbox&apos;ı etkinleştirin</li>
                        <li><code className="bg-green-100 px-1 rounded">TWILIO_WHATSAPP_NUMBER</code> env değişkenini .env dosyasına ekleyin</li>
                        <li>Müşterileriniz sandbox numarasına katılım mesajı göndersin</li>
                        <li>Production için Twilio&apos;dan onaylı gönderici numarası alın</li>
                      </ol>
                    </div>
                  </div>
                )}
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

            <div className={cn("flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800", isDirty && saveBtnAnimating && "save-btn-animate")}>
              {isDirty && (
                <button
                  type="button"
                  onClick={() => setSettings(savedSettings)}
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
                className={cn('btn-primary', !isDirty && 'opacity-50 cursor-not-allowed')}
              >
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                Ayarları Kaydet
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Odalar */}
      {activeTab === 'rooms' && (
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tedavi Odaları</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  İşletmenizin odalarını tanımlayın. Randevu oluştururken oda seçimi yapılabilir.
                </p>
              </div>
              <button onClick={openNewRoomModal} className="btn-primary">
                <Plus className="mr-2 h-4 w-4" />
                Oda Ekle
              </button>
            </div>

            {roomsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-pulse-900" />
              </div>
            ) : rooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-700 mb-4">
                  <DoorOpen className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Henüz oda eklenmemiş</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">İlk odanızı ekleyerek başlayın.</p>
                <button onClick={openNewRoomModal} className="btn-primary mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  İlk Odayı Ekle
                </button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 transition-shadow hover:shadow-sm"
                  >
                    <div
                      className="h-10 w-10 rounded-lg flex-shrink-0"
                      style={{ backgroundColor: room.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{room.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                        <Users className="h-3 w-3" />
                        {room.capacity} kişi kapasiteli
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => openEditRoomModal(room)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRoom(room.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Oda Ekle/Düzenle Modal */}
      {showRoomModal && (
        <Portal>
        <div
          className={`modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 ${isClosingRoomModal ? 'closing' : ''}`}
          onAnimationEnd={() => {
            if (isClosingRoomModal) {
              setShowRoomModal(false)
              setIsClosingRoomModal(false)
            }
          }}
        >
          <div className={`modal-content card w-full max-w-md ${isClosingRoomModal ? 'closing' : ''}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingRoom ? 'Odayı Düzenle' : 'Yeni Oda Ekle'}
              </h3>
              <button
                onClick={resetRoomForm}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Oda Adı</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="input"
                  placeholder="Ör: Oda 1, VIP Salon"
                  autoFocus
                />
              </div>

              <div>
                <label className="label">Kapasite (Kişi)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={roomCapacity}
                  onChange={(e) => setRoomCapacity(Math.max(1, Number(e.target.value)))}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Renk</label>
                <div className="flex gap-2 mt-1">
                  {ROOM_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setRoomColor(c)}
                      className={cn(
                        'h-8 w-8 rounded-lg transition-all',
                        roomColor === c
                          ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white dark:ring-offset-gray-800 scale-110'
                          : 'hover:scale-105'
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={resetRoomForm}
                className="btn-secondary"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleSaveRoom}
                disabled={roomSaving || !roomName.trim()}
                className="btn-primary"
              >
                {roomSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {editingRoom ? 'Güncelle' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Abonelik */}
      {activeTab === 'subscription' && (
        <div className="space-y-6">
          {/* Mevcut plan */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Mevcut Abonelik</h2>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pulse-100 dark:bg-pulse-900/30">
                <CreditCard className="h-6 w-6 text-pulse-900" />
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

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-pulse-50 text-pulse-900 dark:bg-pulse-900/20 dark:text-pulse-400">
        {icon}
      </span>
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
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
        <div className="h-6 w-11 rounded-full bg-gray-300 dark:bg-gray-600 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-pulse-900 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-2 peer-focus:ring-pulse-300" />
      </label>
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
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
          ? 'border-pulse-900 bg-pulse-50/30 dark:bg-gray-700/50 ring-1 ring-pulse-900'
          : popular
          ? 'border-purple-200 dark:border-purple-800 bg-white dark:bg-gray-800'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
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
          <span className="rounded-full bg-pulse-800 px-3 py-1 text-xs font-medium text-white">
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
          <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
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
            : 'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
        }`}
      >
        {current ? 'Mevcut Planınız' : 'Plan Seç'}
      </button>
    </div>
  )
}
