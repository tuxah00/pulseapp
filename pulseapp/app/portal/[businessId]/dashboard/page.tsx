'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  CalendarCheck, Gift, Loader2, Plus, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Customer {
  id: string
  name: string
  phone: string
  segment: string
}

interface ServiceJoin { name: string; price?: number }
interface StaffJoin { name: string }

interface Appointment {
  id: string
  appointment_date: string
  start_time: string
  end_time?: string
  status: string
  services?: ServiceJoin | ServiceJoin[] | null
  staff_members?: StaffJoin | StaffJoin[] | null
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

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('tr-TR', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
  } catch {
    return dateStr
  }
}

function formatTime(time: string): string {
  return time?.slice(0, 5) || ''
}

export default function PortalOverviewPage() {
  const params = useParams()
  const businessId = params.businessId as string

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([])
  const [pastAppointments, setPastAppointments] = useState<Appointment[]>([])
  const [loyaltyPoints, setLoyaltyPoints] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/portal/me')
        if (!res.ok) return
        const data = await res.json()
        setCustomer(data.customer)
        setUpcomingAppointments(data.upcomingAppointments || [])
        setPastAppointments(data.pastAppointments || [])
        setLoyaltyPoints(data.loyaltyPoints || 0)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const firstName = customer?.name?.split(' ')[0] || ''

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-pulse-900 via-pulse-800 to-indigo-700 p-6 lg:p-8 text-white shadow-xl overflow-hidden relative">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <h1 className="text-2xl lg:text-3xl font-serif font-bold">
            Hoş geldiniz{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-1 text-sm text-white/80">
            Burada tüm randevularınızı, ödüllerinizi ve işletme kayıtlarınızı görebilirsiniz.
          </p>
          {loyaltyPoints > 0 && (
            <div className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
              <Gift className="h-4 w-4 text-amber-300" />
              <span className="text-sm">
                <span className="font-bold text-amber-300">{loyaltyPoints}</span> sadakat puanınız var
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Yeni Randevu CTA */}
      <Link
        href={`/book/${businessId}`}
        className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-5 hover:border-pulse-900/30 hover:shadow-md transition-all group"
      >
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-pulse-900/10 flex items-center justify-center">
            <Plus className="h-5 w-5 text-pulse-900" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Yeni Randevu Al</p>
            <p className="text-xs text-gray-500">Size uygun bir zamanı seçin</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:translate-x-1 group-hover:text-pulse-900 transition-all" />
      </Link>

      {/* Yaklaşan Randevular */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Yaklaşan Randevular</h2>
        {upcomingAppointments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <div className="h-12 w-12 rounded-full bg-pulse-900/5 flex items-center justify-center mx-auto mb-3">
              <CalendarCheck className="h-6 w-6 text-pulse-900/50" />
            </div>
            <p className="text-sm text-gray-500 mb-3">Yaklaşan randevunuz bulunmuyor.</p>
            <Link
              href={`/book/${businessId}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-pulse-900 hover:underline"
            >
              Randevu Al <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {upcomingAppointments.map((apt) => {
              const svc = Array.isArray(apt.services) ? apt.services[0] : apt.services
              const staff = Array.isArray(apt.staff_members) ? apt.staff_members[0] : apt.staff_members
              return (
                <div key={apt.id} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{svc?.name || 'Randevu'}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(apt.appointment_date)} · {formatTime(apt.start_time)}
                        {apt.end_time && ` - ${formatTime(apt.end_time)}`}
                      </p>
                      {staff?.name && <p className="text-xs text-gray-400 mt-0.5">{staff.name}</p>}
                    </div>
                    <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full border', STATUS_COLORS[apt.status] || 'bg-gray-100 text-gray-600')}>
                      {STATUS_LABELS[apt.status] || apt.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Geçmiş Randevular */}
      {pastAppointments.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Son Randevularım</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {pastAppointments.map((apt) => {
              const svc = Array.isArray(apt.services) ? apt.services[0] : apt.services
              return (
                <div key={apt.id} className="bg-white rounded-2xl border border-gray-100 p-4 opacity-90">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm">{svc?.name || 'Randevu'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(apt.appointment_date)} · {formatTime(apt.start_time)}
                      </p>
                    </div>
                    <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full border', STATUS_COLORS[apt.status] || 'bg-gray-100 text-gray-600')}>
                      {STATUS_LABELS[apt.status] || apt.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
