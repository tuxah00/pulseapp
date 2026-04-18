'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  CheckCircle2, ChevronLeft, Loader2, Clock, Calendar,
  User, Phone, AlertCircle, Bell, MapPin, Zap, CalendarPlus, UserCircle2,
} from 'lucide-react'
import type { WorkingHours } from '@/types'
import { getInitials } from '@/lib/utils'

interface BusinessData {
  id: string
  name: string
  sector: string
  working_hours: WorkingHours
  phone: string | null
  address: string | null
  city: string | null
  district: string | null
  settings?: { logo_url?: string | null } | null
}

interface ServiceData {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  price: number | null
}

interface StaffData {
  id: string
  name: string
}

const STEPS = ['Hizmet', 'Tarih & Saat', 'Bilgiler', 'Onay'] as const

function getDayKey(dateStr: string): keyof WorkingHours {
  const d = new Date(dateStr + 'T00:00:00')
  const map: (keyof WorkingHours)[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  return map[d.getDay()]
}

function generateTimeSlots(workingHours: WorkingHours, date: string, durationMinutes: number): string[] {
  const dayKey = getDayKey(date)
  const hours = workingHours[dayKey]
  if (!hours) return []

  const [openH, openM] = hours.open.split(':').map(Number)
  const [closeH, closeM] = hours.close.split(':').map(Number)
  const openMin = openH * 60 + openM
  const closeMin = closeH * 60 + closeM

  const slots: string[] = []
  for (let m = openMin; m + durationMinutes <= closeMin; m += 30) {
    const h = Math.floor(m / 60)
    const min = m % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`)
  }
  return slots
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount)
}

function getTodayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}


export default function BookingPage() {
  const params = useParams()
  const businessId = params.businessId as string

  const [business, setBusiness] = useState<BusinessData | null>(null)
  const [services, setServices] = useState<ServiceData[]>([])
  const [staff, setStaff] = useState<StaffData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [step, setStep] = useState(1)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')

  const [waitlistEnabled, setWaitlistEnabled] = useState(false)
  const [waitlistTime, setWaitlistTime] = useState('')
  const [waitlistDate, setWaitlistDate] = useState('')
  const [waitlistStaffId, setWaitlistStaffId] = useState('')
  const [waitlistEarliest, setWaitlistEarliest] = useState(false)
  const [autoBookEnabled, setAutoBookEnabled] = useState(false)
  const [autoBookResult, setAutoBookResult] = useState<{ date: string; time: string; staffName?: string } | null>(null)

  const [kvkkConsent, setKvkkConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const selectedService = services.find(s => s.id === selectedServiceId) || null
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const isDayClosed = !!(business && selectedDate && !business.working_hours[getDayKey(selectedDate)])

  // Tarih/personel/hizmet değiştiğinde müsait saatleri API'den çek
  useEffect(() => {
    if (!business || !selectedDate || !selectedService || isDayClosed) {
      setAvailableSlots([])
      return
    }
    let cancelled = false
    async function fetchSlots() {
      setSlotsLoading(true)
      try {
        const params = new URLSearchParams({
          date: selectedDate,
          duration: String(selectedService!.duration_minutes),
        })
        if (selectedStaffId) params.set('staffId', selectedStaffId)
        const res = await fetch(`/api/public/business/${businessId}/slots?${params}`)
        if (!cancelled && res.ok) {
          const data = await res.json()
          setAvailableSlots(data.slots || [])
        }
      } catch {
        if (!cancelled) setAvailableSlots([])
      }
      if (!cancelled) setSlotsLoading(false)
    }
    fetchSlots()
    return () => { cancelled = true }
  }, [business, businessId, selectedDate, selectedService, selectedStaffId, isDayClosed])

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/book?businessId=${businessId}`)
        if (!res.ok) {
          setError('İşletme bulunamadı')
          setLoading(false)
          return
        }
        const data = await res.json()
        setBusiness(data.business)
        setServices(data.services)
        setStaff(data.staff)
      } catch {
        setError('Bir hata oluştu')
      }
      setLoading(false)
    }
    fetchData()
  }, [businessId])

  async function handleSubmit() {
    if (!selectedServiceId || !customerName || !customerPhone) return
    // Normal mod: tarih+saat zorunlu; auto-book modunda gerekmez
    if (!autoBookEnabled && (!selectedDate || !selectedTime)) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      if (autoBookEnabled) {
        // Otomatik randevu: sunucu tarafında en yakın slot bulup atar
        const res = await fetch(`/api/public/business/${businessId}/auto-book`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceId: selectedServiceId,
            name: customerName.trim(),
            phone: customerPhone.replace(/\s/g, ''),
            staffId: selectedStaffId || undefined,
            notes: undefined,
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          setSubmitError(data.error || 'Otomatik randevu oluşturulamadı')
          setSubmitting(false)
          return
        }

        const data = await res.json()
        setAutoBookResult({
          date: data.date,
          time: data.startTime,
          staffName: data.staffName || undefined,
        })
      } else {
        // Normal randevu akışı
        const res = await fetch(`/api/book?businessId=${businessId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: selectedServiceId,
            staff_id: selectedStaffId || undefined,
            appointment_date: selectedDate,
            start_time: selectedTime,
            customer_name: customerName.trim(),
            customer_phone: customerPhone.replace(/\s/g, ''),
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          setSubmitError(data.error || 'Randevu oluşturulamadı')
          setSubmitting(false)
          return
        }
      }

      // Bekleme listesine de kaydet (işaretliyse)
      if (waitlistEnabled) {
        try {
          await fetch(`/api/public/business/${businessId}/waitlist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerName: customerName.trim(),
              customerPhone: customerPhone.replace(/\s/g, ''),
              serviceId: selectedServiceId,
              staffId: waitlistStaffId || undefined,
              preferredDate: waitlistDate || undefined,
            }),
          })
        } catch {
          // Bekleme listesi hatası randevu başarısını etkilememeli
        }
      }

      if (kvkkConsent) {
        try {
          await fetch('/api/consent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              businessId,
              consentType: 'kvkk',
              method: 'online_form',
              customerPhone: customerPhone.replace(/\s/g, ''),
            }),
          })
        } catch {
          // Onay kaydı hatası randevu başarısını etkilememeli
        }
      }

      setSubmitted(true)
    } catch {
      setSubmitError('Bir hata oluştu. Lütfen tekrar deneyin.')
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm mb-5">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
        <p className="text-sm font-medium text-gray-500">Yükleniyor...</p>
      </div>
    )
  }

  if (error || !business) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 mb-5">
          <AlertCircle className="h-8 w-8 text-red-400" />
        </div>
        <p className="text-base font-medium text-gray-700">{error || 'İşletme bulunamadı'}</p>
        <p className="text-sm text-gray-400 mt-1">Lütfen linki kontrol edin.</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div>
        {/* Business Header */}
        <BusinessHeader business={business} />

        <div className="mt-4 bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 mb-6">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Randevunuz Alındı!</h2>
          <p className="mt-2 text-gray-500">
            {business.name} sizi bekliyor.
          </p>

          <div className="mt-6 bg-gray-50 rounded-xl p-4 text-left space-y-3 text-sm">
            <SummaryRow label="Hizmet" value={selectedService?.name ?? ''} />
            <SummaryRow label="Tarih" value={formatDate(autoBookResult?.date ?? selectedDate)} />
            <SummaryRow label="Saat" value={autoBookResult?.time ?? selectedTime ?? ''} />
            {autoBookResult?.staffName && (
              <SummaryRow label="Personel" value={autoBookResult.staffName} />
            )}
            {selectedService?.price != null && (
              <SummaryRow label="Ücret" value={formatPrice(selectedService.price)} />
            )}
            {autoBookResult && (
              <div className="border-t border-gray-200 pt-3">
                <div className="flex items-center gap-2 py-1.5 px-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <span className="text-xs text-amber-700 font-medium">Randevunuz onay bekliyor — işletme tarafından onaylandıktan sonra kesinleşecektir.</span>
                </div>
              </div>
            )}
          </div>

          {autoBookResult && (
            <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700 flex gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>Randevunuz <strong>onay bekliyor</strong>. İşletme tarafından onaylandığında bilgilendirileceksiniz.</span>
            </div>
          )}

          <button
            onClick={() => {
              setStep(1)
              setSelectedServiceId(null)
              setSelectedDate('')
              setSelectedTime(null)
              setSelectedStaffId('')
              setCustomerName('')
              setCustomerPhone('')
              setAutoBookEnabled(false)
              setAutoBookResult(null)
              setWaitlistEnabled(false)
              setWaitlistTime('')
              setWaitlistDate('')
              setWaitlistStaffId('')
              setWaitlistEarliest(false)
              setAutoBookEnabled(false)
              setAutoBookResult(null)
              setKvkkConsent(false)
              setSubmitted(false)
            }}
            className="mt-6 btn-secondary w-full"
          >
            Yeni Randevu Al
          </button>
        </div>

        <BookingFooter />
      </div>
    )
  }

  return (
    <div>
      {/* Business Header */}
      <BusinessHeader business={business} />

      {/* Step Indicator */}
      <div className="mt-4 bg-white rounded-2xl shadow-sm border border-gray-200 px-6 py-4">
        <div className="flex items-start">
          {STEPS.map((label, i) => {
            const stepNum = i + 1
            const isCompleted = step > stepNum
            const isCurrent = step === stepNum
            return (
              <React.Fragment key={label}>
                {/* Bağlantı çizgisi — adımlar arasında */}
                {i > 0 && (
                  <div className={`flex-1 h-0.5 mt-[18px] mx-1 transition-colors ${
                    step > i ? 'bg-blue-500' : 'bg-gray-200'
                  }`} />
                )}
                {/* Adım: daire + etiket */}
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                      isCompleted
                        ? 'bg-blue-500 text-white shadow-sm shadow-blue-200'
                        : isCurrent
                          ? 'bg-blue-500 text-white shadow-sm shadow-blue-200 ring-4 ring-blue-100'
                          : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : stepNum}
                  </div>
                  <span className={`mt-1.5 text-[11px] font-medium whitespace-nowrap text-center ${
                    isCurrent ? 'text-blue-600' : isCompleted ? 'text-gray-600' : 'text-gray-400'
                  }`}>
                    {label}
                  </span>
                </div>
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="mt-4 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">

        {/* Step 1: Hizmet */}
        {step === 1 && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Hizmet Seçin</h2>
            {services.length === 0 ? (
              <div className="text-center py-12">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 mx-auto mb-3">
                  <Zap className="h-7 w-7 text-gray-300" />
                </div>
                <p className="text-gray-500 text-sm">Bu işletmenin aktif hizmeti bulunmuyor.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {services.map((service) => {
                  const isSelected = selectedServiceId === service.id
                  return (
                    <button
                      key={service.id}
                      onClick={() => setSelectedServiceId(service.id)}
                      className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                            isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                          }`}>
                            {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm">{service.name}</p>
                            {service.description && (
                              <p className="mt-0.5 text-xs text-gray-500 truncate">{service.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          {service.price != null && (
                            <p className="text-sm font-bold text-gray-900">{formatPrice(service.price)}</p>
                          )}
                          <p className="text-xs text-gray-400 flex items-center gap-1 justify-end mt-0.5">
                            <Clock className="h-3 w-3" />
                            {service.duration_minutes} dk
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            <div className="mt-5 pt-4 border-t border-gray-100">
              <button
                onClick={() => setStep(2)}
                disabled={!selectedServiceId}
                className="btn-primary w-full"
              >
                Devam Et
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Tarih & Saat */}
        {step === 2 && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Tarih & Saat Seçin</h2>

            {staff.length > 0 && (
              <div className="mb-4">
                <label className="label">Personel (isteğe bağlı)</label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => { setSelectedStaffId(e.target.value); setSelectedTime(null) }}
                  className="input"
                >
                  <option value="">Fark etmez</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-4">
              <label className="label flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Tarih
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value)
                  setSelectedTime(null)
                }}
                min={getTodayStr()}
                className="input"
              />
            </div>

            {selectedDate && (
              <div>
                <label className="label flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Saat
                </label>
                {isDayClosed ? (
                  <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium">Bu gün kapalı</p>
                    <p className="text-xs text-gray-400 mt-1">Lütfen farklı bir gün seçin</p>
                  </div>
                ) : slotsLoading ? (
                  <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-100">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Müsait saatler yükleniyor...</p>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium">Bu gün için uygun saat bulunamadı</p>
                    <p className="text-xs text-gray-400 mt-1">Tüm saatler dolu. Farklı bir gün veya personel deneyin.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {availableSlots.map((time) => (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`rounded-lg py-2.5 text-sm font-medium transition-all ${
                          selectedTime === time
                            ? 'bg-blue-500 text-white shadow-sm shadow-blue-200'
                            : 'bg-gray-50 border border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Bekleme Listesi ───────────────────────── */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium px-1">veya</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={waitlistEnabled}
                  onChange={(e) => {
                    setWaitlistEnabled(e.target.checked)
                    if (e.target.checked) {
                      setAutoBookEnabled(false)
                      setWaitlistTime(selectedTime || '')
                      setWaitlistDate(selectedDate || '')
                    }
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                    <Bell className="h-4 w-4 text-blue-500" />
                    Randevu boşluğu oluştuğunda beni bilgilendir
                  </span>
                  <span className="text-xs text-gray-400 mt-0.5 block">
                    Tercih ettiğiniz zamanda yer açılırsa SMS ile haberdar ederiz.
                  </span>
                </div>
              </label>

              {waitlistEnabled && (
                <div className="mt-4 space-y-3 pl-7">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Şu saatte:</label>
                    <select
                      value={waitlistTime}
                      onChange={(e) => { setWaitlistTime(e.target.value); if (e.target.value) setWaitlistEarliest(false) }}
                      className="input mt-1"
                    >
                      <option value="">Saat seçin</option>
                      {(business && selectedDate && selectedService
                        ? generateTimeSlots(business.working_hours, selectedDate, selectedService.duration_minutes)
                        : []).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Şu tarihte:</label>
                    <input
                      type="date"
                      value={waitlistDate}
                      onChange={(e) => { setWaitlistDate(e.target.value); if (e.target.value) setWaitlistEarliest(false) }}
                      min={getTodayStr()}
                      className="input mt-1"
                    />
                  </div>
                  {staff.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-gray-600">Şu personelde:</label>
                      <select
                        value={waitlistStaffId}
                        onChange={(e) => { setWaitlistStaffId(e.target.value); if (e.target.value) setWaitlistEarliest(false) }}
                        className="input mt-1"
                      >
                        <option value="">Personel seçin</option>
                        {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={waitlistEarliest}
                      onChange={(e) => {
                        setWaitlistEarliest(e.target.checked)
                        if (e.target.checked) { setWaitlistTime(''); setWaitlistDate(''); setWaitlistStaffId('') }
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">En yakın zamanda</span>
                  </label>
                </div>
              )}
            </div>

            {/* ── Otomatik Randevu ───────────────────────── */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium px-1">veya</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className={`rounded-xl border p-4 transition-all ${autoBookEnabled ? 'border-green-300 bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoBookEnabled}
                  onChange={(e) => {
                    setAutoBookEnabled(e.target.checked)
                    if (e.target.checked) {
                      // Auto-book seçilince manuel tarih/saat seçimine gerek yok
                      setWaitlistEnabled(false)
                    }
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-500 focus:ring-green-500"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                    <CalendarPlus className="h-4 w-4 text-green-500" />
                    Boşluk oluştuğunda otomatik randevu al
                  </span>
                  <span className="text-xs text-gray-400 mt-0.5 block">
                    En yakın müsait saate otomatik randevu oluşturulur. Randevunuz onay bekleyecektir.
                  </span>
                </div>
              </label>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2.5">
              <button onClick={() => setStep(1)} className="btn-secondary flex items-center gap-1 px-3">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!autoBookEnabled && (!selectedDate || !selectedTime)}
                className="btn-primary flex-1"
              >
                {autoBookEnabled ? 'Otomatik Randevu ile Devam Et' : 'Devam Et'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Bilgiler */}
        {step === 3 && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Bilgileriniz</h2>
            <div className="space-y-4">
              <div>
                <label className="label flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Ad Soyad
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Adınız ve soyadınız"
                  className="input"
                />
              </div>
              <div>
                <label className="label flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Telefon
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="0532 123 45 67"
                  className="input"
                />
              </div>
            </div>
            <label className="flex items-start gap-3 mt-4 cursor-pointer">
              <input
                type="checkbox"
                checked={kvkkConsent}
                onChange={(e) => setKvkkConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                required
              />
              <span className="text-xs text-gray-500">
                Kişisel verilerimin işlenmesine ilişkin{' '}
                <span className="text-blue-500 font-medium">KVKK Aydınlatma Metni</span>&apos;ni
                okudum ve kabul ediyorum.
              </span>
            </label>
            <div className="mt-5 pt-4 border-t border-gray-100 flex gap-2.5">
              <button onClick={() => setStep(2)} className="btn-secondary flex items-center gap-1 px-3">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={!customerName.trim() || !customerPhone.trim() || !kvkkConsent}
                className="btn-primary flex-1"
              >
                Devam Et
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Onay */}
        {step === 4 && selectedService && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Randevu Özeti</h2>

            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-3 text-sm">
              <SummaryRow label="İşletme" value={business.name} />
              <SummaryRow label="Hizmet" value={selectedService.name} />
              {autoBookEnabled ? (
                <div className="flex items-center gap-2 py-1.5 px-2 bg-green-50 border border-green-200 rounded-lg">
                  <CalendarPlus className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span className="text-xs text-green-700 font-medium">En yakın müsait saate otomatik randevu alınacak</span>
                </div>
              ) : (
                <>
                  <SummaryRow label="Tarih" value={formatDate(selectedDate)} />
                  <SummaryRow label="Saat" value={selectedTime ?? ''} />
                </>
              )}
              <SummaryRow label="Süre" value={`${selectedService.duration_minutes} dk`} />
              {selectedService.price != null && (
                <SummaryRow label="Ücret" value={formatPrice(selectedService.price)} highlight />
              )}
              <div className="border-t border-gray-200 pt-3 space-y-3">
                <SummaryRow label="Ad Soyad" value={customerName} />
                <SummaryRow label="Telefon" value={customerPhone} />
              </div>
              {waitlistEnabled && (
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex items-center gap-2 py-1.5 px-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <Bell className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <span className="text-xs text-blue-700 font-medium">Bekleme listesine de kaydedilecek</span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100 flex gap-2.5">
              <button onClick={() => setStep(3)} className="btn-secondary flex items-center gap-1 px-3">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary flex-1"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {autoBookEnabled ? 'Otomatik Randevu Al' : 'Randevuyu Onayla'}
              </button>
            </div>

            {submitError && (
              <div className="mt-3 rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-600 flex gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                {submitError}
              </div>
            )}

            <p className="mt-4 text-center text-xs text-gray-400">
              Onaylayarak {business.name} ile iletişim kurulmasına izin vermiş olursunuz.
            </p>
          </div>
        )}
      </div>

      <BookingFooter />
    </div>
  )
}

function BusinessHeader({ business }: { business: BusinessData }) {
  const initials = getInitials(business.name)
  const location = [business.district, business.city].filter(Boolean).join(', ')

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative">
      {/* Hesabım butonu — sağ üst köşe */}
      <a
        href={`/portal/${business.id}`}
        className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm text-blue-600 text-xs font-medium shadow-sm hover:bg-white transition-colors"
        title="Müşteri portalına giriş"
      >
        <UserCircle2 className="h-3.5 w-3.5" />
        Hesabım
      </a>
      {/* Üst renkli şerit */}
      <div className="h-20 bg-blue-500" />

      {/* Avatar — ortada, şerit üzerine taşıyor */}
      <div className="flex flex-col items-center -mt-10 pb-5 px-5">
        {business.settings?.logo_url ? (
          <img
            src={business.settings.logo_url}
            alt={business.name}
            className="h-20 w-20 rounded-full object-cover border-4 border-white shadow-md"
          />
        ) : (
          <div className="h-20 w-20 rounded-full bg-blue-500 border-4 border-white shadow-md flex items-center justify-center text-white text-2xl font-bold">
            {initials}
          </div>
        )}

        <h1 className="mt-3 text-lg font-bold text-gray-900 text-center">{business.name}</h1>

        {(business.phone || location) && (
          <div className="mt-1.5 flex flex-wrap justify-center items-center gap-x-3 gap-y-1">
            {business.phone && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Phone className="h-3 w-3" />
                {business.phone}
              </span>
            )}
            {location && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <MapPin className="h-3 w-3" />
                {location}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium ${highlight ? 'text-blue-600' : 'text-gray-900'}`}>{value}</span>
    </div>
  )
}

function BookingFooter() {
  return (
    <div className="mt-6 text-center">
      <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
        <Zap className="h-3 w-3" />
        <span>PulseApp ile güçlendirilmiştir</span>
      </p>
    </div>
  )
}
