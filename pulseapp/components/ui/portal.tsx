'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Portal: render children'ı document.body'ye taşır.
 * Tüm stacking context / containing block sorunlarını bypass eder.
 * Modal/sheet/popup/slide-panel için kullanılmalı.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!mounted) return null
  return createPortal(children, document.body)
}
