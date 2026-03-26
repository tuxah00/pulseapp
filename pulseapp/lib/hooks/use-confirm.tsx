'use client'

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'
import ConfirmDialog from '@/components/ui/confirm-dialog'

interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning'
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [open, setOpen] = useState(false)
  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setOptions(opts)
      setOpen(true)
    })
  }, [])

  const handleClose = useCallback(() => {
    setOpen(false)
    setOptions(null)
    resolveRef.current?.(false)
    resolveRef.current = null
  }, [])

  const handleConfirm = useCallback(() => {
    setOpen(false)
    setOptions(null)
    resolveRef.current?.(true)
    resolveRef.current = null
  }, [])

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialog
        open={open}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title={options?.title}
        message={options?.message || ''}
        confirmText={options?.confirmText}
        cancelText={options?.cancelText}
        variant={options?.variant}
      />
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
