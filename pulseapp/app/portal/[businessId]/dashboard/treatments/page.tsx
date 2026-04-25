'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Package, CalendarClock, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TreatmentProgressCard,
  type TreatmentProtocol,
} from '../_components/treatment-progress-card'
import { SectionHeader } from '../_components/section-header'
import { getTreatmentsPageTitle } from '@/lib/portal/sector-labels'
import { formatUntil, daysSince } from '@/lib/portal/date-helpers'
import { SkeletonList } from '../_components/skeleton-card'

interface CustomerPackage {
  id: string
  package_name: string
  sessions_total: number
  sessions_used: number
  price_paid: number
  status: string
  purchase_date: string
  expiry_date: string | null
  notes?: string | null
  service?: { id: string; name: string } | { id: string; name: string }[] | null
  usages?: Array<{
    id: string
    used_at: string
    notes?: string | null
    appointment?: { id: string; appointment_date: string; start_time: string } | { id: string; appointment_date: string; start_time: string }[] | null
  }> | null
}

const PACKAGE_STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
  expired: 'Süresi Dolmuş',
}

const PACKAGE_STATUS_COLORS: Record<string, string> = {
  active: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  completed: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
  expired: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
}

function first<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  if (Array.isArray(v)) return v[0] || null
  return v
}

export default function PortalTreatmentsPage() {
  const params = useParams()
  const businessId = params.businessId as string

  const [protocols, setProtocols] = useState<TreatmentProtocol[]>([])
  const [packages, setPackages] = useState<CustomerPackage[]>([])
  const [sector, setSector] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const [meRes, tRes] = await Promise.all([
          fetch('/api/portal/me'),
          fetch('/api/portal/treatments'),
        ])
        if (meRes.ok) {
          const data = await meRes.json()
          setSector(data.business?.sector ?? null)
        }
        if (tRes.ok) {
          const data = await tRes.json()
          setProtocols(data.protocols || [])
          setPackages(data.packages || [])
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const title = getTreatmentsPageTitle(sector)

  const activeProtocols = protocols.filter((p) => p.status === 'active' || p.status === 'paused')
  const completedProtocols = protocols.filter((p) => p.status === 'completed')
  const activePackages = packages.filter((p) => p.status === 'active')
  const historyPackages = packages.filter((p) => p.status !== 'active')

  const isEmpty = protocols.length === 0 && packages.length === 0

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Tedavi protokollerin ve paketlerin — ilerlemen bir bakışta.
        </p>
      </div>

      {loading ? (
        <SkeletonList count={2} lines={4} />
      ) : isEmpty ? (
        <div className="bg-gradient-to-br from-pulse-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 rounded-2xl border border-pulse-100 dark:border-gray-800 p-10 text-center">
          <div className="h-14 w-14 rounded-full bg-white dark:bg-gray-900 shadow flex items-center justify-center mx-auto mb-3">
            <Package className="h-7 w-7 text-pulse-900 dark:text-pulse-300" />
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Henüz aktif bir tedavi veya paketin yok.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
            İşletmen sana bir tedavi protokolü veya paket tanımladığında burada göreceksin.
          </p>
          <Link
            href={`/book/${businessId}`}
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-full bg-pulse-900 text-white text-sm font-medium hover:bg-pulse-800 transition-colors"
          >
            Randevu Al
          </Link>
        </div>
      ) : (
        <>
          {/* Aktif Protokoller */}
          {activeProtocols.length > 0 && (
            <section>
              <SectionHeader
                title="Aktif Tedavi Protokolleri"
                subtitle="Seans planın ve ilerlemen burada görünür."
              />
              <div className="space-y-4">
                {activeProtocols.map((p) => (
                  <TreatmentProgressCard key={p.id} protocol={p} />
                ))}
              </div>
            </section>
          )}

          {/* Aktif Paketler */}
          {activePackages.length > 0 && (
            <section>
              <SectionHeader
                title="Paket Seansların"
                subtitle="Kalan seansların ve kullanım geçmişin."
                icon={Package}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {activePackages.map((pkg) => (
                  <PackageCard key={pkg.id} pkg={pkg} />
                ))}
              </div>
            </section>
          )}

          {/* Tamamlanan Protokoller */}
          {completedProtocols.length > 0 && (
            <section>
              <SectionHeader
                title="Tamamlanan Tedaviler"
                subtitle="Başarıyla tamamlanan süreçlerin."
                icon={CheckCircle2}
              />
              <div className="space-y-4">
                {completedProtocols.map((p) => (
                  <TreatmentProgressCard key={p.id} protocol={p} />
                ))}
              </div>
            </section>
          )}

          {/* Geçmiş Paketler */}
          {historyPackages.length > 0 && (
            <section>
              <SectionHeader title="Geçmiş Paketler" icon={Package} />
              <div className="grid gap-3 sm:grid-cols-2">
                {historyPackages.map((pkg) => (
                  <PackageCard key={pkg.id} pkg={pkg} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function PackageCard({ pkg }: { pkg: CustomerPackage }) {
  const service = first(pkg.service)
  const remaining = Math.max(0, pkg.sessions_total - pkg.sessions_used)
  const progress = pkg.sessions_total > 0 ? Math.round((pkg.sessions_used / pkg.sessions_total) * 100) : 0
  const isActive = pkg.status === 'active'

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
            {pkg.package_name}
          </h3>
          {service?.name && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{service.name}</p>
          )}
        </div>
        <span className={cn(
          'text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap',
          PACKAGE_STATUS_COLORS[pkg.status] || PACKAGE_STATUS_COLORS.active
        )}>
          {PACKAGE_STATUS_LABELS[pkg.status] || pkg.status}
        </span>
      </div>

      {isActive ? (
        <div className="mt-4 text-center bg-gradient-to-br from-pulse-900/5 to-indigo-500/5 dark:from-pulse-900/20 dark:to-indigo-500/20 rounded-xl py-3">
          <p className="text-3xl font-bold text-pulse-900 dark:text-pulse-300">{remaining}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">kalan seans</p>
        </div>
      ) : (
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Toplam: {pkg.sessions_total} seans
        </div>
      )}

      <div className="mt-3">
        <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div
            className={cn(
              'h-full transition-all',
              isActive ? 'bg-gradient-to-r from-pulse-900 to-indigo-600' : 'bg-gray-400 dark:bg-gray-600'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          <span>{pkg.sessions_used} / {pkg.sessions_total} kullanıldı</span>
          <span>%{progress}</span>
        </div>
      </div>

      {pkg.expiry_date && isActive && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          <CalendarClock className="h-3 w-3" />
          <span>Son kullanım: {formatUntil(pkg.expiry_date)}</span>
        </div>
      )}

      {pkg.notes && (
        <p className="mt-3 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5">
          {pkg.notes}
        </p>
      )}
    </div>
  )
}
