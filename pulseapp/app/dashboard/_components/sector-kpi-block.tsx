import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Activity, Camera, Share2, CalendarCheck, Sparkles, Stethoscope } from 'lucide-react'
import type { SectorType } from '@/types'

/**
 * Sektöre özel KPI kartları — Dental & Medical Aesthetic için anlamlı metrikler.
 * Diğer sektörlerde hiçbir şey render edilmez.
 */
export default async function SectorKPIBlock({
  businessId,
  sector,
}: {
  businessId: string
  sector: SectorType
}) {
  const supported: SectorType[] = ['dental_clinic', 'medical_aesthetic']
  if (!supported.includes(sector)) return null

  const supabase = createServerSupabaseClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  // Ortak: aktif tedavi protokolü sayısı
  const { count: activeProtocols } = await supabase
    .from('treatment_protocols')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('status', 'active')

  // Ortak: bu ay tamamlanan seans sayısı
  const { count: completedSessionsThisMonth } = await supabase
    .from('protocol_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('status', 'completed')
    .gte('completed_date', monthStart)

  let thirdCard: React.ReactNode

  if (sector === 'medical_aesthetic') {
    // Estetik: bu ay eklenen öncesi/sonrası fotoğraf sayısı
    const { count: photosThisMonth } = await supabase
      .from('customer_photos')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', monthStart + 'T00:00:00')

    thirdCard = (
      <KpiCard
        title="Bu Ay Fotoğraf"
        value={photosThisMonth ?? 0}
        subtitle="öncesi/sonrası eklendi"
        icon={<Camera className="h-5 w-5" />}
        color="violet"
      />
    )
  } else {
    // Dental: bu ay online randevu ile gelen hasta (online_booked = true proxy: manage_token set + created_at in month)
    const { count: onlineBookedThisMonth } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .not('manage_token', 'is', null)
      .gte('created_at', monthStart + 'T00:00:00')
      .is('deleted_at', null)

    thirdCard = (
      <KpiCard
        title="Online Randevu"
        value={onlineBookedThisMonth ?? 0}
        subtitle="bu ay link üzerinden"
        icon={<CalendarCheck className="h-5 w-5" />}
        color="emerald"
      />
    )
  }

  const isAesthetic = sector === 'medical_aesthetic'

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        {isAesthetic ? (
          <Sparkles className="h-4 w-4 text-violet-500 dark:text-violet-400" />
        ) : (
          <Stethoscope className="h-4 w-4 text-teal-500 dark:text-teal-400" />
        )}
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {isAesthetic ? 'Estetik Klinik Göstergeleri' : 'Diş Kliniği Göstergeleri'}
        </h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title="Aktif Protokol"
          value={activeProtocols ?? 0}
          subtitle="devam eden tedavi"
          icon={<Activity className="h-5 w-5" />}
          color="indigo"
        />
        <KpiCard
          title="Bu Ay Seans"
          value={completedSessionsThisMonth ?? 0}
          subtitle="tamamlanan"
          icon={<Share2 className="h-5 w-5" />}
          color="rose"
        />
        {thirdCard}
      </div>
    </div>
  )
}

type ColorKey = 'indigo' | 'rose' | 'violet' | 'emerald'
const COLORS: Record<ColorKey, { bg: string; icon: string; text: string }> = {
  indigo: {
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    icon: 'bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
    text: 'text-indigo-900 dark:text-indigo-100',
  },
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    icon: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',
    text: 'text-rose-900 dark:text-rose-100',
  },
  violet: {
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    icon: 'bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400',
    text: 'text-violet-900 dark:text-violet-100',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    icon: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    text: 'text-emerald-900 dark:text-emerald-100',
  },
}

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string
  value: number | string
  subtitle: string
  icon: React.ReactNode
  color: ColorKey
}) {
  const c = COLORS[color]
  return (
    <div className={`rounded-2xl border border-gray-200 dark:border-gray-800 p-4 ${c.bg}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</p>
          <p className={`mt-1 text-2xl font-bold ${c.text}`}>{value}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.icon}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}
