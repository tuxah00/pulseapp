'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Genel Bakış',
  appointments: 'Randevular',
  customers: 'Müşteriler',
  messages: 'Mesajlar',
  analytics: 'Analitik',
  reviews: 'Yorumlar',
  stoklar: 'Stoklar',
  records: 'Dosyalar',
  memberships: 'Üyelikler',
  classes: 'Sınıf Programı',
  attendance: 'Devam Takibi',
  portfolio: 'Portfolyo',
  settings: 'Ayarlar',
  business: 'İşletme',
  whatsapp: 'WhatsApp',
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
      <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
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
