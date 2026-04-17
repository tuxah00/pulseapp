'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  CalendarCheck, Gift, Loader2, Plus, ChevronRight, Sparkles,
  Users, Trophy, TrendingUp, AlertCircle, Megaphone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PortalHero } from './_components/portal-hero'
import { SuggestionCard, type PortalSuggestion } from './_components/suggestion-card'
import { MilestoneBanner } from './_components/milestone-banner'
import { MetricTile } from './_components/metric-tile'
import { SectionHeader } from './_components/section-header'
import { isBirthdayToday, daysSince } from '@/lib/portal/date-helpers'

interface Customer {
  id: string
  name: string
  phone: string
  segment: string
  birthday?: string | null
  total_visits?: number
  last_visit_at?: string | null
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

interface Campaign {
  id: string
  name: string
  description: string | null
}

interface UnpaidInvoice {
  id: string
  total: number
  paid_amount: number
  status: string
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Bekliyor',
  confirmed: 'Onaylandı',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
  no_show: 'Gelmedi',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  completed: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  cancelled: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  no_show: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
}

function first<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  if (Array.isArray(v)) return v[0] || null
  return v
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
  const [upcoming, setUpcoming] = useState<Appointment[]>([])
  const [loyaltyPoints, setLoyaltyPoints] = useState(0)
  const [loyaltyTier, setLoyaltyTier] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<PortalSuggestion[]>([])
  const [milestones, setMilestones] = useState<Array<{ kind: string; title: string; subtitle: string }>>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([])
  const [activeProtocolProgress, setActiveProtocolProgress] = useState<{ name: string; percent: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const [meRes, sugRes, rewRes, campRes, invRes, trtRes] = await Promise.all([
          fetch('/api/portal/me'),
          fetch('/api/portal/suggestions'),
          fetch('/api/portal/rewards'),
          fetch('/api/portal/campaigns'),
          fetch('/api/portal/invoices'),
          fetch('/api/portal/treatments'),
        ])

        if (meRes.ok) {
          const data = await meRes.json()
          setCustomer(data.customer)
          setUpcoming(data.upcomingAppointments || [])
          setLoyaltyPoints(data.loyaltyPoints || 0)
        }
        if (sugRes.ok) {
          const data = await sugRes.json()
          setSuggestions(data.suggestions || [])
          setMilestones(data.milestones || [])
        }
        if (rewRes.ok) {
          const data = await rewRes.json()
          setLoyaltyTier(data.loyalty?.tier ?? null)
        }
        if (campRes.ok) {
          const data = await campRes.json()
          setCampaigns((data.campaigns || []).slice(0, 3))
        }
        if (invRes.ok) {
          const data = await invRes.json()
          const unpaid = (data.invoices || []).filter((inv: any) =>
            inv.status === 'pending' || inv.status === 'partial' || inv.status === 'overdue'
          )
          setUnpaidInvoices(unpaid.slice(0, 2))
        }
        if (trtRes.ok) {
          const data = await trtRes.json()
          const activeP = (data.protocols || []).find((p: any) => p.status === 'active')
          if (activeP && activeP.total_sessions > 0) {
            const pct = Math.round((activeP.completed_sessions / activeP.total_sessions) * 100)
            setActiveProtocolProgress({ name: activeP.name, percent: pct })
          }
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const firstName = customer?.name?.split(' ')[0] || ''
  const nextAppt = upcoming[0] || null
  const nextService = first(nextAppt?.services)
  const nextStaff = first(nextAppt?.staff_members)
  const lastVisitDays = daysSince(customer?.last_visit_at || null)
  const birthday = isBirthdayToday(customer?.birthday)

  const tierLabel: Record<string, string> = { bronze: 'Bronz', silver: 'Gümüş', gold: 'Altın' }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Hero */}
      <PortalHero
        firstName={firstName}
        segment={customer?.segment}
        lastVisitDays={lastVisitDays}
        isBirthday={birthday}
      />

      {/* Milestone — özel gün kutlamaları */}
      {milestones.length > 0 && <MilestoneBanner milestones={milestones} />}

      {/* Sıradaki Randevu / CTA */}
      {nextAppt ? (
        <section>
          <SectionHeader title="Bir Sonraki Buluşmamız" icon={CalendarCheck} />
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-pulse-100 dark:border-pulse-900/40 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                  {nextService?.name || 'Randevu'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  {formatDate(nextAppt.appointment_date)}
                </p>
                <p className="text-2xl font-bold text-pulse-900 dark:text-pulse-300 mt-1">
                  {formatTime(nextAppt.start_time)}
                  {nextAppt.end_time ? <span className="text-sm text-gray-500 dark:text-gray-400 font-normal"> — {formatTime(nextAppt.end_time)}</span> : null}
                </p>
                {nextStaff?.name && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{nextStaff.name} ile</p>
                )}
              </div>
              <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap', STATUS_COLORS[nextAppt.status] || STATUS_COLORS.pending)}>
                {STATUS_LABELS[nextAppt.status] || nextAppt.status}
              </span>
            </div>
            <Link
              href={`/portal/${businessId}/dashboard/appointments`}
              className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-pulse-900 dark:text-pulse-300 hover:underline"
            >
              Tüm randevularını gör
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      ) : (
        <Link
          href={`/book/${businessId}`}
          className="group flex items-center justify-between bg-gradient-to-br from-pulse-50 to-indigo-50 dark:from-pulse-900/20 dark:to-indigo-900/20 rounded-2xl border border-pulse-100 dark:border-pulse-900/40 p-5 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-pulse-900 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-pulse-900/20">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900 dark:text-gray-100">Yeni Randevu Al</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Sana uygun bir zamanı seç</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-pulse-900 dark:group-hover:text-pulse-300 group-hover:translate-x-0.5 transition-all" />
        </Link>
      )}

      {/* Akıllı Öneriler — kaydırılabilir şerit */}
      {suggestions.length > 0 && (
        <section>
          <SectionHeader
            title="Senin İçin Öneriler"
            subtitle="Kaçırdığın veya yaklaşan şeyler — tek tıkla randevu."
            icon={Sparkles}
          />
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory hide-scrollbar">
              {suggestions.map((s, i) => (
                <SuggestionCard key={i} suggestion={s} bookHref={`/book/${businessId}`} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Ödenmemiş Fatura Uyarısı */}
      {unpaidInvoices.length > 0 && (
        <Link
          href={`/portal/${businessId}/dashboard/invoices`}
          className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 hover:shadow-md transition-shadow"
        >
          <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-amber-700 dark:text-amber-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {unpaidInvoices.length === 1 ? 'Ödenmemiş bir faturan var' : `Ödenmemiş ${unpaidInvoices.length} faturan var`}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              Toplam: ₺{unpaidInvoices.reduce((sum, i) => sum + (i.total - (i.paid_amount || 0)), 0).toFixed(2)}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-amber-700 dark:text-amber-300" />
        </Link>
      )}

      {/* Metrik Tile'lar */}
      <section>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricTile
            icon={Users}
            label="Toplam Ziyaret"
            value={customer?.total_visits || 0}
            accent="indigo"
          />
          <MetricTile
            icon={Trophy}
            label="Sadakat"
            value={loyaltyPoints}
            subtitle={loyaltyTier ? `${tierLabel[loyaltyTier] || loyaltyTier} seviye` : 'puan'}
            accent="amber"
          />
          {activeProtocolProgress ? (
            <MetricTile
              icon={TrendingUp}
              label="Tedavi İlerleme"
              value={`%${activeProtocolProgress.percent}`}
              subtitle={activeProtocolProgress.name}
              accent="emerald"
            />
          ) : (
            <MetricTile
              icon={Gift}
              label="Ödüllerin"
              value={loyaltyPoints > 0 ? 'Aktif' : '—'}
              subtitle={loyaltyPoints > 0 ? 'Görmek için tıkla' : 'Randevu al, kazan'}
              accent="pulse"
            />
          )}
        </div>
      </section>

      {/* Kampanyalar */}
      {campaigns.length > 0 && (
        <section>
          <SectionHeader
            title="Sana Özel Kampanyalar"
            subtitle={campaigns.length === 1 ? 'Bir kampanyan var' : `${campaigns.length} aktif kampanya`}
            icon={Megaphone}
            action={
              <Link
                href={`/portal/${businessId}/dashboard/rewards`}
                className="text-xs font-medium text-pulse-900 dark:text-pulse-300 hover:underline"
              >
                Tümü
              </Link>
            }
          />
          <div className="space-y-2">
            {campaigns.map((c) => (
              <div key={c.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-pulse-900 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Megaphone className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{c.name}</h3>
                    {c.description && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 line-clamp-2">{c.description}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
