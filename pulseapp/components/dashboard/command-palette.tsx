'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Calendar, Users, MessageSquare, BarChart3,
  Star, Package, Receipt, Wallet, Settings, Scissors,
  ClipboardList, FolderOpen, Bell, Search, ArrowRight,
  User, Clock, CheckCircle, XCircle, AlertCircle, ChevronDown,
  Loader2, Phone, CreditCard,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { formatCurrency } from '@/lib/utils'
import { STATUS_LABELS, canView } from '@/types'
import type { AppointmentStatus, InvoiceStatus, StaffPermissions } from '@/types'

// ── Sayfa listesi ──────────────────────────────────────────────
// permKey: bu sayfayı görebilmek için gereken izin. null = herkese açık (Bildirimler, Ayarlar-ana vb.)
interface PageItem {
  id: string
  label: string
  icon: React.ReactNode
  href: string
  permKey: keyof StaffPermissions | null
}

const PAGES: PageItem[] = [
  { id: 'dashboard', label: 'Genel Bakış', icon: <LayoutDashboard className="h-4 w-4" />, href: '/dashboard', permKey: 'dashboard' },
  { id: 'appointments', label: 'Randevular', icon: <Calendar className="h-4 w-4" />, href: '/dashboard/appointments', permKey: 'appointments' },
  { id: 'customers', label: 'Müşteriler', icon: <Users className="h-4 w-4" />, href: '/dashboard/customers', permKey: 'customers' },
  { id: 'messages', label: 'Mesajlar', icon: <MessageSquare className="h-4 w-4" />, href: '/dashboard/messages', permKey: 'messages' },
  { id: 'analytics', label: 'Gelir-Gider', icon: <BarChart3 className="h-4 w-4" />, href: '/dashboard/analytics', permKey: 'analytics' },
  { id: 'reviews', label: 'Yorumlar', icon: <Star className="h-4 w-4" />, href: '/dashboard/reviews', permKey: 'reviews' },
  { id: 'invoices', label: 'Faturalar', icon: <Receipt className="h-4 w-4" />, href: '/dashboard/invoices', permKey: 'invoices' },
  { id: 'pos', label: 'Kasa', icon: <Wallet className="h-4 w-4" />, href: '/dashboard/pos', permKey: 'pos' },
  { id: 'inventory', label: 'Stoklar', icon: <Package className="h-4 w-4" />, href: '/dashboard/inventory', permKey: 'inventory' },
  { id: 'services', label: 'Hizmetler', icon: <Scissors className="h-4 w-4" />, href: '/dashboard/services', permKey: 'services' },
  { id: 'records', label: 'Dosyalar', icon: <FolderOpen className="h-4 w-4" />, href: '/dashboard/records', permKey: 'records' },
  { id: 'notifications', label: 'Bildirimler', icon: <Bell className="h-4 w-4" />, href: '/dashboard/notifications', permKey: null },
  { id: 'audit', label: 'Denetim Kaydı', icon: <ClipboardList className="h-4 w-4" />, href: '/dashboard/audit', permKey: 'audit' },
  { id: 'settings', label: 'Ayarlar', icon: <Settings className="h-4 w-4" />, href: '/dashboard/settings/business', permKey: null },
]

// permKey null = herkese açık sayfa; aksi halde sidebar ile aynı mantık (canView: loading=permissive).
function pageVisible(permissions: StaffPermissions | null, key: keyof StaffPermissions | null): boolean {
  if (key === null) return true
  return canView(permissions, key)
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  confirmed:  <CheckCircle className="h-3 w-3 text-blue-500" />,
  completed:  <CheckCircle className="h-3 w-3 text-green-500" />,
  pending:    <Clock className="h-3 w-3 text-amber-500" />,
  cancelled:  <XCircle className="h-3 w-3 text-red-400" />,
  no_show:    <AlertCircle className="h-3 w-3 text-gray-400" />,
}
const INVOICE_STATUS_TR: Record<InvoiceStatus, string> = {
  paid: 'Ödendi', pending: 'Bekliyor', partial: 'Kısmi', overdue: 'Vadesi Geçmiş', cancelled: 'İptal',
}
const INVOICE_STATUS_COLOR: Record<string, string> = {
  paid: 'text-green-600 dark:text-green-400',
  pending: 'text-amber-600 dark:text-amber-400',
  partial: 'text-blue-600 dark:text-blue-400',
  overdue: 'text-red-600 dark:text-red-400',
  cancelled: 'text-gray-400',
}

interface SearchResult {
  id: string
  group: 'Sayfalar' | 'Müşteriler' | 'Randevular' | 'Faturalar'
  label: string
  sub1?: string
  sub2?: string
  icon: React.ReactNode
  badge?: React.ReactNode
  href: string
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const { businessId, permissions } = useBusinessContext()
  const supabase = createClient()
  // Kullanıcının erişebildiği sayfalar — yetkisi olmayan modüller arama sonuçlarında hiç görünmez
  const visiblePages = useMemo(
    () => PAGES.filter(p => pageVisible(permissions, p.permKey)),
    [permissions]
  )
  const canSearchCustomers = canView(permissions, 'customers')
  const canSearchAppointments = canView(permissions, 'appointments')
  const canSearchInvoices = canView(permissions, 'invoices')
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Arama ──────────────────────────────────────────────────────
  const search = useCallback(async (q: string) => {
    const trimmed = q.trim()

    // Boş sorgu → yalnızca yetkili sayfaların listesi
    if (!trimmed) {
      setResults(visiblePages.map(p => ({
        id: p.id, label: p.label, icon: p.icon, href: p.href,
        group: 'Sayfalar' as const,
      })))
      setLoading(false)
      return
    }

    // Sayfa filtrele (anlık, yetki bazlı)
    const pageMatches: SearchResult[] = visiblePages
      .filter(p => p.label.toLowerCase().includes(trimmed.toLowerCase()))
      .map(p => ({
        id: p.id, label: p.label, icon: p.icon, href: p.href,
        group: 'Sayfalar' as const,
      }))

    setResults(pageMatches)

    if (!businessId) return
    setLoading(true)

    const lower = trimmed.toLowerCase()

    // Yetkisi olmayan kaynaklar için sorgu hiç atılmaz
    const [customersRes, appointmentsRes, invoicesRes] = await Promise.all([
      canSearchCustomers
        ? supabase
            .from('customers')
            .select('id, name, phone, segment')
            .eq('business_id', businessId)
            .eq('is_active', true)
            .or(`name.ilike.%${lower}%,phone.ilike.%${lower}%`)
            .limit(5)
        : Promise.resolve({ data: [] as any[] }),

      canSearchAppointments
        ? supabase
            .from('appointments')
            .select('id, start_time, service_name, status, customers!inner(name, phone)')
            .eq('business_id', businessId)
            .is('deleted_at', null)
            .or(`service_name.ilike.%${lower}%,customers.name.ilike.%${lower}%`)
            .order('start_time', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] as any[] }),

      canSearchInvoices
        ? supabase
            .from('invoices')
            .select('id, invoice_number, total, status, customers(name)')
            .eq('business_id', businessId)
            .or(`invoice_number.ilike.%${lower}%`)
            .order('created_at', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const customerResults: SearchResult[] = (customersRes.data || []).map(c => ({
      id: `customer-${c.id}`,
      group: 'Müşteriler' as const,
      label: c.name,
      sub1: c.phone || '',
      sub2: c.segment === 'vip' ? 'VIP' : c.segment === 'risk' ? 'Riskli' : c.segment === 'regular' ? 'Düzenli' : 'Yeni',
      icon: <User className="h-4 w-4" />,
      badge: c.phone ? (
        <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
          <Phone className="h-2.5 w-2.5" />{c.phone}
        </span>
      ) : undefined,
      href: `/dashboard/customers?search=${encodeURIComponent(c.name)}`,
    }))

    const appointmentResults: SearchResult[] = (appointmentsRes.data || []).map(a => {
      const cust = (Array.isArray(a.customers) ? a.customers[0] : a.customers) as { name: string; phone: string } | null
      const dt = new Date(a.start_time)
      const dateStr = dt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
      const timeStr = dt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      return {
        id: `appointment-${a.id}`,
        group: 'Randevular' as const,
        label: cust?.name || 'Müşterisiz',
        sub1: a.service_name || '',
        sub2: `${dateStr} ${timeStr}`,
        icon: <Calendar className="h-4 w-4" />,
        badge: (
          <span className="flex items-center gap-1 text-[10px]">
            {STATUS_ICON[a.status]}
            <span className="text-gray-500 dark:text-gray-400">{STATUS_LABELS[a.status as AppointmentStatus] || a.status}</span>
          </span>
        ),
        href: `/dashboard/appointments?date=${dt.toISOString().split('T')[0]}`,
      }
    })

    const invoiceResults: SearchResult[] = (invoicesRes.data || []).map(inv => {
      const cust = (Array.isArray(inv.customers) ? inv.customers[0] : inv.customers) as { name: string } | null
      return {
        id: `invoice-${inv.id}`,
        group: 'Faturalar' as const,
        label: inv.invoice_number,
        sub1: cust?.name || 'Müşterisiz',
        sub2: formatCurrency(inv.total),
        icon: <Receipt className="h-4 w-4" />,
        badge: (
          <span className={`text-[10px] font-medium ${INVOICE_STATUS_COLOR[inv.status as InvoiceStatus] || 'text-gray-400'}`}>
            {INVOICE_STATUS_TR[inv.status as InvoiceStatus] || inv.status}
          </span>
        ),
        href: `/dashboard/invoices`,
      }
    })

    setResults([...pageMatches, ...customerResults, ...appointmentResults, ...invoiceResults])
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, canSearchCustomers, canSearchAppointments, canSearchInvoices, visiblePages])

  // Debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!open) return
    if (!query.trim()) {
      search('')
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, open, search])

  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  useEffect(() => {
    if (!open) { setQuery(''); setSelectedIndex(0); setResults([]) }
    else { search('') }
  }, [open, search])

  // Klavye
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => {
          const next = Math.min(i + 1, results.length - 1)
          scrollToItem(next)
          return next
        })
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => {
          const next = Math.max(i - 1, 0)
          scrollToItem(next)
          return next
        })
      }
      if (e.key === 'Enter' && results[selectedIndex]) {
        router.push(results[selectedIndex].href)
        onClose()
        setQuery('')
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, results, selectedIndex, router, onClose])

  function scrollToItem(idx: number) {
    const el = listRef.current?.querySelector(`[data-idx="${idx}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }

  // Grupla
  const grouped: Record<string, SearchResult[]> = {}
  for (const r of results) {
    if (!grouped[r.group]) grouped[r.group] = []
    grouped[r.group].push(r)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              className="pointer-events-auto w-full max-w-xl overflow-hidden rounded-2xl
                         bg-white dark:bg-gray-900
                         shadow-2xl shadow-black/25 dark:shadow-black/60
                         border border-gray-200 dark:border-white/10"
            >
              {/* Input */}
              <div className="flex items-center gap-3 border-b border-gray-100 dark:border-white/10 px-4 py-3.5">
                {loading
                  ? <Loader2 className="h-4 w-4 flex-shrink-0 text-pulse-900 animate-spin" />
                  : <Search className="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                }
                <input
                  ref={inputRef}
                  autoFocus
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Müşteri, randevu, fatura veya sayfa ara..."
                  className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100
                             placeholder-gray-400 dark:placeholder-gray-600 outline-none"
                />
                <kbd className="hidden sm:flex items-center rounded border border-gray-200 dark:border-gray-700
                                bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-mono
                                text-gray-400 dark:text-gray-600">
                  ESC
                </kbd>
              </div>

              {/* Sonuçlar */}
              <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
                {results.length === 0 && !loading ? (
                  <div className="px-4 py-10 text-center">
                    <Search className="h-8 w-8 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
                    <p className="text-sm text-gray-400 dark:text-gray-600">Sonuç bulunamadı</p>
                  </div>
                ) : (
                  Object.entries(grouped).map(([group, items]) => (
                    <div key={group}>
                      {/* Grup başlığı */}
                      <div className="flex items-center gap-2 px-4 py-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-600">
                          {group}
                        </span>
                        <span className="text-[10px] text-gray-300 dark:text-gray-700">({items.length})</span>
                      </div>

                      {items.map(item => {
                        const globalIdx = results.findIndex(r => r.id === item.id)
                        const isSelected = globalIdx === selectedIndex
                        return (
                          <button
                            key={item.id}
                            data-idx={globalIdx}
                            onClick={() => { router.push(item.href); onClose(); setQuery('') }}
                            onMouseEnter={() => setSelectedIndex(globalIdx)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                              isSelected
                                ? 'bg-pulse-50 dark:bg-pulse-900/10'
                                : 'hover:bg-gray-50 dark:hover:bg-white/5'
                            }`}
                          >
                            {/* İkon */}
                            <span className={`flex-shrink-0 p-1.5 rounded-lg ${
                              isSelected
                                ? 'bg-pulse-100 dark:bg-pulse-900/40 text-pulse-900 dark:text-pulse-400'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
                            }`}>
                              {item.icon}
                            </span>

                            {/* İçerik */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium truncate ${
                                  isSelected ? 'text-pulse-900 dark:text-pulse-300' : 'text-gray-900 dark:text-gray-100'
                                }`}>
                                  {item.label}
                                </span>
                                {item.badge}
                              </div>
                              {(item.sub1 || item.sub2) && (
                                <div className="flex items-center gap-2 mt-0.5">
                                  {item.sub1 && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.sub1}</span>
                                  )}
                                  {item.sub1 && item.sub2 && (
                                    <span className="text-gray-300 dark:text-gray-700 text-xs">·</span>
                                  )}
                                  {item.sub2 && (
                                    <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{item.sub2}</span>
                                  )}
                                </div>
                              )}
                            </div>

                            {isSelected && <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-pulse-900" />}
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
                  <span className="flex items-center gap-1">
                    <kbd className="rounded bg-gray-100 dark:bg-gray-800 px-1 py-0.5 font-mono">ESC</kbd>
                    Kapat
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-300 dark:text-gray-700">
                  <CreditCard className="h-3 w-3" />
                  <ChevronDown className="h-3 w-3" />
                  Müşteri · Randevu · Fatura
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
