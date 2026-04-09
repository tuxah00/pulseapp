'use client'

import { useState, useEffect } from 'react'

type ViewMode = 'list' | 'box' | 'week' | 'month' | 'staff' | 'room'

export function useViewMode(key: string, defaultMode: ViewMode = 'list') {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultMode)

  useEffect(() => {
    const stored = localStorage.getItem(`viewMode_${key}`) as ViewMode | null
    const valid: ViewMode[] = ['list', 'box', 'week', 'month', 'staff', 'room']
    if (stored && valid.includes(stored)) setViewMode(stored)
  }, [key])

  function updateViewMode(mode: ViewMode) {
    setViewMode(mode)
    localStorage.setItem(`viewMode_${key}`, mode)
  }

  return [viewMode, updateViewMode] as const
}
