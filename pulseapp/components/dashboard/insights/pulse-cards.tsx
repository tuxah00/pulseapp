'use client'

import { Clock, UserCheck, UserPlus, TrendingUp, TrendingDown } from 'lucide-react'
import type { OperationalPulse } from '@/lib/analytics/insights'

interface Props {
  pulse: OperationalPulse
}

/**
 * İşletmenin günlük nabzını gösteren 4 kart (son 30 gün / haftalık trend).
 * Açıklamalar deneyimsiz kullanıcının da anlayabileceği sadelikte tutuldu.
 */
export default function PulseCards({ pulse }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <PulseCard
        icon={<Clock className="w-4 h-4" />}
        label="En Yoğun Saat"
        value={pulse.peak_hour ? pulse.peak_hour.label : '—'}
        hint={
          pulse.peak_hour
            ? `Son 30 günde ${pulse.peak_hour.count} randevu bu aralıkta`
            : 'Yeterli randevu yok'
        }
      />
      <PulseCard
        icon={<UserPlus className="w-4 h-4" />}
        label="Yeni Müşteri Payı"
        value={pulse.new_vs_returning ? `%${pulse.new_vs_returning.new_pct.toFixed(0)}` : '—'}
        hint={
          pulse.new_vs_returning
            ? `${pulse.new_vs_returning.new_count} yeni · ${pulse.new_vs_returning.returning_count} düzenli`
            : 'Müşteri hareketi yok'
        }
        tone={
          pulse.new_vs_returning == null ? 'default' :
          pulse.new_vs_returning.new_pct >= 30 ? 'good' :
          pulse.new_vs_returning.new_pct < 10 ? 'warning' : 'default'
        }
      />
      <PulseCard
        icon={<UserCheck className="w-4 h-4" />}
        label="İptal/Gelmeme"
        value={pulse.cancellation_rate != null ? `%${pulse.cancellation_rate.toFixed(1)}` : '—'}
        hint={
          pulse.cancellation_rate == null
            ? 'Veri yok'
            : pulse.cancellation_rate > 15
              ? 'Yüksek — hatırlatma SMS\'i ekle'
              : pulse.cancellation_rate > 8
                ? 'Ortalama üstü'
                : 'Sağlıklı'
        }
        tone={
          pulse.cancellation_rate == null ? 'default' :
          pulse.cancellation_rate > 15 ? 'warning' :
          pulse.cancellation_rate < 5 ? 'good' : 'default'
        }
      />
      <PulseCard
        icon={
          pulse.weekly_revenue_delta != null && pulse.weekly_revenue_delta < 0
            ? <TrendingDown className="w-4 h-4" />
            : <TrendingUp className="w-4 h-4" />
        }
        label="Haftalık Gelir Trendi"
        value={
          pulse.weekly_revenue_delta == null
            ? '—'
            : `${pulse.weekly_revenue_delta > 0 ? '+' : ''}${pulse.weekly_revenue_delta.toFixed(1)}%`
        }
        hint="Son 7 gün vs. önceki 7 gün"
        tone={
          pulse.weekly_revenue_delta == null ? 'default' :
          pulse.weekly_revenue_delta > 5 ? 'good' :
          pulse.weekly_revenue_delta < -5 ? 'warning' : 'default'
        }
      />
    </div>
  )
}

function PulseCard({
  icon, label, value, hint, tone = 'default',
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'warning' | 'good'
}) {
  const toneClass =
    tone === 'warning' ? 'text-amber-600 dark:text-amber-400' :
    tone === 'good' ? 'text-emerald-600 dark:text-emerald-400' :
    'text-gray-900 dark:text-gray-100'
  return (
    <div className="card p-4 cursor-default">
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-xl font-semibold ${toneClass}`}>{value}</div>
      {hint && <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{hint}</div>}
    </div>
  )
}
