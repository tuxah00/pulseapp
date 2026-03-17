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
  UserPlus,
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
  Package,
  FolderOpen,
  Briefcase,
  Car,
  PawPrint,
  ClipboardList,
  CreditCard,
  CalendarDays,
  CheckSquare,
  BookOpen,
  Image,
  type LucideIcon,
} from 'lucide-react'
import type { SectorType, PlanType } from '@/types'
import { getSidebarSections } from '@/lib/config/sector-modules'

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Calendar,
  Users,
  UserPlus,
  MessageSquare,
  MessageCircle,
  Star,
  BarChart3,
  Settings,
  LogOut,
  Scissors,
  Package,
  FolderOpen,
  Briefcase,
  Car,
  PawPrint,
  ClipboardList,
  CreditCard,
  CalendarDays,
  CheckSquare,
  BookOpen,
  Image,
}

const bottomNav = [
  { name: 'WhatsApp', href: '/dashboard/settings/whatsapp', icon: MessageCircle },
  { name: 'İşletmeler', href: '/dashboard/settings/businesses', icon: Briefcase },
  { name: 'Ayarlar', href: '/dashboard/settings/business', icon: Settings },
]

interface SidebarProps {
  businessName: string
  userName: string
  sector: SectorType
  plan: PlanType
}

export default function Sidebar({ businessName, userName, sector, plan }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const sections = getSidebarSections(sector, plan)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  function isActive(href: string) {
    const path = href.split('?')[0]
    if (path === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(path)
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-gray-200 dark:border-gray-700 px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pulse-500 flex-shrink-0">
          <Zap className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">PulseApp</p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{businessName}</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Ana navigasyon — sektöre göre dinamik */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {sections.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = ICON_MAP[item.iconName] ?? LayoutDashboard
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-pulse-50 text-pulse-700 dark:bg-pulse-950/40 dark:text-pulse-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/60 hover:text-gray-900 dark:hover:text-gray-100'
                    )}
                  >
                    <Icon className={cn('h-5 w-5 flex-shrink-0', active ? 'text-pulse-600 dark:text-pulse-400' : 'text-gray-400 dark:text-gray-500')} />
                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Alt navigasyon */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-4 space-y-0.5">
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
                  ? 'bg-pulse-50 text-pulse-700 dark:bg-pulse-950/40 dark:text-pulse-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/60 hover:text-gray-900 dark:hover:text-gray-100'
              )}
            >
              <item.icon className={cn('h-5 w-5 flex-shrink-0', active ? 'text-pulse-600 dark:text-pulse-400' : 'text-gray-400 dark:text-gray-500')} />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          )
        })}

        {/* Çıkış */}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400"
        >
          <LogOut className="h-5 w-5 flex-shrink-0 text-gray-400" />
          {!collapsed && <span>Çıkış Yap</span>}
        </button>

        {/* Kullanıcı */}
        {!collapsed && (
          <div className="mt-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2.5">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{userName}</p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">İşletme Sahibi</p>
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
        className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-lg bg-white dark:bg-gray-800 shadow-md lg:hidden"
      >
        <Menu className="h-5 w-5 text-gray-600 dark:text-gray-300" />
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
          'fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 shadow-xl transition-transform lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-200',
          collapsed ? 'lg:w-[72px]' : 'lg:w-64'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
