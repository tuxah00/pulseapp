'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
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
}

export function useTutorial(): UseTutorialReturn {
  const { sector, loading: ctxLoading } = useBusinessContext()
  const pathname = usePathname()
  const [progress, setProgress] = useState<TutorialProgress | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (ctxLoading) return
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
  }, [ctxLoading])

  const sectorValue = (sector || 'other') as SectorType

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
  const seenSet = useMemo(() => new Set(progress?.seen_pages ?? []), [progress?.seen_pages])

  const shouldShowBubble = !!(
    !loading &&
    enabled &&
    currentTopic &&
    !seenSet.has(currentTopic.pageKey)
  )

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
  }
}
