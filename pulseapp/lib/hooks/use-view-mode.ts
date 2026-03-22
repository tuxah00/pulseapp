'use client'

import { useState, useEffect } from 'react'

type ViewMode = 'list' | 'box' | 'week'

export function useViewMode(key: string, defaultMode: ViewMode = 'list') {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultMode)

  useEffect(() => {
    const stored = localStorage.getItem(`viewMode_${key}`) as ViewMode | null
    if (stored === 'list' || stored === 'box' || stored === 'week') setViewMode(stored)
  }, [key])

  function updateViewMode(mode: ViewMode) {
    setViewMode(mode)
    localStorage.setItem(`viewMode_${key}`, mode)
  }

  return [viewMode, updateViewMode] as const
}
