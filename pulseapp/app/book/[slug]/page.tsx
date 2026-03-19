'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  CheckCircle2, ChevronLeft, Loader2, Clock, Calendar,
  User, Phone, AlertCircle, Bell,
} from 'lucide-react'
import type { WorkingHours } from '@/types'

interface BusinessData {
  id: string
  name: string
  sector: string
  working_hours: WorkingHours
  phone: string | null
  address: string | null
  city: string | null
  district: string | null
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
  const slug = params.slug as string

  // Data
  const [business, setBusiness] = useState<BusinessData | null>(null)
  const [services, setServices] = useState<ServiceData[]>([])
  const [staff, setStaff] = useState<StaffData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Step
  const [step, setStep] = useState(1)

  // Selections
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')

  // Waitlist
  const [waitlistEnabled, setWaitlistEnabled] = useState(false)
  const [waitlistTime, setWaitlistTime] = useState('')
  const [waitlistDate, setWaitlistDate] = useState('')
  const [waitlistStaffId, setWaitlistStaffId] = useState('')
  const [waitlistEarliest, setWaitlistEarliest] = useState(false)

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Computed
  const selectedService = services.find(s => s.id === selectedServiceId) || null
  const timeSlots = business && selectedDate && selectedService
    ? generateTimeSlots(business.working_hours, selectedDate, selectedService.duration_minutes)
    : []
  const isDayClosed = business && selectedDate && getDayKey(selectedDate)
    ? !business.working_hours[getDayKey(selectedDate)]
    : false

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/book/${slug}`)
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
  }, [slug])

  async function handleSubmit() {
    if (!selectedServiceId || !selectedDate || !selectedTime || !customerName || !customerPhone) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch(`/api/book/${slug}`, {
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

      setSubmitted(true)
    } catch {
      setSubmitError('Bir hata oluştu. Lütfen tekrar deneyin.')
    }
    setSubmitting(false)
  }

  // Loading
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="mt-4 text-sm text-gray-500">Yükleniyor...</p>
      </div>
    )
  }

  // Error
  if (error || !business) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="mt-4 text-gray-600">{error || 'İşletme bulunamadı'}</p>
      </div>
    )
  }

  // Success
  if (submitted) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="mt-6 text-2xl font-bold text-gray-900">Randevunuz Alındı!</h2>
        <p className="mt-2 text-gray-500">
          {business.name} için randevunuz başarıyla oluşturuldu.
        </p>
        <div className="mt-6 card text-left text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">Hizmet</span>
            <span className="font-medium text-gray-900">{selectedService?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Tarih</span>
            <span className="font-medium text-gray-900">{formatDate(selectedDate)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Saat</span>
            <span className="font-medium text-gray-900">{selectedTime}</span>
          </div>
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
            setSubmitted(false)
          }}
          className="mt-6 btn-secondary"
        >
          Yeni Randevu Al
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* İşletme Adı */}
      <h1 className="text-xl font-bold text-gray-900 mb-6">{business.name}</h1>

      {/* Stepper */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((label, i) => {
          const stepNum = i + 1
          const isCompleted = step > stepNum
          const isCurrent = step === stepNum
          return (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    isCompleted || isCurrent
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    stepNum
                  )}
                </div>
                <span className={`mt-1 text-[11px] ${isCurrent ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`mx-1 h-0.5 w-6 sm:w-10 ${step > stepNum ? 'bg-blue-500' : 'bg-gray-200'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step 1: Hizmet */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Hizmet Seçin</h2>
          {services.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Bu işletmenin aktif hizmeti yok.</p>
          ) : (
            <div className="space-y-3">
              {services.map((service) => (
                <button
                  key={service.id}
                  onClick={() => setSelectedServiceId(service.id)}
                  className={`w-full text-left rounded-xl border p-4 transition-all ${
                    selectedServiceId === service.id
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{service.name}</p>
                      {service.description && (
                        <p className="mt-0.5 text-sm text-gray-500">{service.description}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      {service.price != null && (
                        <p className="font-semibold text-gray-900">{formatPrice(service.price)}</p>
                      )}
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {service.duration_minutes} dk
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="mt-6">
            <button
              onClick={() => setStep(2)}
              disabled={!selectedServiceId}
              className="btn-primary w-full"
            >
              Devam
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Tarih & Saat */}
      {step === 2 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tarih & Saat Seçin</h2>

          {/* Personel seçimi (opsiyonel) */}
          {staff.length > 0 && (
            <div className="mb-4">
              <label className="label">Personel (isteğe bağlı)</label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="input"
              >
                <option value="">Fark etmez</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Tarih */}
          <div className="mb-4">
            <label className="label">
              <Calendar className="inline h-4 w-4 mr-1" />
              Tarih
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

          {/* Saat slotları */}
          {selectedDate && (
            <div>
              <label className="label">
                <Clock className="inline h-4 w-4 mr-1" />
                Saat
              </label>
              {isDayClosed ? (
                <p className="text-center py-6 text-gray-500 bg-gray-100 rounded-lg">
                  Bu gün kapalı
                </p>
              ) : timeSlots.length === 0 ? (
                <p className="text-center py-6 text-gray-500 bg-gray-100 rounded-lg">
                  Uygun saat bulunamadı
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {timeSlots.map((time) => (
                    <button
                      key={time}
                      onClick={() => setSelectedTime(time)}
                      className={`rounded-lg py-2.5 text-sm font-medium transition-colors ${
                        selectedTime === time
                          ? 'bg-blue-500 text-white'
                          : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300'
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <button onClick={() => setStep(1)} className="btn-secondary flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" /> Geri
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!selectedDate || !selectedTime}
              className="btn-primary flex-1"
            >
              Devam
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Bilgiler */}
      {step === 3 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Bilgileriniz</h2>
          <div className="space-y-4">
            <div>
              <label className="label">
                <User className="inline h-4 w-4 mr-1" />
                Ad Soyad
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
              <label className="label">
                <Phone className="inline h-4 w-4 mr-1" />
                Telefon
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
          <div className="mt-6 flex gap-3">
            <button onClick={() => setStep(2)} className="btn-secondary flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" /> Geri
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={!customerName.trim() || !customerPhone.trim()}
              className="btn-primary flex-1"
            >
              Devam
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Onay */}
      {step === 4 && selectedService && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Randevu Özeti</h2>

          <div className="card">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">İşletme</span>
                <span className="font-medium text-gray-900">{business.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Hizmet</span>
                <span className="font-medium text-gray-900">{selectedService.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tarih</span>
                <span className="font-medium text-gray-900">{formatDate(selectedDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Saat</span>
                <span className="font-medium text-gray-900">{selectedTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Süre</span>
                <span className="font-medium text-gray-900">{selectedService.duration_minutes} dk</span>
              </div>
              {selectedService.price != null && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Ücret</span>
                  <span className="font-medium text-gray-900">{formatPrice(selectedService.price)}</span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-3 flex justify-between">
                <span className="text-gray-500">Ad Soyad</span>
                <span className="font-medium text-gray-900">{customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Telefon</span>
                <span className="font-medium text-gray-900">{customerPhone}</span>
              </div>
            </div>
          </div>

          {/* Butonlar */}
          <div className="mt-6 flex gap-3">
            <button onClick={() => setStep(3)} className="btn-secondary flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" /> Geri
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-primary flex-1"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Randevuyu Onayla
            </button>
          </div>

          {submitError && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          {/* Waitlist Checkbox */}
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={waitlistEnabled}
                onChange={(e) => setWaitlistEnabled(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                  <Bell className="h-4 w-4 text-blue-500" />
                  Randevu boşluğu oluştuğunda beni SMS ile bilgilendir
                </span>
                <span className="text-xs text-gray-500 mt-0.5 block">
                  Tercih ettiğiniz zamanda yer açılırsa size haber veririz.
                </span>
              </div>
            </label>

            {waitlistEnabled && (
              <div className="mt-4 space-y-3 pl-7">
                {/* Saat tercihi */}
                <div>
                  <label className="text-sm text-gray-600">Şu saatte:</label>
                  <select
                    value={waitlistTime}
                    onChange={(e) => {
                      setWaitlistTime(e.target.value)
                      if (e.target.value) setWaitlistEarliest(false)
                    }}
                    className="input mt-1"
                  >
                    <option value="">Saat seçin</option>
                    {timeSlots.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Tarih tercihi */}
                <div>
                  <label className="text-sm text-gray-600">Şu tarihte:</label>
                  <input
                    type="date"
                    value={waitlistDate}
                    onChange={(e) => {
                      setWaitlistDate(e.target.value)
                      if (e.target.value) setWaitlistEarliest(false)
                    }}
                    min={getTodayStr()}
                    className="input mt-1"
                  />
                </div>

                {/* Personel tercihi */}
                {staff.length > 0 && (
                  <div>
                    <label className="text-sm text-gray-600">Şu personelde:</label>
                    <select
                      value={waitlistStaffId}
                      onChange={(e) => {
                        setWaitlistStaffId(e.target.value)
                        if (e.target.value) setWaitlistEarliest(false)
                      }}
                      className="input mt-1"
                    >
                      <option value="">Personel seçin</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* En yakın zamanda */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={waitlistEarliest}
                    onChange={(e) => {
                      setWaitlistEarliest(e.target.checked)
                      if (e.target.checked) {
                        setWaitlistTime('')
                        setWaitlistDate('')
                        setWaitlistStaffId('')
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">En yakın zamanda</span>
                </label>
              </div>
            )}
          </div>

          <p className="mt-4 text-center text-xs text-gray-400">
            Randevunuzu onaylayarak {business.name} ile iletişim kurulmasına izin vermiş olursunuz.
          </p>
        </div>
      )}
    </div>
  )
}
