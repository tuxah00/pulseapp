'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, CalendarDays, Stethoscope, Receipt, Folder,
  Gift, Star, MessageSquarePlus, Settings, LogOut, Menu, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConfirmProvider } from '@/lib/hooks/use-confirm'

interface PortalShellProps {
  businessId: string
  business: { id: string; name: string; logo_url?: string | null; sector?: string | null }
  customer: { id: string; name: string; phone: string; segment?: string | null }
  showTreatments: boolean
  children: React.ReactNode
}

type NavItem = {
  key: string
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  mobileTab?: boolean
}

const SEGMENT_GRADIENT: Record<string, string> = {
  vip: 'from-amber-400 to-yellow-600',
  regular: 'from-pulse-700 to-indigo-600',
  new: 'from-emerald-400 to-teal-500',
  risk: 'from-orange-400 to-red-500',
  lost: 'from-gray-400 to-gray-600',
}

const SEGMENT_LABELS: Record<string, string> = {
  new: 'Yeni Müşteri',
  regular: 'Düzenli Müşteri',
  vip: 'VIP Müşteri',
  risk: 'Risk',
  lost: 'Kayıp',
}

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function buildNav(businessId: string, showTreatments: boolean): NavItem[] {
  const base = `/portal/${businessId}/dashboard`
  return [
    { key: 'overview', label: 'Özet', href: base, icon: LayoutDashboard, mobileTab: true },
    { key: 'appointments', label: 'Randevularım', href: `${base}/appointments`, icon: CalendarDays, mobileTab: true },
    ...(showTreatments
      ? [{ key: 'treatments', label: 'Tedavilerim', href: `${base}/treatments`, icon: Stethoscope }]
      : []),
    { key: 'invoices', label: 'Faturalarım', href: `${base}/invoices`, icon: Receipt },
    { key: 'files', label: 'Dosyalarım', href: `${base}/files`, icon: Folder, mobileTab: true },
    { key: 'rewards', label: 'Ödüllerim', href: `${base}/rewards`, icon: Gift, mobileTab: true },
    { key: 'reviews', label: 'Yorumlarım', href: `${base}/reviews`, icon: Star },
    { key: 'feedback', label: 'Geri Bildirim', href: `${base}/feedback`, icon: MessageSquarePlus },
    { key: 'settings', label: 'Ayarlar', href: `${base}/settings`, icon: Settings, mobileTab: true },
  ]
}

export function PortalShell({ businessId, business, customer, showTreatments, children }: PortalShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const nav = buildNav(businessId, showTreatments)
  const mobileTabs = nav.filter(n => n.mobileTab)

  const isActive = (href: string) => {
    if (href === `/portal/${businessId}/dashboard`) return pathname === href
    return pathname?.startsWith(href) ?? false
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/portal/logout', { method: 'DELETE' })
    } catch { /* ignore */ }
    router.replace(`/portal/${businessId}`)
  }

  const segment = customer.segment || 'regular'
  const gradient = SEGMENT_GRADIENT[segment] || SEGMENT_GRADIENT.regular

  return (
    <ConfirmProvider>
    <div className="portal-page min-h-screen bg-gray-50 flex">
      {/* Mobil overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 h-screen w-72 bg-white border-r border-gray-100 flex flex-col z-50 transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* İşletme hero */}
        <div className="p-5 border-b border-gray-100 bg-gradient-to-br from-pulse-900/5 via-transparent to-purple-500/5">
          <div className="flex items-center gap-3">
            {business.logo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={business.logo_url} alt={business.name} className="h-10 w-10 rounded-xl object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-pulse-900 flex items-center justify-center">
                <span className="text-sm font-bold text-white">{business.name.slice(0, 1).toUpperCase()}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{business.name}</p>
              <p className="text-xs text-gray-400">Müşteri Portalı</p>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden -mr-1 p-1.5 rounded-lg text-gray-400 hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Müşteri hero */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={cn('h-12 w-12 rounded-full bg-gradient-to-br flex items-center justify-center shadow-md', gradient)}>
              <span className="text-base font-bold text-white">{initials(customer.name)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{customer.name}</p>
              <p className="text-xs text-gray-500">{SEGMENT_LABELS[segment] || 'Müşteri'}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  active
                    ? 'bg-pulse-900 text-white shadow-md shadow-pulse-900/20'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <Icon className={cn('h-4 w-4', active ? 'text-white' : 'text-gray-400')} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Alt — çıkış */}
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-70"
          >
            <LogOut className="h-4 w-4" />
            {loggingOut ? 'Çıkış yapılıyor…' : 'Çıkış Yap'}
          </button>
        </div>
      </aside>

      {/* Ana içerik */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* TopBar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100">
          <div className="flex items-center gap-3 px-4 lg:px-8 h-14">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100"
              aria-label="Menüyü aç"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex-1" />
          </div>
        </header>

        {/* İçerik */}
        <main key={pathname} className="portal-page-enter flex-1 px-4 lg:px-8 py-5 lg:py-8 pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobil alt tab bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 z-40 grid grid-cols-5">
        {mobileTabs.slice(0, 5).map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 py-2 text-[11px]',
                active ? 'text-pulse-900' : 'text-gray-500'
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'text-pulse-900')} />
              <span className="leading-none">{item.label.split(' ')[0]}</span>
            </Link>
          )
        })}
      </nav>
    </div>
    </ConfirmProvider>
  )
}
