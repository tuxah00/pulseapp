'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  CalendarCheck, Clock, CheckCircle, XCircle, AlertCircle,
  Star, Gift, LogOut, Loader2, Plus, ChevronRight, User
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Customer {
  id: string
  name: string
  phone: string
  segment: string
}

interface Business {
  id: string
  name: string
  logo_url?: string
  sector?: string
}

interface Appointment {
  id: string
  appointment_date: string
  start_time: string
  end_time?: string
  status: string
  services?: { name: string; price?: number }
  staff_members?: { name: string }
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Bekliyor',
  confirmed: 'Onaylandı',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
  no_show: 'Gelmedi',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  confirmed: 'bg-green-100 text-green-700 border-green-200',
  completed: 'bg-blue-100 text-blue-700 border-blue-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
  no_show: 'bg-gray-100 text-gray-600 border-gray-200',
}

const SEGMENT_LABELS: Record<string, string> = {
  new: 'Yeni Müşteri',
  regular: 'Düzenli Müşteri',
  vip: 'VIP Müşteri',
  risk: 'Risk',
  lost: 'Kayıp',
}

const SEGMENT_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  regular: 'bg-green-100 text-green-700',
  vip: 'bg-amber-100 text-amber-700',
  risk: 'bg-orange-100 text-orange-700',
  lost: 'bg-gray-100 text-gray-600',
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('tr-TR', {
      weekday: 'long', day: 'numeric', month: 'long'
    })
  } catch {
    return dateStr
  }
}

function formatTime(time: string): string {
  return time?.slice(0, 5) || ''
}

export default function PortalDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const businessId = params.businessId as string

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([])
  const [pastAppointments, setPastAppointments] = useState<Appointment[]>([])
  const [loyaltyPoints, setLoyaltyPoints] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/portal/me')
        if (res.status === 401) {
          router.replace(`/portal/${businessId}`)
          return
        }
        if (!res.ok) throw new Error('Veri yüklenemedi')
        const data = await res.json()
        setCustomer(data.customer)
        setBusiness(data.business)
        setUpcomingAppointments(data.upcomingAppointments || [])
        setPastAppointments(data.pastAppointments || [])
        setLoyaltyPoints(data.loyaltyPoints || 0)
      } catch {
        router.replace(`/portal/${businessId}`)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [businessId, router])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/portal/logout', { method: 'DELETE' })
    } catch { /* ignore */ } finally {
      router.replace(`/portal/${businessId}`)
    }
  }

  if (loading) {
    return (
      <div className="portal-page min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="portal-page min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {business?.logo_url ? (
              <img src={business.logo_url} alt={business.name} className="h-9 w-9 rounded-xl object-cover" />
            ) : (
              <div className="h-9 w-9 rounded-xl bg-pulse-900 flex items-center justify-center">
                <span className="text-sm font-bold text-white">{business?.name?.slice(0, 1)}</span>
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-tight">{business?.name}</p>
              <p className="text-xs text-gray-400">Müşteri Portalı</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Çıkış
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {/* Müşteri Profil Kartı */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-pulse-900 flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-bold text-white">
                {customer?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{customer?.name}</p>
              <p className="text-sm text-gray-500">{customer?.phone}</p>
            </div>
            {customer?.segment && SEGMENT_LABELS[customer.segment] && (
              <span className={cn('badge text-xs', SEGMENT_COLORS[customer.segment])}>
                {SEGMENT_LABELS[customer.segment]}
              </span>
            )}
          </div>

          {loyaltyPoints > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
              <Gift className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-gray-700">
                <span className="font-bold text-amber-600">{loyaltyPoints}</span> sadakat puanınız var
              </span>
            </div>
          )}
        </div>

        {/* Yeni Randevu Al */}
        <a
          href={`/book/${businessId}`}
          className="flex items-center justify-between bg-pulse-900 text-white rounded-2xl p-4 hover:bg-pulse-800 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <Plus className="h-5 w-5" />
            <span className="font-medium">Yeni Randevu Al</span>
          </div>
          <ChevronRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
        </a>

        {/* Yaklaşan Randevular */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Yaklaşan Randevular</h2>
          {upcomingAppointments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
              <CalendarCheck className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Yaklaşan randevunuz bulunmuyor.</p>
              <a
                href={`/book/${businessId}`}
                className="inline-block mt-3 text-sm text-pulse-900 font-medium hover:underline"
              >
                Randevu Al
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingAppointments.map((apt) => (
                <div key={apt.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">
                        {(apt.services as any)?.name || 'Randevu'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDate(apt.appointment_date)} · {formatTime(apt.start_time)}
                        {apt.end_time && ` - ${formatTime(apt.end_time)}`}
                      </p>
                      {(apt.staff_members as any)?.name && (
                        <p className="text-xs text-gray-400 mt-0.5">{(apt.staff_members as any).name}</p>
                      )}
                    </div>
                    <span className={cn('badge text-xs border', STATUS_COLORS[apt.status] || 'bg-gray-100 text-gray-600')}>
                      {STATUS_LABELS[apt.status] || apt.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Geçmiş Randevular */}
        {pastAppointments.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Geçmiş Randevular</h2>
            <div className="space-y-2">
              {pastAppointments.map((apt) => (
                <div key={apt.id} className="bg-white rounded-2xl border border-gray-100 p-4 opacity-80">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 text-sm">
                        {(apt.services as any)?.name || 'Randevu'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(apt.appointment_date)} · {formatTime(apt.start_time)}
                      </p>
                    </div>
                    <span className={cn('badge text-xs border', STATUS_COLORS[apt.status] || 'bg-gray-100 text-gray-600')}>
                      {STATUS_LABELS[apt.status] || apt.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
