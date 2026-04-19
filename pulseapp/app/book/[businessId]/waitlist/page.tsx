'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Clock, Calendar, User, X, CheckCircle, Phone } from 'lucide-react'

interface WaitlistEntry {
  id: string
  customer_name: string
  customer_phone: string
  preferred_date: string | null
  preferred_time_start: string | null
  is_active: boolean
  created_at: string
  services: { name: string } | null
  staff_members: { name: string } | null
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5)
}

export default function CustomerWaitlistPage() {
  const { businessId } = useParams<{ businessId: string }>()
  const [phone, setPhone] = useState('')
  const [entries, setEntries] = useState<WaitlistEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set())

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone.trim()) return
    setLoading(true)
    setError('')
    setEntries(null)

    const res = await fetch(
      `/api/public/business/${businessId}/waitlist?phone=${encodeURIComponent(phone.trim())}`
    )
    setLoading(false)

    if (!res.ok) {
      setError('Kayıtlar alınamadı. Lütfen tekrar deneyin.')
      return
    }
    const data = await res.json()
    setEntries(data.entries ?? [])
  }

  const handleCancel = async (entryId: string) => {
    setCancellingId(entryId)
    const res = await fetch(
      `/api/public/business/${businessId}/waitlist?entryId=${entryId}&phone=${encodeURIComponent(phone.trim())}`,
      { method: 'DELETE' }
    )
    setCancellingId(null)
    if (res.ok) {
      setCancelledIds(prev => new Set(prev).add(entryId))
    }
  }

  const visibleEntries = (entries ?? []).filter(e => !cancelledIds.has(e.id))

  return (
    <div className="booking-page min-h-screen bg-gray-50 flex items-start justify-center py-10 px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Başlık */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-pulse-900 flex items-center justify-center mx-auto mb-3">
            <Clock className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Bekleme Listesi</h1>
          <p className="text-sm text-gray-500 mt-1">Telefon numaranızla kayıtlarınıza ulaşın</p>
        </div>

        {/* Telefon formu */}
        <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefon Numarası</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="05XX XXX XX XX"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pulse-900/20 focus:border-pulse-900"
                required
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-pulse-900 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? 'Aranıyor...' : 'Kayıtlarımı Göster'}
          </button>
        </form>

        {/* Sonuçlar */}
        {entries !== null && (
          <div className="space-y-3">
            {visibleEntries.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
                <CheckCircle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-500">Bu numarayla aktif bekleme kaydı bulunamadı.</p>
              </div>
            ) : (
              visibleEntries.map(entry => (
                <div key={entry.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      {entry.services?.name && (
                        <p className="text-sm font-semibold text-gray-900">{entry.services.name}</p>
                      )}
                      {entry.staff_members?.name && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <User className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>{entry.staff_members.name}</span>
                        </div>
                      )}
                      {entry.preferred_date && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>{formatDate(entry.preferred_date)}</span>
                          {entry.preferred_time_start && (
                            <span>· {formatTime(entry.preferred_time_start)}</span>
                          )}
                        </div>
                      )}
                      {!entry.services?.name && !entry.preferred_date && (
                        <p className="text-xs text-gray-400">Tercih belirtilmemiş</p>
                      )}
                      <p className="text-[10px] text-gray-400">
                        Kayıt: {new Date(entry.created_at).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCancel(entry.id)}
                      disabled={cancellingId === entry.id}
                      className="flex-shrink-0 flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 border border-red-200 hover:border-red-300 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50"
                    >
                      {cancellingId === entry.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <X className="h-3.5 w-3.5" />}
                      İptal Et
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
