'use client'

import { useEffect, useState } from 'react'
import { Rocket, X } from 'lucide-react'
import { PILOT_BANNER_MESSAGE } from '@/lib/pilot'

const STORAGE_KEY = 'pulseapp.pilotBannerDismissedAt'
// 24 saat sonra tekrar gösterilir — pilotun farkındalığı korunsun ama her sayfada görünmesin.
const REMIND_AFTER_MS = 24 * 60 * 60 * 1000

export default function PilotBanner({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) {
      setVisible(false)
      return
    }
    try {
      const dismissedAt = Number(localStorage.getItem(STORAGE_KEY) || '0')
      if (!dismissedAt || Date.now() - dismissedAt > REMIND_AFTER_MS) {
        setVisible(true)
      }
    } catch {
      setVisible(true)
    }
  }, [active])

  if (!visible) return null

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 text-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2.5 flex items-start gap-3">
        <Rocket className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
        <p className="flex-1 leading-snug">{PILOT_BANNER_MESSAGE}</p>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(STORAGE_KEY, String(Date.now()))
            } catch {}
            setVisible(false)
          }}
          className="shrink-0 p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 transition"
          aria-label="Pilot bildirimini kapat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
