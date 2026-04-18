'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { findTopicByPath, getTutorialTopicsForSector, type TutorialTopic } from '@/lib/ai/tutorial-content'
import type { SectorType, TutorialProgress } from '@/types'

interface UseTutorialReturn {
  progress: TutorialProgress | null
  loading: boolean
  currentTopic: TutorialTopic | null
  shouldShowBubble: boolean
  shouldRunSetup: boolean
  markSeen: (pageKey: string) => Promise<void>
  markSetupDone: () => Promise<void>
  setEnabled: (v: boolean) => Promise<void>
  reset: () => Promise<void>
  allTopics: TutorialTopic[]
  seenTopics: TutorialTopic[]
  dismissForCurrentPath: () => void
}

// sector opsiyonel: BusinessProvider dışında çağrılan yerler (AI paneli gibi)
// için prop olarak geçilebilir. Yoksa 'other' sektörüne düşer.
export function useTutorial(sectorOverride?: SectorType | null): UseTutorialReturn {
  const pathname = usePathname()
  const [progress, setProgress] = useState<TutorialProgress | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/ai/tutorial-progress')
      .then(res => res.ok ? res.json() : Promise.reject(new Error(String(res.status))))
      .then(data => {
        if (!cancelled) setProgress(data.progress as TutorialProgress)
      })
      .catch(() => {
        if (!cancelled) setProgress({ enabled: true, seen_pages: [] })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const sectorValue = (sectorOverride || 'other') as SectorType

  const currentTopic = useMemo(
    () => (pathname ? findTopicByPath(pathname, sectorValue) : null),
    [pathname, sectorValue]
  )

  const allTopics = useMemo(
    () => getTutorialTopicsForSector(sectorValue),
    [sectorValue]
  )

  const seenTopics = useMemo(() => {
    const seen = new Set(progress?.seen_pages ?? [])
    return allTopics.filter(t => seen.has(t.pageKey))
  }, [allTopics, progress?.seen_pages])

  const enabled = progress?.enabled !== false  // default true

  // İpucu balonu her sayfada görünür (ayarda kapatılmadığı sürece).
  // Kullanıcı X'e basarsa aşağıdaki sayfa-lokal state ile yalnızca o sayfada gizlenir.
  const [dismissedPath, setDismissedPath] = useState<string | null>(null)
  useEffect(() => {
    // Yol değişince lokal gizleme sıfırlanır — yeni sayfada balon yine çıkar
    setDismissedPath(null)
  }, [pathname])

  const shouldShowBubble = !!(
    !loading &&
    enabled &&
    currentTopic &&
    dismissedPath !== pathname
  )

  const dismissForCurrentPath = useCallback(() => {
    setDismissedPath(pathname ?? null)
  }, [pathname])

  const shouldRunSetup = !!(
    !loading &&
    enabled &&
    pathname === '/dashboard' &&
    !progress?.setup_completed_at
  )

  const patch = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch('/api/ai/tutorial-progress', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const data = await res.json()
      setProgress(data.progress as TutorialProgress)
    }
  }, [])

  const markSeen = useCallback(async (pageKey: string) => {
    const next = Array.from(new Set([...(progress?.seen_pages ?? []), pageKey]))
    await patch({ seen_pages: next })
  }, [patch, progress?.seen_pages])

  const markSetupDone = useCallback(async () => {
    await patch({ setup_completed_at: new Date().toISOString() })
  }, [patch])

  const setEnabled = useCallback(async (v: boolean) => {
    await patch({ enabled: v })
  }, [patch])

  const reset = useCallback(async () => {
    await patch({ resetSeen: true })
  }, [patch])

  return {
    progress,
    loading,
    currentTopic,
    shouldShowBubble,
    shouldRunSetup,
    markSeen,
    markSetupDone,
    setEnabled,
    reset,
    allTopics,
    seenTopics,
    dismissForCurrentPath,
  }
}
