'use client'

import { Sparkles } from 'lucide-react'
import { getTimeOfDayGreeting } from '@/lib/portal/date-helpers'

interface PortalHeroProps {
  firstName: string
  segment?: string | null
  lastVisitDays?: number | null
  isBirthday?: boolean
}

function getSegmentLabel(segment: string | null | undefined): string | null {
  switch (segment) {
    case 'vip': return 'Özel Müşteri'
    case 'regular': return 'Sadık Müşteri'
    case 'new': return 'Hoş Geldin'
    default: return null
  }
}

export function PortalHero({ firstName, segment, lastVisitDays, isBirthday }: PortalHeroProps) {
  const greeting = isBirthday ? 'Doğum günün kutlu olsun' : getTimeOfDayGreeting()
  const segmentLabel = getSegmentLabel(segment)

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pulse-900 via-pulse-800 to-indigo-700 p-6 lg:p-8 text-white shadow-xl shadow-pulse-900/20">
      <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-indigo-400/20 blur-3xl pointer-events-none" />
      <Sparkles className="absolute right-4 top-4 h-20 w-20 text-white/10" />

      <div className="relative z-10">
        {segmentLabel && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-sm ring-1 ring-white/20 text-[11px] font-medium uppercase tracking-wide">
            {segmentLabel}
          </div>
        )}
        <h1 className="mt-2 text-3xl lg:text-4xl font-bold">
          {greeting}{firstName ? `, ${firstName}` : ''}
          {isBirthday ? ' 🎂' : ''}
        </h1>
        {lastVisitDays !== null && lastVisitDays !== undefined && lastVisitDays >= 0 && (
          <p className="mt-2 text-sm text-white/80">
            {lastVisitDays === 0
              ? 'Bugün burada mıydın? Seni ağırlamak keyifti.'
              : lastVisitDays === 1
              ? 'Dün buradaydın — umarız her şey yolunda geçti.'
              : lastVisitDays < 30
              ? `${lastVisitDays} gün önce buradaydın.`
              : `Seni özledik — ${Math.floor(lastVisitDays / 30)} aydan fazladır görüşmedik.`}
          </p>
        )}
        {(lastVisitDays === null || lastVisitDays === undefined) && (
          <p className="mt-2 text-sm text-white/80">
            Hoş geldin — seni aramızda görmekten mutluyuz.
          </p>
        )}
      </div>
    </div>
  )
}
