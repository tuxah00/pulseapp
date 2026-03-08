'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Calendar,
  Users,
  MessageSquare,
  MessageCircle,
  Star,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
  Zap,
  Scissors,
} from 'lucide-react'

const navigation = [
  { name: 'Genel Bakış', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Randevular', href: '/dashboard/appointments', icon: Calendar },
  { name: 'Müşteriler', href: '/dashboard/customers', icon: Users },
  { name: 'Hizmetler', href: '/dashboard/settings/services', icon: Scissors },
  { name: 'Mesajlar', href: '/dashboard/messages', icon: MessageSquare },
  { name: 'Yorumlar', href: '/dashboard/reviews', icon: Star },
  { name: 'Analitik', href: '/dashboard/analytics', icon: BarChart3 },
]

const bottomNav = [
  { name: 'WhatsApp', href: '/dashboard/settings/whatsapp', icon: MessageCircle },
  { name: 'Ayarlar', href: '/dashboard/settings/business', icon: Settings },
]

interface SidebarProps {
  businessName: string
  userName: string
}

export default function Sidebar({ businessName, userName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pulse-500">
          <Zap className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-bold text-gray-900">PulseApp</p>
            <p className="truncate text-xs text-gray-500">{businessName}</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Ana navigasyon */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-pulse-50 text-pulse-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <item.icon className={cn('h-5 w-5 flex-shrink-0', active ? 'text-pulse-600' : 'text-gray-400')} />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Alt navigasyon */}
      <div className="border-t border-gray-200 px-3 py-4 space-y-1">
        {bottomNav.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-pulse-50 text-pulse-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <item.icon className={cn('h-5 w-5 flex-shrink-0', active ? 'text-pulse-600' : 'text-gray-400')} />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          )
        })}

        {/* Kullanıcı bilgisi + Çıkış */}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-5 w-5 flex-shrink-0 text-gray-400" />
          {!collapsed && <span>Çıkış Yap</span>}
        </button>

        {/* Kullanıcı */}
        {!collapsed && (
          <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="truncate text-sm font-medium text-gray-900">{userName}</p>
            <p className="truncate text-xs text-gray-500">İşletme Sahibi</p>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Mobil hamburger butonu */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-md lg:hidden"
      >
        <Menu className="h-5 w-5 text-gray-600" />
      </button>

      {/* Mobil overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobil sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transition-transform lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:flex-col bg-white border-r border-gray-200 transition-all duration-200',
          collapsed ? 'lg:w-[72px]' : 'lg:w-64'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
