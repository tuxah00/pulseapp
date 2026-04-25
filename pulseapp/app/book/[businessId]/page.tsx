'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { useParams, useSearchParams } from 'next/navigation'
import {
  CheckCircle2, ChevronLeft, Loader2, Clock, Calendar,
  User, Phone, AlertCircle, Bell, MapPin, Zap, CalendarPlus, UserCircle2, Sparkles,
} from 'lucide-react'
import type { WorkingHours } from '@/types'
import { getInitials } from '@/lib/utils'
import { CustomSelect } from '@/components/ui/custom-select'

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
  const searchParams = useSearchParams()
  // Kampanya attribution — SMS'teki link ?c=<recipient_id> ile gelir, POST /api/book'a forward'lanır
  const campaignRecipientId = searchParams?.get('c') || null

  const [business, setBusiness] = useState<BusinessData | null>(null)
  const [services, setServices] = useState<ServiceData[]>([])
  const [staff, setStaff] = useState<StaffData[]>([])
  const [campaignInfo, setCampaignInfo] = useState<{ name: string; description: string | null } | null>(null)
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
  const [waitlistAutoBook, setWaitlistAutoBook] = useState(true)

  const [kvkkConsent, setKvkkConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Önerilen tekrar aralığı uyarısı (önceki randevu kontrolü)
  const [intervalWarning, setIntervalWarning] = useState<string | null>(null)

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

  // Müşteri tarih/saat değiştirdikçe bekleme listesi tercihlerini güncelle
  useEffect(() => {
    if (waitlistEnabled) {
      setWaitlistDate(selectedDate || '')
      setWaitlistTime(selectedTime || '')
    }
  }, [selectedDate, selectedTime, waitlistEnabled])

  // Önerilen tekrar aralığı kontrolü — telefon yeterli haneye ulaşınca
  useEffect(() => {
    const digits = customerPhone.replace(/\D/g, '')
    if (!selectedServiceId || digits.length < 10) {
      setIntervalWarning(null)
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/public/business/${businessId}/interval-check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: digits, serviceId: selectedServiceId }),
        })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setIntervalWarning(data.hasWarning ? data.message : null)
      } catch {
        // sessiz geç
      }
    }, 500)
    return () => { cancelled = true; clearTimeout(t) }
  }, [businessId, selectedServiceId, customerPhone])

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

  // Kampanya bilgisi (banner için): linkte ?c=<recipient_id> varsa kampanyayı çöz
  useEffect(() => {
    if (!campaignRecipientId) return
    let cancelled = false
    async function fetchCampaign() {
      try {
        const res = await fetch(
          `/api/public/campaign-info?c=${campaignRecipientId}&businessId=${businessId}`,
        )
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled) setCampaignInfo({ name: data.name, description: data.description })
      } catch {
        // Sessiz geç — banner görünmez, randevu akışı çalışmaya devam eder
      }
    }
    fetchCampaign()
    return () => { cancelled = true }
  }, [businessId, campaignRecipientId])

  async function handleSubmit() {
    if (!selectedServiceId || !customerName || !customerPhone) return
    // En az biri olmalı: ya normal tarih/saat ya da bekleme listesi
    const hasNormalBooking = !!(selectedDate && selectedTime)
    if (!hasNormalBooking && !waitlistEnabled) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      // Normal randevu (tarih/saat seçiliyse)
      if (hasNormalBooking) {
        const qs = new URLSearchParams({ businessId })
        if (campaignRecipientId) qs.set('c', campaignRecipientId)
        const res = await fetch(`/api/book?${qs.toString()}`, {
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

      // Bekleme listesine kaydet (işaretliyse)
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
              preferredTime: waitlistTime || undefined,
              autoBookOnMatch: waitlistAutoBook,
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
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white dark:bg-gray-800 shadow-sm mb-5">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Yükleniyor...</p>
      </div>
    )
  }

  if (error || !business) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/20 mb-5">
          <AlertCircle className="h-8 w-8 text-red-400" />
        </div>
        <p className="text-base font-medium text-gray-700 dark:text-gray-300">{error || 'İşletme bulunamadı'}</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Lütfen linki kontrol edin.</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div>
        {/* Business Header */}
        <BusinessHeader business={business} />

        {campaignInfo && (
          <CampaignBanner name={campaignInfo.name} description={campaignInfo.description} />
        )}

        <div className="mt-4 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mb-6">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Randevunuz Alındı!</h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            {business.name} sizi bekliyor.
          </p>

          <div className="mt-6 bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-left space-y-3 text-sm">
            <SummaryRow label="Hizmet" value={selectedService?.name ?? ''} />
            {selectedDate && selectedTime ? (
              <>
                <SummaryRow label="Tarih" value={formatDate(selectedDate)} />
                <SummaryRow label="Saat" value={selectedTime} />
              </>
            ) : waitlistEnabled ? (
              <div className="flex items-center gap-2 py-1.5 px-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <Bell className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">Bekleme listesine eklendiniz — boşluk oluşunca haber vereceğiz.</span>
              </div>
            ) : null}
            {selectedService?.price != null && (
              <SummaryRow label="Ücret" value={formatPrice(selectedService.price)} />
            )}
          </div>

          <button
            onClick={() => {
              setStep(1)
              setSelectedServiceId(null)
              setSelectedDate('')
              setSelectedTime(null)
              setSelectedStaffId('')
              setCustomerName('')
              setCustomerPhone('')
              setWaitlistEnabled(false)
              setWaitlistTime('')
              setWaitlistDate('')
              setWaitlistStaffId('')
              setWaitlistAutoBook(true)
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

      {campaignInfo && (
        <CampaignBanner name={campaignInfo.name} description={campaignInfo.description} />
      )}

      {/* Step Indicator */}
      <div className="mt-4 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 px-6 py-4">
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
                    step > i ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'
                  }`} />
                )}
                {/* Adım: daire + etiket */}
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                      isCompleted
                        ? 'bg-blue-500 text-white shadow-sm shadow-blue-200'
                        : isCurrent
                          ? 'bg-blue-500 text-white shadow-sm shadow-blue-200 ring-4 ring-blue-100 dark:ring-blue-900'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : stepNum}
                  </div>
                  <span className={`mt-1.5 text-[11px] font-medium whitespace-nowrap text-center ${
                    isCurrent ? 'text-blue-600' : isCompleted ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'
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
      <div className="mt-4 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">

        {/* Step 1: Hizmet */}
        {step === 1 && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Hizmet Seçin</h2>
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
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-600 hover:bg-white dark:hover:bg-gray-750'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                            isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'
                          }`}>
                            {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{service.name}</p>
                            {service.description && (
                              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">{service.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          {service.price != null && (
                            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatPrice(service.price)}</p>
                          )}
                          <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 justify-end mt-0.5">
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
            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
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
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Tarih & Saat Seçin</h2>

            {staff.length > 0 && (
              <div className="mb-4">
                <label className="label">Personel (isteğe bağlı)</label>
                <CustomSelect
                  value={selectedStaffId}
                  onChange={(v) => { setSelectedStaffId(v); setSelectedTime(null) }}
                  placeholder="Fark etmez"
                  options={staff.map(s => ({ value: s.id, label: s.name }))}
                />
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
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Bu gün kapalı</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Lütfen farklı bir gün seçin</p>
                  </div>
                ) : slotsLoading ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Müsait saatler yükleniyor...</p>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Bu gün için uygun saat bulunamadı</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Tüm saatler dolu. Farklı bir gün veya personel deneyin.</p>
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
                            : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20'
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
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              <span className="text-xs text-gray-400 dark:text-gray-500 font-medium px-1">veya</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            </div>
            <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={waitlistEnabled}
                  onChange={(e) => {
                    setWaitlistEnabled(e.target.checked)
                    if (e.target.checked) {
                      setWaitlistTime(selectedTime || '')
                      setWaitlistDate(selectedDate || '')
                    }
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    <Bell className="h-4 w-4 text-blue-500" />
                    Randevu boşluğu oluştuğunda beni bilgilendir
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 block">
                    Tercih ettiğiniz zamanda yer açılırsa SMS ile haberdar ederiz.
                  </span>
                </div>
              </label>

              {waitlistEnabled && (
                <div className="mt-4 space-y-3 pl-7">
                  {/* Seçili tarih/saat özeti */}
                  {(selectedDate || selectedTime) && (
                    <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700 font-medium">
                      <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>
                        Tercih ettiğiniz{selectedDate ? ` ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
                        {selectedTime ? ` saat ${selectedTime}` : ''}
                      </span>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-gray-600">Şu saatte:</label>
                    <div className="mt-1">
                      <CustomSelect
                        value={waitlistTime}
                        onChange={setWaitlistTime}
                        placeholder="Saat seçin"
                        options={(business && selectedDate && selectedService
                          ? generateTimeSlots(business.working_hours, selectedDate, selectedService.duration_minutes)
                          : []).map(t => ({ value: t, label: t }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Şu tarihte:</label>
                    <input
                      type="date"
                      value={waitlistDate}
                      onChange={(e) => setWaitlistDate(e.target.value)}
                      min={getTodayStr()}
                      className="input mt-1"
                    />
                  </div>
                  {staff.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-gray-600">Şu personelde:</label>
                      <div className="mt-1">
                        <CustomSelect
                          value={waitlistStaffId}
                          onChange={setWaitlistStaffId}
                          placeholder="Personel seçin"
                          options={staff.map(s => ({ value: s.id, label: s.name }))}
                        />
                      </div>
                    </div>
                  )}
                  <label className="flex items-start gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={waitlistAutoBook}
                      onChange={(e) => setWaitlistAutoBook(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-500 focus:ring-green-500"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-900 flex items-center gap-1.5">
                        <CalendarPlus className="h-4 w-4 text-green-500" />
                        Boşluk oluşursa otomatik al
                      </span>
                      <span className="text-xs text-gray-400 mt-0.5 block">
                        Tercihlerinize göre, boşluk oluştuğunda otomatik randevu alınacaktır.
                      </span>
                    </div>
                  </label>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex gap-2.5">
              <button onClick={() => setStep(1)} className="btn-secondary flex items-center gap-1 px-3" aria-label="Geri">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!waitlistEnabled && (!selectedDate || !selectedTime)}
                className="btn-primary flex-1"
              >
                Devam Et
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Bilgiler */}
        {step === 3 && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Bilgileriniz</h2>
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
              {intervalWarning && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="flex-1 text-amber-900 dark:text-amber-200">
                    <p className="font-medium">Önerilen tekrar aralığı dolmadı</p>
                    <p className="mt-0.5 text-xs opacity-90">{intervalWarning}</p>
                    <p className="mt-1.5 text-xs opacity-75">
                      Yine de devam edebilirsiniz, ancak işletme bu durumu görebilir.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <label className="flex items-start gap-3 mt-4 cursor-pointer">
              <input
                type="checkbox"
                checked={kvkkConsent}
                onChange={(e) => setKvkkConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500"
                required
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Kişisel verilerimin işlenmesine ilişkin{' '}
                <span className="text-blue-500 font-medium">KVKK Aydınlatma Metni</span>&apos;ni
                okudum ve kabul ediyorum.
              </span>
            </label>
            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 flex gap-2.5">
              <button onClick={() => setStep(2)} className="btn-secondary flex items-center gap-1 px-3" aria-label="Geri">
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
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Randevu Özeti</h2>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3 text-sm">
              <SummaryRow label="İşletme" value={business.name} />
              <SummaryRow label="Hizmet" value={selectedService.name} />
              {selectedDate && selectedTime ? (
                <>
                  <SummaryRow label="Tarih" value={formatDate(selectedDate)} />
                  <SummaryRow label="Saat" value={selectedTime} />
                </>
              ) : null}
              <SummaryRow label="Süre" value={`${selectedService.duration_minutes} dk`} />
              {selectedService.price != null && (
                <SummaryRow label="Ücret" value={formatPrice(selectedService.price)} highlight />
              )}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-3">
                <SummaryRow label="Ad Soyad" value={customerName} />
                <SummaryRow label="Telefon" value={customerPhone} />
              </div>
              {waitlistEnabled && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
                  <div className="flex items-center gap-2 py-1.5 px-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <Bell className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                      {selectedDate && selectedTime
                        ? 'Bekleme listesine de kaydedilecek'
                        : 'Bekleme listesine eklenecek — boşluk oluşunca haber vereceğiz'}
                    </span>
                  </div>
                  {waitlistAutoBook && (
                    <div className="flex items-center gap-2 py-1.5 px-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <CalendarPlus className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-xs text-green-700 dark:text-green-300 font-medium">
                        Tercihinize uygun boşluk oluştuğunda otomatik randevu alınacak (onay bekler)
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 flex gap-2.5">
              <button onClick={() => setStep(3)} className="btn-secondary flex items-center gap-1 px-3" aria-label="Geri">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary flex-1"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {!selectedDate || !selectedTime ? 'Bekleme Listesine Kaydol' : 'Randevuyu Onayla'}
              </button>
            </div>

            {submitError && (
              <div className="mt-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400 flex gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                {submitError}
              </div>
            )}

            <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
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
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden relative">
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
          <Image
            src={business.settings.logo_url}
            alt={business.name}
            width={80}
            height={80}
            className="rounded-full object-cover border-4 border-white shadow-md"
          />
        ) : (
          <div className="h-20 w-20 rounded-full bg-blue-500 border-4 border-white shadow-md flex items-center justify-center text-white text-2xl font-bold">
            {initials}
          </div>
        )}

        <h1 className="mt-3 text-lg font-bold text-gray-900 dark:text-gray-100 text-center">{business.name}</h1>

        {(business.phone || location) && (
          <div className="mt-1.5 flex flex-wrap justify-center items-center gap-x-3 gap-y-1">
            {business.phone && (
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Phone className="h-3 w-3" />
                {business.phone}
              </span>
            )}
            {location && (
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
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
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`font-medium ${highlight ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}>{value}</span>
    </div>
  )
}

function CampaignBanner({ name, description }: { name: string; description: string | null }) {
  return (
    <div className="mt-4 rounded-2xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-start gap-3">
      <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
        <Sparkles className="h-5 w-5 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          Size özel kampanya
        </p>
        <p className="mt-0.5 text-sm font-semibold text-amber-900 dark:text-amber-200">{name}</p>
        {description && (
          <p className="mt-1 text-xs text-amber-800 leading-relaxed whitespace-pre-wrap">
            {description}
          </p>
        )}
      </div>
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
