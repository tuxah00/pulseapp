'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, ShieldAlert, Info, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Allergy {
  id: string
  allergen: string
  severity: 'mild' | 'moderate' | 'severe'
  reaction: string | null
  notes: string | null
  created_at: string
}

const SEVERITY_CONFIG: Record<
  Allergy['severity'],
  { label: string; classes: string; icon: React.ComponentType<{ className?: string }> }
> = {
  mild: {
    label: 'Hafif',
    classes:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/50',
    icon: Info,
  },
  moderate: {
    label: 'Orta',
    classes:
      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-900/50',
    icon: AlertTriangle,
  },
  severe: {
    label: 'Şiddetli',
    classes:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/50',
    icon: ShieldAlert,
  },
}

/**
 * Müşterinin alerji kayıtlarını gösterir (read-only).
 *
 * Yalnızca alerji takibinin kritik olduğu sektörlerde gösterilir
 * (estetik klinik, diş kliniği). Settings sayfasından çağrılır.
 */
export default function AllergyList() {
  const [allergies, setAllergies] = useState<Allergy[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portal/allergies')
      .then((r) => r.ok ? r.json() : { allergies: [] })
      .then((d) => setAllergies(d.allergies || []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-3">
        <Loader2 className="h-4 w-4 animate-spin" />
        Alerji bilgileri yükleniyor...
      </div>
    )
  }

  if (allergies.length === 0) {
    return (
      <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
        Sistemde kayıtlı alerjiniz bulunmuyor. Yeni bir alerjiniz varsa salonla iletişime geçin.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {allergies.map((a) => {
        const cfg = SEVERITY_CONFIG[a.severity]
        const Icon = cfg.icon
        return (
          <div
            key={a.id}
            className={cn('rounded-xl border px-4 py-3 flex items-start gap-3', cfg.classes)}
          >
            <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{a.allergen}</span>
                <span className="text-[10px] uppercase tracking-wide font-semibold opacity-80">
                  {cfg.label}
                </span>
              </div>
              {a.reaction && (
                <p className="text-xs mt-1 opacity-90">
                  <span className="font-medium">Reaksiyon:</span> {a.reaction}
                </p>
              )}
              {a.notes && (
                <p className="text-xs mt-0.5 opacity-75">{a.notes}</p>
              )}
            </div>
          </div>
        )
      })}
      <p className="text-[11px] text-gray-500 dark:text-gray-400 px-1 pt-1">
        Bu kayıtları yalnızca salon ekleyebilir/değiştirebilir. Yeni alerjiniz varsa
        lütfen salonla iletişime geçin.
      </p>
    </div>
  )
}
