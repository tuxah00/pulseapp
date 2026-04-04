'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Calendar, Users, MessageSquare, BarChart3,
  Star, Package, Receipt, Wallet, Settings, Scissors,
  ClipboardList, FolderOpen, Bell, Search, ArrowRight,
} from 'lucide-react'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ReactNode
  href: string
  group: string
}

const COMMANDS: CommandItem[] = [
  { id: 'dashboard', label: 'Genel Bakış', icon: <LayoutDashboard className="h-4 w-4" />, href: '/dashboard', group: 'Sayfalar' },
  { id: 'appointments', label: 'Randevular', icon: <Calendar className="h-4 w-4" />, href: '/dashboard/appointments', group: 'Sayfalar' },
  { id: 'customers', label: 'Müşteriler', icon: <Users className="h-4 w-4" />, href: '/dashboard/customers', group: 'Sayfalar' },
  { id: 'messages', label: 'Mesajlar', icon: <MessageSquare className="h-4 w-4" />, href: '/dashboard/messages', group: 'Sayfalar' },
  { id: 'analytics', label: 'Gelir-Gider', icon: <BarChart3 className="h-4 w-4" />, href: '/dashboard/analytics', group: 'Sayfalar' },
  { id: 'reviews', label: 'Yorumlar', icon: <Star className="h-4 w-4" />, href: '/dashboard/reviews', group: 'Sayfalar' },
  { id: 'invoices', label: 'Faturalar', icon: <Receipt className="h-4 w-4" />, href: '/dashboard/invoices', group: 'Sayfalar' },
  { id: 'kasa', label: 'Kasa', icon: <Wallet className="h-4 w-4" />, href: '/dashboard/kasa', group: 'Sayfalar' },
  { id: 'stoklar', label: 'Stoklar', icon: <Package className="h-4 w-4" />, href: '/dashboard/stoklar', group: 'Sayfalar' },
  { id: 'hizmetler', label: 'Hizmetler', icon: <Scissors className="h-4 w-4" />, href: '/dashboard/hizmetler', group: 'Sayfalar' },
  { id: 'records', label: 'Dosyalar', icon: <FolderOpen className="h-4 w-4" />, href: '/dashboard/records', group: 'Sayfalar' },
  { id: 'notifications', label: 'Bildirimler', icon: <Bell className="h-4 w-4" />, href: '/dashboard/notifications', group: 'Sayfalar' },
  { id: 'denetim', label: 'Denetim Kaydı', icon: <ClipboardList className="h-4 w-4" />, href: '/dashboard/denetim', group: 'Sayfalar' },
  { id: 'settings', label: 'Ayarlar', icon: <Settings className="h-4 w-4" />, href: '/dashboard/settings/business', group: 'Ayarlar' },
  { id: 'new-appointment', label: 'Yeni Randevu', description: 'Hızlı randevu oluştur', icon: <Calendar className="h-4 w-4 text-pulse-500" />, href: '/dashboard/appointments?new=1', group: 'Hızlı İşlemler' },
]

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const filtered = query.trim()
    ? COMMANDS.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        (c.description?.toLowerCase().includes(query.toLowerCase()))
      )
    : COMMANDS

  const grouped = filtered.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = []
    acc[item.group].push(item)
    return acc
  }, {} as Record<string, CommandItem[]>)

  const flatFiltered = filtered

  const navigate = useCallback((href: string) => {
    router.push(href)
    onClose()
    setQuery('')
  }, [router, onClose])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (!open) { setQuery(''); setSelectedIndex(0) }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, flatFiltered.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && flatFiltered[selectedIndex]) {
        navigate(flatFiltered[selectedIndex].href)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, flatFiltered, selectedIndex, navigate, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            className="fixed left-1/2 top-[20vh] z-50 w-full max-w-lg -translate-x-1/2
                       overflow-hidden rounded-2xl
                       bg-white dark:bg-gray-900
                       shadow-2xl shadow-black/20 dark:shadow-black/60
                       border border-gray-200/80 dark:border-white/10"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-gray-100 dark:border-white/10 px-4 py-3.5">
              <Search className="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Sayfa veya işlem ara..."
                className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100
                           placeholder-gray-400 dark:placeholder-gray-600
                           outline-none"
              />
              <kbd className="hidden sm:flex items-center gap-0.5 rounded border border-gray-200 dark:border-gray-700
                              bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-mono
                              text-gray-400 dark:text-gray-600">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto py-2">
              {Object.keys(grouped).length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-600">
                  Sonuç bulunamadı
                </div>
              ) : (
                Object.entries(grouped).map(([group, items]) => (
                  <div key={group}>
                    <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-600">
                      {group}
                    </div>
                    {items.map(item => {
                      const globalIdx = flatFiltered.findIndex(f => f.id === item.id)
                      const isSelected = globalIdx === selectedIndex
                      return (
                        <button
                          key={item.id}
                          onClick={() => navigate(item.href)}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            isSelected
                              ? 'bg-pulse-50 dark:bg-pulse-500/10'
                              : 'hover:bg-gray-50 dark:hover:bg-white/5'
                          }`}
                        >
                          <span className={`flex-shrink-0 ${isSelected ? 'text-pulse-600 dark:text-pulse-400' : 'text-gray-400 dark:text-gray-600'}`}>
                            {item.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className={`block text-sm font-medium ${isSelected ? 'text-pulse-700 dark:text-pulse-300' : 'text-gray-900 dark:text-gray-100'}`}>
                              {item.label}
                            </span>
                            {item.description && (
                              <span className="block text-xs text-gray-400 dark:text-gray-600 truncate">
                                {item.description}
                              </span>
                            )}
                          </div>
                          {isSelected && (
                            <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-pulse-500" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-gray-100 dark:border-white/10 px-4 py-2.5">
              <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-600">
                <span className="flex items-center gap-1">
                  <kbd className="rounded bg-gray-100 dark:bg-gray-800 px-1 py-0.5 font-mono">↑↓</kbd>
                  Gezin
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded bg-gray-100 dark:bg-gray-800 px-1 py-0.5 font-mono">↵</kbd>
                  Git
                </span>
              </div>
              <span className="text-[10px] text-gray-300 dark:text-gray-700">{flatFiltered.length} sonuç</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
