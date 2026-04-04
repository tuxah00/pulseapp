'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home, Bell, Sun, Moon, Command } from 'lucide-react'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useTheme } from '@/components/theme-provider'
import { cn } from '@/lib/utils'

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Genel Bakış',
  appointments: 'Randevular',
  customers: 'Müşteriler',
  messages: 'Mesajlar',
  analytics: 'Gelir-Gider Tablosu',
  audit: 'Denetim Kaydı',
  reservations: 'Rezervasyonlar',
  reviews: 'Yorumlar',
  stoklar: 'Stoklar',
  records: 'Dosyalar',
  memberships: 'Üyelikler',
  classes: 'Sınıf Programı',
  attendance: 'Devam Takibi',
  portfolio: 'Portfolyo',
  orders: 'Siparişler',
  notifications: 'Bildirimler',
  settings: 'Ayarlar',
  business: 'İşletme',
  vardiye: 'Vardiya',
  vardiya: 'Vardiya',
  services: 'Hizmetler',
  hizmetler: 'Hizmetler',
  staff: 'Personeller',
  personeller: 'Personeller',
  denetim: 'Denetim Kaydı',
  invoices: 'Faturalar',
  paketler: 'Paket & Seans',
  kasa: 'Kasa',
  new: 'Yeni',
}

interface TopBarProps {
  businessName: string
  userName: string
  onOpenCommand?: () => void
}

export default function TopBar({ businessName, userName, onOpenCommand }: TopBarProps) {
  const pathname = usePathname()
  const { businessId } = useBusinessContext()
  const { theme, toggleTheme } = useTheme()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!businessId) return
    const supabase = createClient()

    const fetchUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('is_read', false)
      setUnreadCount(count ?? 0)
    }

    fetchUnread()

    const channel = supabase
      .channel('notifications-bell')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `business_id=eq.${businessId}`,
      }, (payload) => {
        fetchUnread()
        if (payload.eventType === 'INSERT' && payload.new) {
          window.dispatchEvent(new CustomEvent('pulse-toast', {
            detail: payload.new,
          }))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [businessId])

  const segments = pathname.split('/').filter(Boolean)
  const crumbs = segments.map((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/')
    const label = ROUTE_LABELS[seg] ?? seg
    return { href, label, isLast: i === segments.length - 1 }
  })

  const initials = userName.charAt(0).toUpperCase()

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4
                       border-b border-gray-200/80 dark:border-white/[0.06]
                       bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl
                       px-4 sm:px-6">

      {/* Breadcrumb */}
      <nav className="hidden sm:flex items-center gap-1 text-sm min-w-0 flex-1" aria-label="Breadcrumb">
        {crumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1 min-w-0">
            {i === 0 ? (
              <Link
                href={crumb.href}
                className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500
                           hover:text-gray-700 dark:hover:text-gray-200 transition-colors rounded-md px-1"
              >
                <Home className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="hidden sm:inline">{crumb.label}</span>
              </Link>
            ) : crumb.isLast ? (
              <span className="font-semibold text-gray-800 dark:text-gray-100 truncate px-1">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors px-1"
              >
                {crumb.label}
              </Link>
            )}
            {!crumb.isLast && (
              <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-700 flex-shrink-0" />
            )}
          </span>
        ))}
      </nav>

      {/* Actions */}
      <div className="ml-auto flex items-center gap-1">

        {/* Command palette trigger */}
        {onOpenCommand && (
          <button
            onClick={onOpenCommand}
            className="hidden sm:flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-800
                       bg-gray-50 dark:bg-white/5 px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500
                       hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-600 dark:hover:text-gray-300
                       transition-all duration-150"
          >
            <Command className="h-3 w-3" />
            <span>Ara</span>
            <kbd className="rounded bg-gray-200 dark:bg-gray-800 px-1 py-0.5 text-[10px] font-mono text-gray-500 dark:text-gray-400">
              K
            </kbd>
          </button>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="relative h-9 w-9 flex items-center justify-center rounded-lg
                     text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10
                     hover:text-gray-700 dark:hover:text-gray-200 transition-all duration-150"
          title={theme === 'dark' ? 'Aydınlık Mod' : 'Karanlık Mod'}
        >
          <AnimatePresence mode="wait" initial={false}>
            {theme === 'dark' ? (
              <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <Sun className="h-4.5 w-4.5" />
              </motion.div>
            ) : (
              <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <Moon className="h-4.5 w-4.5" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        {/* Notification bell */}
        <Link
          href="/dashboard/notifications"
          className="relative h-9 w-9 flex items-center justify-center rounded-lg
                     text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10
                     hover:text-gray-700 dark:hover:text-gray-200 transition-all duration-150"
          title="Bildirimler"
        >
          <Bell className="h-4.5 w-4.5" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center
                           rounded-full bg-red-500 text-[10px] text-white font-bold leading-none
                           ring-2 ring-white dark:ring-gray-950"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-400 opacity-75 animate-ping" />
          )}
        </Link>

        {/* User */}
        <div className="hidden sm:flex items-center gap-2.5 ml-1 pl-3 border-l border-gray-200 dark:border-gray-800">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-none">{userName}</span>
            <span className="text-xs text-gray-400 dark:text-gray-500 leading-none mt-0.5">{businessName}</span>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg
                          bg-pulse-500
                          text-white text-sm font-bold flex-shrink-0 shadow-sm shadow-pulse-500/20">
            {initials}
          </div>
        </div>
      </div>
    </header>
  )
}
