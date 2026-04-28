'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Toaster, toast } from 'sonner'
import { motion } from 'framer-motion'
import { SidebarProvider, useSidebar } from '@/lib/hooks/sidebar-context'
import Sidebar from './sidebar'
import TopBar from './top-bar'
import SuccessNotification from '@/components/ui/success-notification'

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
  const router = useRouter()
  const [commandOpen, setCommandOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  // Üst orta bildirim — pending/success/error variant'ı destekler.
  // Aynı id ile yeniden dispatch edilirse REPLACE (pending → success/error geçişi).
  const [opNotif, setOpNotif] = useState<{
    id?: string
    variant: 'pending' | 'success' | 'error'
    title: string
    body?: string
  } | null>(null)

  const dismissOpNotif = useCallback(() => setOpNotif(null), [])

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
      consultation_request: toast.info,
      ai_alert:    toast.info,
    }

    // related_type → hedef route
    function getRouteFor(type: string | null, relatedId: string | null): string | null {
      if (!relatedId) return null
      switch (type) {
        case 'appointment': return `/dashboard/appointments?appointmentId=${relatedId}`
        case 'consultation_request': return `/dashboard/consultations?id=${relatedId}`
        case 'review': return '/dashboard/reviews'
        case 'customer': return `/dashboard/customers?id=${relatedId}`
        case 'message': return '/dashboard/messages'
        case 'feedback': return '/dashboard/feedback'
        default: return null
      }
    }

    function handlePulseToast(e: Event) {
      const detail = (e as CustomEvent).detail
      if (!detail) return
      // pending / success / error → üst-orta operasyon bildirimi (id ile replace edilebilir)
      if (detail.type === 'pending' || detail.type === 'success' || detail.type === 'error') {
        setOpNotif({
          id: detail.id,
          variant: detail.type,
          title: detail.title,
          body: detail.body ?? undefined,
        })
        return
      }
      const fn = TYPE_MAP[detail.type] ?? toast
      const route = getRouteFor(detail.related_type ?? detail.type, detail.related_id ?? null)

      fn(detail.title, {
        description: detail.body ?? undefined,
        duration: 8000, // tıklamaya zaman ver
        // Görsel ipucu — tıklanabilir toast'larda imleç pointer olur
        className: route ? 'cursor-pointer' : undefined,
        // Aksiyon butonu — Sonner'da resmi CTA mekanizması
        ...(route && {
          action: {
            label: 'Git →',
            onClick: () => router.push(route),
          },
          actionButtonStyle: {
            backgroundColor: '#193d8f',
            color: '#ffffff',
            fontWeight: '600',
            fontSize: '12px',
            padding: '4px 10px',
            borderRadius: '6px',
          },
        }),
      })
    }
    window.addEventListener('pulse-toast', handlePulseToast)
    return () => window.removeEventListener('pulse-toast', handlePulseToast)
  }, [router])

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

      {/* Operasyon bildirimi — üst orta. Pending → success/error geçişi tek bileşende */}
      <SuccessNotification
        show={!!opNotif}
        variant={opNotif?.variant ?? 'success'}
        title={opNotif?.title || ''}
        body={opNotif?.body}
        onDismiss={dismissOpNotif}
      />
    </div>
  )
}
