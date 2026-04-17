'use client'

import { useState } from 'react'

type ViewMode = 'list' | 'box' | 'week' | 'month' | 'staff' | 'room'

// Eski Türkçe key'lerini İngilizce karşılıklarına taşımak için migration tablosu.
// Kullanıcıların mevcut tercihleri korunur.
const LEGACY_KEY_MAP: Record<string, string> = {
  packages: 'paketler',
  inventory: 'stoklar',
}

function readStoredMode(key: string): ViewMode | null {
  if (typeof window === 'undefined') return null
  const current = localStorage.getItem(`viewMode_${key}`)
  if (current) return current as ViewMode
  const legacyKey = LEGACY_KEY_MAP[key]
  if (!legacyKey) return null
  const legacy = localStorage.getItem(`viewMode_${legacyKey}`)
  if (legacy) {
    // Migrate once
    localStorage.setItem(`viewMode_${key}`, legacy)
    localStorage.removeItem(`viewMode_${legacyKey}`)
    return legacy as ViewMode
  }
  return null
}

export function useViewMode(key: string, defaultMode: ViewMode = 'list') {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = readStoredMode(key)
    const valid: ViewMode[] = ['list', 'box', 'week', 'month', 'staff', 'room']
    if (stored && valid.includes(stored)) return stored
    return defaultMode
  })

  function updateViewMode(mode: ViewMode) {
    setViewMode(mode)
    if (typeof window !== 'undefined') {
      localStorage.setItem(`viewMode_${key}`, mode)
    }
  }

  return [viewMode, updateViewMode] as const
}
