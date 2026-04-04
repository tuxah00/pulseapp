'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  Calendar, Clock, User, MapPin, Phone, Loader2, AlertTriangle,
  CheckCircle, XCircle, Edit3, ChevronLeft
} from 'lucide-react'
import { STATUS_LABELS } from '@/types'
import type { AppointmentStatus } from '@/types'

interface AppointmentData {
  id: string
  date: string
  startTime: string
  endTime: string
  status: AppointmentStatus
  notes: string | null
  isEditable: boolean
  customer: { name: string; phone: string } | null
  service: { name: string; duration_minutes: number; price: number | null } | null
  staff: { name: string } | null
  business: { id: string; name: string; phone: string | null; city: string | null; district: string | null; settings: Record<string, unknown> } | null
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-gray-100 text-gray-800',
}

export default function ManageAppointmentPage() {
  const params = useParams()
  const token = params.token as string

  const [appointment, setAppointment] = useState<AppointmentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit mode
  const [editing, setEditing] = useState(false)
  const [editDate, setEditDate] = useState('')
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [saving, setSaving] = useState(false)

  // Cancel mode
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    fetch(`/api/public/appointments/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setAppointment(data.appointment)
          setEditDate(data.appointment.date)
          setEditStartTime(data.appointment.startTime)
          setEditEndTime(data.appointment.endTime)
        }
      })
      .catch(() => setError('Bir hata oluştu'))
      .finally(() => setLoading(false))
  }, [token])

  const handleSaveEdit = async () => {
    if (!editDate || !editStartTime || !editEndTime) return
    setSaving(true)
    setActionSuccess(null)
    try {
      const res = await fetch(`/api/public/appointments/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: editDate, startTime: editStartTime, endTime: editEndTime }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setActionSuccess('Randevunuz başarıyla güncellendi')
        setEditing(false)
        // Refetch
        const refreshRes = await fetch(`/api/public/appointments/${token}`)
        const refreshData = await refreshRes.json()
        if (refreshData.appointment) setAppointment(refreshData.appointment)
      }
    } catch {
      setError('Bir hata oluştu')
    } finally { setSaving(false) }
  }

  const handleCancel = async () => {
    setCancelling(true)
    setActionSuccess(null)
    try {
      const res = await fetch(`/api/public/appointments/${token}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason || 'Müşteri tarafından iptal edildi' }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setActionSuccess('Randevunuz iptal edildi')
        setShowCancel(false)
        // Refetch
        const refreshRes = await fetch(`/api/public/appointments/${token}`)
        const refreshData = await refreshRes.json()
        if (refreshData.appointment) setAppointment(refreshData.appointment)
      }
    } catch {
      setError('Bir hata oluştu')
    } finally { setCancelling(false) }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error && !appointment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-900 mb-2">Randevu Bulunamadı</h1>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!appointment) return null

  const formattedDate = new Date(appointment.date).toLocaleDateString('tr-TR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
  const location = [appointment.business?.district, appointment.business?.city].filter(Boolean).join(', ')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-lg px-4 py-8">
        {/* Business header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-900">{appointment.business?.name}</h1>
          {(appointment.business?.phone || location) && (
            <div className="flex justify-center items-center gap-3 mt-1">
              {appointment.business?.phone && (
                <span className="text-xs text-gray-500 flex items-center gap-1"><Phone className="h-3 w-3" />{appointment.business.phone}</span>
              )}
              {location && (
                <span className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" />{location}</span>
              )}
            </div>
          )}
        </div>

        {/* Success/Error messages */}
        {actionSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
            <p className="text-sm text-green-700">{actionSuccess}</p>
          </div>
        )}
        {error && appointment && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Appointment Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Randevu Bilgileri</h2>
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLORS[appointment.status] || STATUS_COLORS.pending}`}>
                {STATUS_LABELS[appointment.status]}
              </span>
            </div>

            <div className="space-y-3">
              {appointment.service && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><Clock className="h-4 w-4 text-blue-500" /></div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{appointment.service.name}</p>
                    <p className="text-xs text-gray-500">{appointment.service.duration_minutes} dakika</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center"><Calendar className="h-4 w-4 text-purple-500" /></div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{formattedDate}</p>
                  <p className="text-xs text-gray-500">{appointment.startTime} — {appointment.endTime}</p>
                </div>
              </div>

              {appointment.staff && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center"><User className="h-4 w-4 text-green-500" /></div>
                  <p className="font-medium text-gray-900 text-sm">{appointment.staff.name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Edit Form */}
          {editing && appointment.isEditable && (
            <div className="border-t border-gray-200 p-6 bg-gray-50 space-y-4">
              <h3 className="font-medium text-gray-900 text-sm flex items-center gap-1">
                <Edit3 className="h-4 w-4" /> Tarih/Saat Değiştir
              </h3>
              <div>
                <label className="text-xs text-gray-500">Tarih</label>
                <input type="date" className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  value={editDate} onChange={e => setEditDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Başlangıç</label>
                  <input type="time" className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    value={editStartTime} onChange={e => setEditStartTime(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Bitiş</label>
                  <input type="time" className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    value={editEndTime} onChange={e => setEditEndTime(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                  Vazgeç
                </button>
                <button onClick={handleSaveEdit} disabled={saving} className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Kaydet'}
                </button>
              </div>
            </div>
          )}

          {/* Cancel Confirmation */}
          {showCancel && appointment.isEditable && (
            <div className="border-t border-gray-200 p-6 bg-red-50 space-y-4">
              <h3 className="font-medium text-red-800 text-sm flex items-center gap-1">
                <XCircle className="h-4 w-4" /> Randevuyu İptal Et
              </h3>
              <div>
                <label className="text-xs text-gray-600">İptal Nedeni (opsiyonel)</label>
                <select className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  value={cancelReason} onChange={e => setCancelReason(e.target.value)}>
                  <option value="">Neden seçin</option>
                  <option value="Zamanım uygun değil">Zamanım uygun değil</option>
                  <option value="Başka bir randevu aldım">Başka bir randevu aldım</option>
                  <option value="Sağlık sorunu">Sağlık sorunu</option>
                  <option value="Diğer">Diğer</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowCancel(false)} className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors bg-white">
                  Vazgeç
                </button>
                <button onClick={handleCancel} disabled={cancelling} className="flex-1 py-2 px-4 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors disabled:opacity-50">
                  {cancelling ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'İptal Et'}
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {appointment.isEditable && !editing && !showCancel && (
            <div className="border-t border-gray-200 p-4 flex gap-3">
              <button onClick={() => { setEditing(true); setError(null); setActionSuccess(null) }}
                className="flex-1 py-2.5 px-4 border border-blue-500 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5">
                <Edit3 className="h-4 w-4" /> Düzenle
              </button>
              <button onClick={() => { setShowCancel(true); setError(null); setActionSuccess(null) }}
                className="flex-1 py-2.5 px-4 border border-red-300 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5">
                <XCircle className="h-4 w-4" /> İptal Et
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          PulseApp ile oluşturulmuştur
        </p>
      </div>
    </div>
  )
}
