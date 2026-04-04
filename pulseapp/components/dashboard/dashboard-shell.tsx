'use client'

import { useState, useEffect } from 'react'
import { Toaster, toast } from 'sonner'
import Sidebar from './sidebar'
import TopBar from './top-bar'
import CommandPalette from './command-palette'
import type { SectorType, PlanType, StaffPermissions } from '@/types'

interface DashboardShellProps {
  children: React.ReactNode
  businessName: string
  userName: string
  sector: SectorType
  plan: PlanType
  permissions: StaffPermissions
}

export default function DashboardShell({
  children,
  businessName,
  userName,
  sector,
  plan,
  permissions,
}: DashboardShellProps) {
  const [commandOpen, setCommandOpen] = useState(false)

  // Global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // pulse-toast CustomEvent → Sonner bridge
  useEffect(() => {
    const TYPE_MAP: Record<string, typeof toast.info> = {
      appointment: toast.info,
      review:      toast.warning,
      payment:     toast.success,
      customer:    toast.info,
      system:      toast,
      stock_alert: toast.error,
    }
    function handlePulseToast(e: Event) {
      const detail = (e as CustomEvent).detail
      if (!detail) return
      const fn = TYPE_MAP[detail.type] ?? toast
      fn(detail.title, { description: detail.body ?? undefined, duration: 5000 })
    }
    window.addEventListener('pulse-toast', handlePulseToast)
    return () => window.removeEventListener('pulse-toast', handlePulseToast)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar
        businessName={businessName}
        userName={userName}
        sector={sector}
        plan={plan}
        permissions={permissions}
      />

      <main className="lg:pl-64 transition-[padding] duration-200">
        <TopBar
          businessName={businessName}
          userName={userName}
          onOpenCommand={() => setCommandOpen(true)}
        />
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />

      {/* Sonner toast — dark mode aware */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: 'rounded-xl border shadow-lg text-sm font-medium',
            title: 'font-semibold',
          },
          duration: 4000,
        }}
        richColors
        closeButton
      />
    </div>
  )
}
