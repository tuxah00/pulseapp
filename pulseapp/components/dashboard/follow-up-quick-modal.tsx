'use client'

import { useState, useEffect } from 'react'
import { Bell, X, Clock, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateISO } from '@/lib/utils'

export type FollowUpType = 'post_session' | 'next_session_reminder' | 'protocol_completion' | 'package_sold' | 'manual'

const TYPE_OPTIONS: { value: FollowUpType; label: string; description: string }[] = [
  { value: 'post_session',            label: 'Seans Sonrası',         description: 'Müşteri seans sonrası nasıl hissediyor?' },
  { value: 'next_session_reminder',   label: 'Sonraki Seans Hatırlatma', description: 'Bir sonraki randevuyu hatırlat' },
  { value: 'package_sold',            label: 'Paket Başlangıcı',      description: 'Paketi kullanmaya başlaması için hatırlatıcı' },
  { value: 'protocol_completion',     label: 'Protokol Tamamlama',    description: 'Tedavi protokolü tamamlandı, takip zamanı' },
  { value: 'manual',                  label: 'Manuel Takip',          description: 'Özel bir hatırlatıcı veya takip mesajı' },
]

// Gün ekleyerek YYYY-MM-DD döner
function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return formatDateISO(d)
}

interface Props {
  open: boolean
  onClose: () => void
  onCreated?: () => void
  businessId: string
  customerId: string
  customerName: string
  appointmentId?: string
  customerPackageId?: string
  protocolId?: string
  defaultType?: FollowUpType
  /** Varsayılan gün ofseti (default: 3) */
  defaultDaysOffset?: number
}

export function FollowUpQuickModal({
  open, onClose, onCreated,
  businessId, customerId, customerName,
  appointmentId, customerPackageId, protocolId,
  defaultType = 'post_session',
  defaultDaysOffset = 3,
}: Props) {
  const [type, setType] = useState<FollowUpType>(defaultType)
  const [scheduledDate, setScheduledDate] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [closing, setClosing] = useState(false)
  const [done, setDone] = useState(false)

  // Açıldığında state'i sıfırla
  useEffect(() => {
    if (open) {
      setType(defaultType)
      setScheduledDate(addDays(defaultDaysOffset))
      setMessage('')
      setDone(false)
      setClosing(false)
    }
  }, [open, defaultType, defaultDaysOffset])

  // ESC ile kapat
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open])

  function handleClose() {
    setClosing(true)
  }

  function onAnimEnd() {
    if (closing) { setClosing(false); onClose() }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!scheduledDate) return
    setSaving(true)
    try {
      const res = await fetch('/api/follow-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          customerId,
          appointmentId: appointmentId || undefined,
          customerPackageId: customerPackageId || undefined,
          protocolId: protocolId || undefined,
          type,
          scheduledFor: new Date(scheduledDate + 'T09:00:00').toISOString(),
          message: message.trim() || null,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: json.error || 'Takip oluşturulamadı' } }))
        return
      }
      setDone(true)
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Takip oluşturuldu', body: `${customerName} için ${scheduledDate} tarihine eklendi` } }))
      onCreated?.()
      setTimeout(() => handleClose(), 900)
    } catch {
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Bağlantı hatası' } }))
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      className={cn('fixed inset-0 z-[120] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 modal-overlay', closing && 'closing')}
      onClick={handleClose}
      onAnimationEnd={onAnimEnd}
    >
      <div
        className="modal-content w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              <Bell className="h-4.5 w-4.5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Takip Başlat</p>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">{customerName}</h3>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <div className="h-12 w-12 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Takip oluşturuldu!</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-5 space-y-4">
            {/* Tip */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Takip Tipi</label>
              <div className="grid grid-cols-1 gap-1.5">
                {TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={cn(
                      'flex items-start gap-3 text-left px-3 py-2.5 rounded-xl border transition-all',
                      type === opt.value
                        ? 'border-pulse-900 bg-pulse-900/5 dark:border-pulse-700 dark:bg-pulse-900/20'
                        : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
                    )}
                  >
                    <div className={cn(
                      'mt-0.5 h-4 w-4 rounded-full border-2 flex-shrink-0',
                      type === opt.value ? 'border-pulse-900 bg-pulse-900 dark:border-pulse-400 dark:bg-pulse-400' : 'border-gray-300 dark:border-gray-600'
                    )} />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-tight">{opt.label}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{opt.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tarih */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Takip Tarihi
              </label>
              <div className="flex gap-2">
                {[{ label: '1G', days: 1 }, { label: '3G', days: 3 }, { label: '1H', days: 7 }, { label: '2H', days: 14 }].map(opt => (
                  <button
                    key={opt.days}
                    type="button"
                    onClick={() => setScheduledDate(addDays(opt.days))}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                      scheduledDate === addDays(opt.days)
                        ? 'bg-pulse-900 text-white border-pulse-900 dark:bg-pulse-700 dark:border-pulse-700'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-pulse-900/40'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <input
                type="date"
                value={scheduledDate}
                min={formatDateISO(new Date())}
                onChange={e => setScheduledDate(e.target.value)}
                required
                className="input w-full"
              />
            </div>

            {/* Mesaj (opsiyonel) */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Mesaj <span className="normal-case font-normal">(opsiyonel)</span>
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Özel bir not veya hatırlatma mesajı..."
                rows={2}
                className="input w-full resize-none text-sm"
              />
            </div>

            {/* Butonlar */}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={handleClose} className="flex-1 btn-outline text-sm">İptal</button>
              <button type="submit" disabled={saving || !scheduledDate} className="flex-1 btn-primary text-sm">
                {saving ? 'Kaydediliyor…' : 'Takip Başlat'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
