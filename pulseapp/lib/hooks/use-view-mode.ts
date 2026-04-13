'use client'

import { useState } from 'react'

type ViewMode = 'list' | 'box' | 'week' | 'month' | 'staff' | 'room'

export function useViewMode(key: string, defaultMode: ViewMode = 'list') {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return defaultMode
    const stored = localStorage.getItem(`viewMode_${key}`) as ViewMode | null
    const valid: ViewMode[] = ['list', 'box', 'week', 'month', 'staff', 'room']
    if (stored && valid.includes(stored)) return stored
    return defaultMode
  })

  function updateViewMode(mode: ViewMode) {
    setViewMode(mode)
    localStorage.setItem(`viewMode_${key}`, mode)
  }

  return [viewMode, updateViewMode] as const
}
