'use client'

import { useState, useEffect } from 'react'

export function useViewMode(key: string, defaultMode: 'list' | 'box' = 'list') {
  const [viewMode, setViewMode] = useState<'list' | 'box'>(defaultMode)

  useEffect(() => {
    const stored = localStorage.getItem(`viewMode_${key}`) as 'list' | 'box' | null
    if (stored === 'list' || stored === 'box') setViewMode(stored)
  }, [key])

  function updateViewMode(mode: 'list' | 'box') {
    setViewMode(mode)
    localStorage.setItem(`viewMode_${key}`, mode)
  }

  return [viewMode, updateViewMode] as const
}
