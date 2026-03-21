'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home, Bell } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'

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
  services: 'Hizmetler',
  staff: 'Personeller',
  new: 'Yeni',
}

interface TopBarProps {
  businessName: string
  userName: string
}

export default function TopBar({ businessName, userName }: TopBarProps) {
  const pathname = usePathname()
  const { businessId } = useBusinessContext()
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
      }, () => { fetchUnread() })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [businessId])

  // Build breadcrumb from pathname
  const segments = pathname.split('/').filter(Boolean)
  // segments[0] is always 'dashboard'
  const crumbs = segments.map((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/')
    const label = ROUTE_LABELS[seg] ?? seg
    return { href, label, isLast: i === segments.length - 1 }
  })

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm px-4 sm:px-6">
      <nav className="hidden sm:flex items-center gap-1 text-sm min-w-0" aria-label="Breadcrumb">
        {crumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1">
            {i === 0 ? (
              <Link
                href={crumb.href}
                className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <Home className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{crumb.label}</span>
              </Link>
            ) : crumb.isLast ? (
              <span className="font-medium text-gray-900 dark:text-gray-100">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                {crumb.label}
              </Link>
            )}
            {!crumb.isLast && (
              <ChevronRight className="h-3.5 w-3.5 text-gray-400 dark:text-gray-600" />
            )}
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <Link href="/dashboard/notifications" className="relative p-1 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors" title="Bildirimler">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-none">{userName}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 leading-none mt-0.5">{businessName}</span>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pulse-100 dark:bg-pulse-900/40 text-pulse-700 dark:text-pulse-300 text-sm font-semibold flex-shrink-0">
          {userName.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  )
}
