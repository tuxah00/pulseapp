'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Toaster, toast } from 'sonner'
import { motion } from 'framer-motion'
import { SidebarProvider, useSidebar } from '@/lib/hooks/sidebar-context'
import Sidebar from './sidebar'
import TopBar from './top-bar'
import PilotBanner from './pilot-banner'
import SuccessNotification from '@/components/ui/success-notification'
import { isPilotMode } from '@/lib/pilot'

const CommandPalette = dynamic(() => import('./command-palette'), {
  ssr: false,
  loading: () => null,
})
const AIAssistantPanel = dynamic(() => import('./ai-assistant/ai-assistant-panel'), {
  ssr: false,
  loading: () => null,
})
import type { SectorType, PlanType, StaffPermissions, StaffRole, BusinessSettings } from '@/types'

interface DashboardShellProps {
  children: React.ReactNode
  businessName: string
  userName: string
  sector: SectorType
  plan: PlanType
  permissions: StaffPermissions
  staffRole: StaffRole
  settings?: BusinessSettings | null
}

const SIDEBAR_SPRING = { type: 'spring' as const, stiffness: 400, damping: 40 }

export default function DashboardShell(props: DashboardShellProps) {
  return (
    <SidebarProvider>
      <DashboardShellInner {...props} />
    </SidebarProvider>
  )
}

function DashboardShellInner({
  children,
  businessName,
  userName,
  sector,
  plan,
  permissions,
  staffRole,
  settings,
}: DashboardShellProps) {
  const { collapsed } = useSidebar()
  const [commandOpen, setCommandOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [successNotif, setSuccessNotif] = useState<{ title: string; body?: string } | null>(null)

  const dismissSuccess = useCallback(() => setSuccessNotif(null), [])

  // Breakpoint detection
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

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
      // Success type → üst-orta bildirim bileşeni
      if (detail.type === 'success') {
        setSuccessNotif({ title: detail.title, body: detail.body ?? undefined })
        return
      }
      const fn = TYPE_MAP[detail.type] ?? toast
      fn(detail.title, { description: detail.body ?? undefined, duration: 5000 })
    }
    window.addEventListener('pulse-toast', handlePulseToast)
    return () => window.removeEventListener('pulse-toast', handlePulseToast)
  }, [])

  const paddingLeft = isDesktop ? (collapsed ? 72 : 256) : 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar
        businessName={businessName}
        userName={userName}
        sector={sector}
        plan={plan}
        permissions={permissions}
        staffRole={staffRole}
        settings={settings}
      />

      <motion.main
        animate={{ paddingLeft }}
        transition={SIDEBAR_SPRING}
        className="min-h-screen"
      >
        <TopBar
          businessName={businessName}
          userName={userName}
          onOpenCommand={() => setCommandOpen(true)}
        />
        <PilotBanner active={isPilotMode(settings)} />
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </motion.main>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />

      {/* AI Asistan — Floating Panel */}
      <AIAssistantPanel
        businessName={businessName}
        sector={sector}
        plan={plan}
        permissions={permissions}
      />

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

      {/* Başarı bildirimi — üst orta */}
      <SuccessNotification
        show={!!successNotif}
        title={successNotif?.title || ''}
        body={successNotif?.body}
        onDismiss={dismissSuccess}
      />
    </div>
  )
}
