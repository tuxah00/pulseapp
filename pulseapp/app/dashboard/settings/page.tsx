'use client'

import Link from 'next/link'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { requirePermission } from '@/lib/hooks/use-require-permission'
import {
  Building2, Sparkles, BadgePercent, UserCog,
  CreditCard, ShieldCheck, ChevronRight, Loader2,
  type LucideIcon,
} from 'lucide-react'

interface SettingsCard {
  href: string
  title: string
  description: string
  icon: LucideIcon
  iconBg: string
}

const SETTINGS_CARDS: SettingsCard[] = [
  {
    href: '/dashboard/settings/business',
    title: 'İşletme',
    description: 'İşletme bilgileri, çalışma saatleri, hatırlatma & bildirim ayarları.',
    icon: Building2,
    iconBg: 'from-blue-500 to-indigo-600',
  },
  {
    href: '/dashboard/settings/ai',
    title: 'AI Asistan',
    description: 'Asistanın tonu, varsayılan hatırlatma süresi ve işletmene özel talimatlar.',
    icon: Sparkles,
    iconBg: 'from-purple-500 to-indigo-600',
  },
  {
    href: '/dashboard/settings/staff',
    title: 'Personel Yetkileri',
    description: 'Personel ekleme, rol ataması ve modül bazlı yetki yönetimi.',
    icon: UserCog,
    iconBg: 'from-emerald-500 to-teal-600',
  },
  {
    href: '/dashboard/settings/commissions',
    title: 'Prim & Komisyon',
    description: 'Personel bazında hizmet komisyonu ve prim kuralları.',
    icon: BadgePercent,
    iconBg: 'from-amber-500 to-orange-600',
  },
  {
    href: '/dashboard/settings/billing',
    title: 'Faturalama',
    description: 'Abonelik planı, ödeme yöntemi ve fatura geçmişi.',
    icon: CreditCard,
    iconBg: 'from-rose-500 to-pink-600',
  },
  {
    href: '/dashboard/settings/audit',
    title: 'Denetim Kaydı',
    description: 'Yapılan tüm işlemlerin detaylı kayıt geçmişi (sadece sahip).',
    icon: ShieldCheck,
    iconBg: 'from-slate-500 to-gray-600',
  },
]

export default function SettingsHubPage() {
  const { permissions, staffRole, loading } = useBusinessContext()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-pulse-900" />
      </div>
    )
  }

  requirePermission(permissions, 'settings')

  const visibleCards = SETTINGS_CARDS.filter(card => {
    // Denetim kaydı sadece owner görsün
    if (card.href === '/dashboard/settings/audit') return staffRole === 'owner'
    return true
  })

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Ayarlar</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          İşletme ayarlarını, asistan tercihlerini ve yetkilendirmeyi buradan yönet.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-4">
        {visibleCards.map(card => {
          const Icon = card.icon
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group card p-5 hover:border-pulse-900/50 dark:hover:border-pulse-300/30 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-4">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${card.iconBg} flex items-center justify-center text-white flex-shrink-0 shadow-sm`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{card.title}</h2>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-pulse-900 dark:group-hover:text-pulse-300 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
