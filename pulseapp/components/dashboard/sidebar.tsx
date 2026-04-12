'use client'

import { useState } from 'react'
import { useSidebar } from '@/lib/hooks/sidebar-context'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  CalendarCheck,
  Users,
  UserCog,
  MessageSquare,
  Star,
  BarChart3,
  ShieldCheck,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
  Banknote,
  ListChecks,
  Package,
  FolderOpen,
  Briefcase,
  Car,
  PawPrint,
  ClipboardList,
  CreditCard,
  CalendarDays,
  CalendarClock,
  CheckSquare,
  BookOpen,
  Image,
  Receipt,
  Layers,
  Lock,
  Clock,
  Stethoscope,
  Gift,
  Zap,
  X,
  Megaphone,
  BadgePercent,
  type LucideIcon,
} from 'lucide-react'
import type { SectorType, PlanType, StaffPermissions } from '@/types'
import { getSidebarSections } from '@/lib/config/sector-modules'


const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, CalendarCheck, Users, UserCog,
  MessageSquare, Star, BarChart3, ShieldCheck,
  Settings, LogOut, ListChecks, Package, FolderOpen,
  Briefcase, Car, PawPrint, ClipboardList, CreditCard,
  CalendarDays, CalendarClock, CheckSquare, BookOpen, Image,
  Receipt, Layers, Banknote, Lock, Clock, Stethoscope, Gift, Zap, X, Megaphone, BadgePercent,
}

const bottomNav = [
  { name: 'Ayarlar', href: '/dashboard/settings/business', icon: Settings },
]

const PERMISSION_MAP: Record<string, keyof StaffPermissions> = {
  '/dashboard/appointments': 'appointments',
  '/dashboard/customers': 'customers',
  '/dashboard/analytics': 'analytics',
  '/dashboard/messages': 'messages',
  '/dashboard/reviews': 'reviews',
  '/dashboard/services': 'services',
  '/dashboard/staff': 'staff',
  '/dashboard/inventory': 'inventory',
  '/dashboard/records': 'records',
  '/dashboard/reservations': 'reservations',
  '/dashboard/classes': 'classes',
  '/dashboard/memberships': 'memberships',
  '/dashboard/portfolio': 'portfolio',
  '/dashboard/shifts': 'shifts',
  '/dashboard/orders': 'orders',
  '/dashboard/invoices': 'invoices',
  '/dashboard/packages': 'packages',
  '/dashboard/pos': 'pos',
  '/dashboard/audit': 'settings',
  '/dashboard/kvkk': 'settings',
  '/dashboard/protocols': 'protocols',
  '/dashboard/referrals': 'referrals',
  '/dashboard/campaigns': 'campaigns',
  '/dashboard/waitlist': 'appointments',
  '/dashboard/settings/services': 'services',
  '/dashboard/settings/staff': 'staff',
  '/dashboard/settings/shifts': 'shifts',
  '/dashboard/settings/audit': 'settings',
  '/dashboard/settings/commissions': 'settings',
}

interface SidebarProps {
  businessName: string
  userName: string
  sector: SectorType
  plan: PlanType
  permissions: StaffPermissions
}

export default function Sidebar({ businessName, userName, sector, plan, permissions }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { collapsed, setCollapsed } = useSidebar()
  const [mobileOpen, setMobileOpen] = useState(false)

  const rawSections = getSidebarSections(sector, plan)

  const sections = rawSections.map(section => ({
    ...section,
    items: section.items.filter(item => {
      const hrefPath = item.href.split('?')[0]
      const permKey = PERMISSION_MAP[hrefPath]
      if (!permKey) return true
      return permissions[permKey] !== false
    }),
  })).filter(section => section.items.length > 0)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  function isActive(href: string) {
    const path = href.split('?')[0]
    if (path === '/dashboard') return pathname === '/dashboard'
    return pathname === path || pathname.startsWith(path + '/')
  }

  // User initials for avatar
  const initials = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  const sidebarContent = (
    <div className="flex h-full flex-col">

      {/* ── Header ── */}
      <div className={cn(
        'flex h-16 items-center gap-3 px-4 border-b border-white/10',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pulse-900 shadow-sm shadow-pulse-900/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-white dark:ring-gray-900" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="min-w-0 overflow-hidden"
              >
                <p className="truncate text-sm font-bold text-gray-900 dark:text-white">PulseApp</p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">{businessName}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-gray-400
                     hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-600 dark:hover:text-gray-300
                     transition-colors flex-shrink-0"
        >
          <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronLeft className="h-4 w-4" />
          </motion.div>
        </button>
        {/* Mobile close */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {sections.map((section) => (
          <div key={section.label}>
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500"
                >
                  {section.label}
                </motion.p>
              )}
            </AnimatePresence>
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
                      'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                      active
                        ? 'bg-pulse-900/10 text-pulse-900 dark:text-pulse-300 dark:bg-pulse-900/15'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-100'
                    )}
                  >
                    {/* Active indicator */}
                    {active && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute left-0 top-0 bottom-0 my-auto w-1 h-5 rounded-r-full bg-pulse-900"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <Icon className={cn(
                      'h-4.5 w-4.5 flex-shrink-0 transition-colors',
                      active ? 'text-pulse-900 dark:text-pulse-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                    )} />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.12 }}
                          className="overflow-hidden whitespace-nowrap"
                        >
                          {item.name}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Bottom ── */}
      <div className="border-t border-gray-200/60 dark:border-white/10 px-3 py-3 space-y-0.5">
        {bottomNav.filter((item) => {
          if (item.href === '/dashboard/settings/business') return permissions.settings !== false
          return true
        }).map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-pulse-900/10 text-pulse-900 dark:text-pulse-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-100'
              )}
            >
              <item.icon className={cn('h-4.5 w-4.5 flex-shrink-0', active ? 'text-pulse-900' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300')} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="overflow-hidden whitespace-nowrap">
                    {item.name}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          )
        })}

        <button
          onClick={handleLogout}
          className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium
                     text-gray-600 dark:text-gray-400 transition-all duration-150
                     hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
        >
          <LogOut className="h-4.5 w-4.5 flex-shrink-0 text-gray-400 group-hover:text-red-500 transition-colors" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="overflow-hidden whitespace-nowrap">
                Çıkış Yap
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* User card */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 overflow-hidden"
            >
              <div className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-2.5">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{userName}</p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">İşletme Sahibi</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-xl
                   bg-white dark:bg-gray-900 shadow-md border border-gray-200 dark:border-gray-800 lg:hidden
                   hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <Menu className="h-5 w-5 text-gray-600 dark:text-gray-300" />
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            className="fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-950 shadow-2xl lg:hidden
                       border-r border-gray-200/80 dark:border-white/10"
          >
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 256 }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:flex-col
                   bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl
                   border-r border-gray-200/80 dark:border-white/[0.06]
                   shadow-[1px_0_20px_rgba(0,0,0,0.06)]"
      >
        {sidebarContent}
      </motion.aside>
    </>
  )
}
