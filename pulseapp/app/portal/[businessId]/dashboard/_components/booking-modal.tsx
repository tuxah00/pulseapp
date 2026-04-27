'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { CalendarPlus, X, Loader2, Check, Package } from 'lucide-react'
import { CustomSelect } from '@/components/ui/custom-select'
import { cn, formatCurrency } from '@/lib/utils'

interface ServiceOption {
  id: string
  name: string
  price: number | null
  duration_minutes: number
}

interface StaffOption {
  id: string
  name: string
}

interface BookingModalProps {
  businessId: string
  open: boolean
  onClose: () => void
  /** Randevu başarıyla oluşturulunca tetiklenir (refetch). */
  onCreated?: () => void
  /** Paket üzerinden randevu alınıyorsa — hizmet önceden seçili gelir */
  preselectedServiceId?: string
  /** Kullanılacak paket ID (seans düşümü için API'ye gönderilir) */
  customerPackageId?: string
  /** Paket adı (banner metni için) */
  packageName?: string
  /** Pakette kalan seans sayısı (banner için) */
  sessionsRemaining?: number
}

/**
 * Müşterinin portal içinden online randevu oluşturmasını sağlayan modal.
 *
 * Akış: hizmet → personel (opsiyonel) → tarih → slot → onay → POST
 *
 * Paket modu (preselectedServiceId + customerPackageId verilince):
 * - Hizmet seçimi kilitli/read-only gelir
 * - Paket banner'ı gösterilir
 * - API'ye packageId gönderilir → seans düşülür
 *
 * Endpoint'ler:
 * - GET  /api/public/business/[id]/services
 * - GET  /api/public/business/[id]/staff?serviceId=...
 * - GET  /api/public/business/[id]/slots?date=...&serviceId=...&staffId=...
 * - POST /api/portal/appointments
 */
export default function BookingModal({
  businessId,
  open,
  onClose,
  onCreated,
  preselectedServiceId,
  customerPackageId,
  packageName,
  sessionsRemaining,
}: BookingModalProps) {
  const isPackageMode = !!(preselectedServiceId && customerPackageId)

  // Veri
  const [services, setServices] = useState<ServiceOption[]>([])
  const [staff, setStaff] = useState<StaffOption[]>([])
  const [slots, setSlots] = useState<string[]>([])

  // Seçimler
  const [serviceId, setServiceId] = useState(preselectedServiceId ?? '')
  const [staffId, setStaffId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [notes, setNotes] = useState('')

  // Durumlar
  const [loadingServices, setLoadingServices] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)

  // Animasyonlu kapama
  const handleClose = useCallback(() => {
    if (submitting) return
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      onClose()
    }, 200)
  }, [submitting, onClose])

  // ESC ile kapama
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, handleClose])

  // Modal açıldığında state'i sıfırla + hizmetleri yükle
  useEffect(() => {
    if (!open) return
    // Paket modunda hizmet ID'si korunur, diğerleri sıfırlanır
    setServiceId(preselectedServiceId ?? '')
    setStaffId('')
    setStaff([])
    setDate('')
    setStartTime('')
    setSlots([])
    setNotes('')
    setError(null)

    setLoadingServices(true)
    fetch(`/api/public/business/${businessId}/services`)
      .then((r) => r.json())
      .then((d) => setServices(d.services || []))
      .catch(() => setError('Hizmetler yüklenemedi'))
      .finally(() => setLoadingServices(false))
  }, [open, businessId, preselectedServiceId])

  // Hizmet seçilince personel listesini çek
  useEffect(() => {
    if (!serviceId) {
      setStaff([])
      setStaffId('')
      return
    }
    fetch(`/api/public/business/${businessId}/staff?serviceId=${serviceId}`)
      .then((r) => r.json())
      .then((d) => setStaff(d.staff || []))
      .catch(() => setStaff([]))
  }, [serviceId, businessId])

  const selectedService = services.find((s) => s.id === serviceId) ?? null

  // Tarih+hizmet+personel hazırsa slot çek
  useEffect(() => {
    if (!selectedService || !date) {
      setSlots([])
      setStartTime('')
      return
    }
    setLoadingSlots(true)
    setSlots([])
    setStartTime('')
    const params = new URLSearchParams({ date, duration: String(selectedService.duration_minutes) })
    if (staffId) params.set('staffId', staffId)
    fetch(`/api/public/business/${businessId}/slots?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setSlots(Array.isArray(d.slots) ? d.slots : []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false))
  }, [selectedService, staffId, date, businessId])

  // Bugünden 60 güne kadar
  const todayStr = new Date().toISOString().split('T')[0]
  const maxDateObj = new Date()
  maxDateObj.setDate(maxDateObj.getDate() + 60)
  const maxDateStr = maxDateObj.toISOString().split('T')[0]

  const canSubmit = !!(serviceId && date && startTime && !submitting)

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        serviceId,
        staffId: staffId || null,
        date,
        startTime,
        notes: notes.trim() || undefined,
      }
      if (customerPackageId) body.packageId = customerPackageId

      const res = await fetch('/api/portal/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Randevu oluşturulamadı')
        setSubmitting(false)
        return
      }
      window.dispatchEvent(new CustomEvent('pulse-toast', {
        detail: {
          type: 'appointment',
          title: 'Randevu oluşturuldu',
          body: isPackageMode
            ? 'Paket seansınız planlandı, salon onayı bekleniyor.'
            : 'Randevunuz başarıyla alındı, salon onayı bekleniyor.',
        },
      }))
      onCreated?.()
      setSubmitting(false)
      setClosing(true)
      setTimeout(() => {
        setClosing(false)
        onClose()
      }, 200)
    } catch {
      setError('Bağlantı hatası')
      setSubmitting(false)
    }
  }

  if (!open) return null

  return createPortal(
    <div
      className={cn('modal-overlay fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4', closing && 'closing')}
      onClick={handleClose}
    >
      <div
        className={cn('modal-content card w-full max-w-lg max-h-[90vh] overflow-y-auto', closing && 'closing')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-pulse-50 dark:bg-pulse-900/30 flex items-center justify-center">
              {isPackageMode
                ? <Package className="w-4 h-4 text-pulse-900 dark:text-pulse-300" />
                : <CalendarPlus className="w-4 h-4 text-pulse-900 dark:text-pulse-300" />
              }
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {isPackageMode ? 'Paket Seansı Planla' : 'Yeni Randevu Al'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            aria-label="Kapat"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Paket banner */}
        {isPackageMode && packageName && (
          <div className="mx-6 mt-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 flex items-start gap-3">
            <Package className="w-4 h-4 text-amber-700 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-300">{packageName}</p>
              <p className="text-amber-700 dark:text-amber-400 mt-0.5">
                Bu randevu paketinizden 1 seans kullanacak.
                {sessionsRemaining !== undefined && (
                  <> Randevu sonrası {sessionsRemaining - 1} seans kalacak.</>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Hizmet */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Hizmet <span className="text-red-500">*</span>
            </label>
            {loadingServices ? (
              <div className="h-10 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ) : isPackageMode && selectedService ? (
              /* Paket modunda hizmet kilitli */
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <Package className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {selectedService.name}
                  {selectedService.duration_minutes && (
                    <span className="text-gray-500 dark:text-gray-400"> ({selectedService.duration_minutes} dk)</span>
                  )}
                </span>
              </div>
            ) : (
              <CustomSelect
                options={[
                  { value: '', label: '— Hizmet seçin —' },
                  ...services.map((s) => ({
                    value: s.id,
                    label: `${s.name} (${s.duration_minutes} dk${s.price ? ` · ${formatCurrency(s.price)}` : ''})`,
                  })),
                ]}
                value={serviceId}
                onChange={setServiceId}
              />
            )}
          </div>

          {/* Personel (opsiyonel) */}
          {serviceId && staff.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Personel <span className="text-gray-400 font-normal">(opsiyonel)</span>
              </label>
              <CustomSelect
                options={[
                  { value: '', label: 'Müsait olan ilk personel' },
                  ...staff.map((s) => ({ value: s.id, label: s.name })),
                ]}
                value={staffId}
                onChange={setStaffId}
              />
            </div>
          )}

          {/* Tarih */}
          {serviceId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Tarih <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                min={todayStr}
                max={maxDateStr}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-pulse-900/20 focus:border-pulse-900"
              />
            </div>
          )}

          {/* Slot */}
          {serviceId && date && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Saat <span className="text-red-500">*</span>
              </label>
              {loadingSlots ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Müsait saatler aranıyor...
                </div>
              ) : slots.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 py-3 text-center bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  Bu tarihte müsait saat yok. Başka bir tarih seçin.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setStartTime(slot)}
                      className={cn(
                        'px-2 py-1.5 rounded-lg text-sm font-medium transition-colors border',
                        startTime === slot
                          ? 'bg-pulse-900 text-white border-pulse-900'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:border-pulse-900 dark:hover:border-pulse-300'
                      )}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Not */}
          {startTime && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Not <span className="text-gray-400 font-normal">(opsiyonel)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Eklemek istediğiniz bir not var mı?"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pulse-900/20 focus:border-pulse-900 resize-none"
              />
            </div>
          )}

          {/* Özet */}
          {selectedService && date && startTime && (
            <div className="rounded-lg bg-pulse-50 dark:bg-pulse-900/20 border border-pulse-100 dark:border-pulse-900/40 p-3 text-sm">
              <div className="font-medium text-pulse-900 dark:text-pulse-300 mb-1">Özet</div>
              <div className="text-gray-700 dark:text-gray-300 space-y-0.5">
                <div>{selectedService.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(date + 'T00:00:00').toLocaleDateString('tr-TR', {
                    weekday: 'long', day: 'numeric', month: 'long',
                  })} · {startTime}
                </div>
                {isPackageMode && (
                  <div className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1">
                    📦 Paket seansı olarak kullanılacak
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
          <button
            onClick={handleClose}
            disabled={submitting}
            className="btn-secondary disabled:opacity-50"
          >
            İptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Oluşturuluyor...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {isPackageMode ? 'Seans Planla' : 'Randevu Al'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
