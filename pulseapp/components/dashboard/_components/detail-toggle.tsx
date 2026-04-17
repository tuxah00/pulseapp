'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DetailToggleProps {
  /** localStorage anahtarı — her sayfa için benzersiz olmalı (örn. "dashboard-details") */
  storageKey: string
  /** Açık durumda gösterilecek içerik */
  children: React.ReactNode
  /** Buton metni - varsayılan: "Detayları göster" / "Detayları gizle" */
  labelOpen?: string
  labelClose?: string
  /** Opsiyonel ek className */
  className?: string
}

/**
 * Paylaşımlı "Detayları göster / gizle" toggle bileşeni.
 * Kullanıcının tercihi localStorage'da saklanır; varsayılan KAPALI.
 */
export function DetailToggle({
  storageKey,
  children,
  labelOpen = 'Detayları göster',
  labelClose = 'Detayları gizle',
  className,
}: DetailToggleProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Mount sonrası localStorage'dan tercihi oku (SSR uyumluluğu için)
  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem(`pulse-detail-toggle:${storageKey}`)
      if (saved === 'open') setOpen(true)
    } catch {
      // localStorage erişilemezse sessiz geç
    }
  }, [storageKey])

  function toggle() {
    const next = !open
    setOpen(next)
    try {
      localStorage.setItem(`pulse-detail-toggle:${storageKey}`, next ? 'open' : 'closed')
    } catch {
      // sessiz geç
    }
  }

  return (
    <div className={className}>
      <div className="flex justify-center my-4">
        <button
          type="button"
          onClick={toggle}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
            'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700',
            'text-gray-600 dark:text-gray-300 transition-colors'
          )}
          aria-expanded={open}
        >
          {open ? (
            <>
              <ChevronUp className="h-4 w-4" />
              {labelClose}
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              {labelOpen}
            </>
          )}
        </button>
      </div>

      {mounted && open && (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  )
}
