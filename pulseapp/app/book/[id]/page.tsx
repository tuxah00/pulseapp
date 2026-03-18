'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle, ChevronLeft, ChevronRight, Clock, MapPin, Phone } from 'lucide-react'

interface Business {
  id: string
  name: string
  sector: string
  phone: string
  address: string
  city: string
  district: string
  working_hours: Record<string, { open: string; close: string } | null>
  google_maps_url: string | null
}

interface Service {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  price: number | null
}

interface StaffMember {
  id: string
  name: string
  avatar_url: string | null
}

const STEP_LABELS = ['Hizmet', 'Tarih & Saat', 'Bilgiler', 'Onay']

const DAY_NAMES = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function formatPrice(price: number | null): string {
  if (price === null) return ''
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(price)
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function BookingPage() {
  const params = useParams()
  const businessId = params.id as string

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [business, setBusiness] = useState<Business | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Selections
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedStaff, setSelectedStaff] = useState<string>('any')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [calendarOffset, setCalendarOffset] = useState(0)

  // Bekleme listesi
  const [showWaitlist, setShowWaitlist] = useState(false)
  const [waitlistName, setWaitlistName] = useState('')
  const [waitlistPhone, setWaitlistPhone] = useState('')
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false)
  const [waitlistSuccess, setWaitlistSuccess] = useState(false)

  // Customer info
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')

  // Load initial data
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [bRes, sRes, stRes] = await Promise.all([
          fetch(`/api/public/business/${businessId}`),
          fetch(`/api/public/business/${businessId}/services`),
          fetch(`/api/public/business/${businessId}/staff`),
        ])
        if (!bRes.ok) { setError('İşletme bulunamadı'); setLoading(false); return }
        const { business } = await bRes.json()
        const { services } = await sRes.json()
        const { staff } = await stRes.json()
        setBusiness(business)
        setServices(services)
        setStaff(staff)
      } catch {
        setError('Yükleme hatası oluştu')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [businessId])

  // Load slots when date/service/staff changes
  const loadSlots = useCallback(async () => {
    if (!selectedDate || !selectedService) return
    setLoadingSlots(true)
    setSelectedTime(null)
    try {
      const staffParam = selectedStaff !== 'any' ? `&staffId=${selectedStaff}` : ''
      const res = await fetch(
        `/api/public/business/${businessId}/slots?date=${formatDate(selectedDate)}&duration=${selectedService.duration_minutes}${staffParam}`
      )
      const data = await res.json()
      setSlots(data.slots || [])
    } catch {
      setSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }, [businessId, selectedDate, selectedService, selectedStaff])

  useEffect(() => {
    if (step === 1 && selectedDate && selectedService) loadSlots()
  }, [step, selectedDate, selectedService, selectedStaff, loadSlots])

  // Generate calendar days (14 days starting today)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const calendarDays = Array.from({ length: 14 }, (_, i) => addDays(today, i + calendarOffset * 14))

  function isDayOpen(date: Date): boolean {
    if (!business) return false
    const key = DAY_KEYS[date.getDay()]
    return !!business.working_hours?.[key]
  }

  async function handleWaitlistSubmit() {
    if (!waitlistName.trim() || !waitlistPhone.trim() || !businessId) return
    setWaitlistSubmitting(true)
    try {
      await fetch(`/api/public/business/${businessId}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: waitlistName,
          customerPhone: waitlistPhone,
          serviceId: selectedService?.id,
          staffId: selectedStaff !== 'any' ? selectedStaff : undefined,
          preferredDate: selectedDate ? formatDate(selectedDate) : undefined,
        }),
      })
      setWaitlistSuccess(true)
      setShowWaitlist(false)
    } catch {
      // sessizce geç
    } finally {
      setWaitlistSubmitting(false)
    }
  }

  async function handleSubmit() {
    if (!selectedService || !selectedDate || !selectedTime || !name || !phone) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/public/business/${businessId}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          serviceId: selectedService.id,
          staffId: selectedStaff !== 'any' ? selectedStaff : undefined,
          date: formatDate(selectedDate),
          startTime: selectedTime,
          notes: notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Hata oluştu')
      setSuccess(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Randevu oluşturulamadı')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (error && !business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 text-lg">{error}</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Randevunuz Alındı!</h2>
          <p className="text-gray-500 mb-6">
            <strong>{selectedService?.name}</strong><br />
            {selectedDate && formatDisplayDate(selectedDate)} — {selectedTime}
          </p>
          <p className="text-sm text-gray-400">
            {business?.name} sizi bekliyor. Sorularınız için <strong>{business?.phone}</strong> numarasını arayabilirsiniz.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="booking-page min-h-screen bg-gray-50 text-gray-900" style={{ colorScheme: 'light' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-5">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-gray-900">{business?.name}</h1>
          {business?.address && (
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5" />
              {business.district}, {business.city}
            </p>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-1">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center flex-1">
              <div className={`flex items-center gap-1.5 ${i <= step ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${i < step ? 'bg-blue-600 text-white' : i === step ? 'border-2 border-blue-600 text-blue-600' : 'border-2 border-gray-200 text-gray-400'}`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className="text-xs font-medium hidden sm:block">{label}</span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-blue-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">

        {/* Step 0: Hizmet Seç */}
        {step === 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Hizmet Seçin</h2>
            {services.length === 0 && (
              <p className="text-gray-400 text-sm">Henüz hizmet eklenmemiş.</p>
            )}
            {services.map(s => (
              <button
                key={s.id}
                onClick={() => { setSelectedService(s); setStep(1) }}
                className={`w-full text-left p-4 rounded-xl border transition-all
                  ${selectedService?.id === s.id
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{s.name}</p>
                    {s.description && <p className="text-sm text-gray-500 mt-0.5">{s.description}</p>}
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    {s.price !== null && (
                      <p className="font-semibold text-gray-900">{formatPrice(s.price)}</p>
                    )}
                    <p className="text-xs text-gray-400 flex items-center gap-0.5 justify-end">
                      <Clock className="w-3 h-3" />{s.duration_minutes} dk
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 1: Tarih & Saat */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Tarih ve Saat Seçin</h2>

            {/* Personel seçimi */}
            {staff.length > 1 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Personel (opsiyonel)</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedStaff('any')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all
                      ${selectedStaff === 'any' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'}`}
                  >
                    Fark etmez
                  </button>
                  {staff.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStaff(s.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all
                        ${selectedStaff === s.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'}`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Takvim */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">Tarih Seçin</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setCalendarOffset(o => Math.max(0, o - 1)); setSelectedDate(null) }}
                    disabled={calendarOffset === 0}
                    className="p-1 rounded-lg border border-gray-200 disabled:opacity-30 hover:border-gray-300"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setCalendarOffset(o => o + 1); setSelectedDate(null) }}
                    className="p-1 rounded-lg border border-gray-200 hover:border-gray-300"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => {
                  const open = isDayOpen(day)
                  const isSelected = selectedDate && formatDate(day) === formatDate(selectedDate)
                  const isToday = formatDate(day) === formatDate(today)
                  return (
                    <button
                      key={i}
                      disabled={!open}
                      onClick={() => { setSelectedDate(day); setSelectedTime(null) }}
                      className={`flex flex-col items-center p-2 rounded-xl text-xs transition-all
                        ${!open ? 'opacity-30 cursor-not-allowed bg-gray-100' :
                          isSelected ? 'bg-blue-600 text-white shadow-sm' :
                          'bg-white border border-gray-200 hover:border-blue-300 text-gray-700'}`}
                    >
                      <span className="text-gray-400 font-medium" style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : undefined }}>
                        {DAY_NAMES[day.getDay()]}
                      </span>
                      <span className={`font-bold mt-0.5 ${isToday && !isSelected ? 'text-blue-600' : ''}`}>
                        {day.getDate()}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Saatler */}
            {selectedDate && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Saat Seçin — {formatDisplayDate(selectedDate)}
                </p>
                {loadingSlots ? (
                  <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                    Saatler yükleniyor...
                  </div>
                ) : slots.length === 0 ? (
                  <div className="py-4 space-y-3">
                    <p className="text-gray-400 text-sm">Bu gün için müsait saat yok.</p>
                    {!waitlistSuccess ? (
                      !showWaitlist ? (
                        <button
                          onClick={() => setShowWaitlist(true)}
                          className="w-full py-2.5 rounded-xl border-2 border-dashed border-blue-300 text-blue-600 text-sm font-medium hover:border-blue-400 hover:bg-blue-50 transition-all"
                        >
                          Boşluk oluşunca bilgilendir
                        </button>
                      ) : (
                        <div className="bg-blue-50 rounded-xl p-4 space-y-3 border border-blue-200">
                          <p className="text-sm font-medium text-blue-800">Bilgilendirme için kayıt olun</p>
                          <input
                            type="text"
                            value={waitlistName}
                            onChange={e => setWaitlistName(e.target.value)}
                            placeholder="Ad Soyad *"
                            className="w-full px-3 py-2 rounded-lg border border-blue-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="tel"
                            value={waitlistPhone}
                            onChange={e => setWaitlistPhone(e.target.value)}
                            placeholder="Telefon numaranız *"
                            className="w-full px-3 py-2 rounded-lg border border-blue-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowWaitlist(false)}
                              className="flex-1 py-2 rounded-lg border border-blue-200 text-blue-600 text-sm hover:bg-blue-100"
                            >
                              İptal
                            </button>
                            <button
                              disabled={!waitlistName.trim() || !waitlistPhone.trim() || waitlistSubmitting}
                              onClick={handleWaitlistSubmit}
                              className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
                            >
                              {waitlistSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="bg-green-50 rounded-xl p-4 border border-green-200 text-center">
                        <p className="text-green-700 text-sm font-medium">Kaydınız alındı!</p>
                        <p className="text-green-600 text-xs mt-1">Randevu boşluğu oluşunca size ulaşacağız.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map(slot => (
                      <button
                        key={slot}
                        onClick={() => setSelectedTime(slot)}
                        className={`py-2.5 rounded-xl text-sm font-medium border transition-all
                          ${selectedTime === slot
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'}`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep(0)} className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-gray-300">
                <ChevronLeft className="w-4 h-4" /> Geri
              </button>
              <button
                disabled={!selectedDate || !selectedTime}
                onClick={() => setStep(2)}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors"
              >
                Devam Et
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Müşteri Bilgileri */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Bilgileriniz</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ad Soyad *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Adınızı girin"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon *</label>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-500 gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    +90
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="5XX XXX XX XX"
                    className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Not (opsiyonel)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Eklemek istediğiniz not..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-gray-300">
                <ChevronLeft className="w-4 h-4" /> Geri
              </button>
              <button
                disabled={!name.trim() || !phone.trim()}
                onClick={() => setStep(3)}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors"
              >
                Devam Et
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Onay */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Randevu Özeti</h2>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              <div className="px-4 py-3 flex justify-between text-sm">
                <span className="text-gray-500">İşletme</span>
                <span className="font-medium text-gray-900">{business?.name}</span>
              </div>
              <div className="px-4 py-3 flex justify-between text-sm">
                <span className="text-gray-500">Hizmet</span>
                <span className="font-medium text-gray-900">{selectedService?.name}</span>
              </div>
              <div className="px-4 py-3 flex justify-between text-sm">
                <span className="text-gray-500">Tarih</span>
                <span className="font-medium text-gray-900">{selectedDate && formatDisplayDate(selectedDate)}</span>
              </div>
              <div className="px-4 py-3 flex justify-between text-sm">
                <span className="text-gray-500">Saat</span>
                <span className="font-medium text-gray-900">{selectedTime}</span>
              </div>
              <div className="px-4 py-3 flex justify-between text-sm">
                <span className="text-gray-500">Süre</span>
                <span className="font-medium text-gray-900">{selectedService?.duration_minutes} dk</span>
              </div>
              {selectedService?.price !== null && (
                <div className="px-4 py-3 flex justify-between text-sm">
                  <span className="text-gray-500">Ücret</span>
                  <span className="font-semibold text-gray-900">{formatPrice(selectedService?.price ?? null)}</span>
                </div>
              )}
              <div className="px-4 py-3 flex justify-between text-sm">
                <span className="text-gray-500">Ad Soyad</span>
                <span className="font-medium text-gray-900">{name}</span>
              </div>
              <div className="px-4 py-3 flex justify-between text-sm">
                <span className="text-gray-500">Telefon</span>
                <span className="font-medium text-gray-900">{phone}</span>
              </div>
              {notes && (
                <div className="px-4 py-3 flex justify-between text-sm">
                  <span className="text-gray-500">Not</span>
                  <span className="font-medium text-gray-900 text-right max-w-[60%]">{notes}</span>
                </div>
              )}
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>
            )}

            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-gray-300">
                <ChevronLeft className="w-4 h-4" /> Geri
              </button>
              <button
                disabled={submitting}
                onClick={handleSubmit}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-60 hover:bg-blue-700 transition-colors"
              >
                {submitting ? 'Randevu oluşturuluyor...' : 'Randevuyu Onayla'}
              </button>
            </div>
            <p className="text-xs text-center text-gray-400">
              Randevunuzu onaylayarak {business?.name} ile iletişim kurulmasına izin vermiş olursunuz.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
