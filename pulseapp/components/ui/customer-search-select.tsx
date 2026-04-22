'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { Search, ChevronDown, X, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/lib/hooks/use-debounce'

interface SimpleCustomer {
  id: string
  name: string
  phone: string
  waitlistPosition?: number
}

interface CustomerSearchSelectProps {
  value: string
  onChange: (id: string) => void
  businessId: string
  placeholder?: string
  disabled?: boolean
  className?: string
  onCustomerSelect?: (customer: SimpleCustomer | null) => void
  /** Varsayılan olarak bekleme listesi modu ile açılır. */
  preferWaitlist?: boolean
  /** "Bekleme Listesi" / "Tüm Danışanlar" sekme geçişi göster. */
  allowWaitlistToggle?: boolean
}

type Mode = 'waitlist' | 'all'

export function CustomerSearchSelect({
  value,
  onChange,
  businessId,
  placeholder = 'Müşteri seçin...',
  disabled,
  className,
  onCustomerSelect,
  preferWaitlist = false,
  allowWaitlistToggle = false,
}: CustomerSearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [results, setResults] = useState<SimpleCustomer[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<SimpleCustomer | null>(null)
  const [mode, setMode] = useState<Mode>(preferWaitlist ? 'waitlist' : 'all')
  const containerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const initialFetchDone = useRef(false)
  // Bekleme listesi için sunucudan bir kez çek, keystroke'larda local filtre
  const waitlistCacheRef = useRef<SimpleCustomer[] | null>(null)

  // Dışarı tıklama ve ESC ile kapat; kapanışta bekleme listesi cache'ini temizle
  useEffect(() => {
    if (!open) {
      waitlistCacheRef.current = null
      return
    }
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const fetchCustomers = useCallback(async (q: string, selectedId?: string) => {
    if (!businessId) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    try {
      if (mode === 'waitlist') {
        let mapped = waitlistCacheRef.current
        if (!mapped) {
          const res = await fetch(`/api/waitlist?active=true`, { signal: controller.signal })
          if (!res.ok) throw new Error()
          const data = await res.json()
          type WaitlistEntry = {
            customer_id: string | null
            customer_name: string
            customer_phone: string
            created_at: string
          }
          const entries: WaitlistEntry[] = data.entries || []
          const sorted = [...entries].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
          const seen = new Set<string>()
          mapped = []
          sorted.forEach((e, idx) => {
            const key = e.customer_id || `${e.customer_name}|${e.customer_phone}`
            if (seen.has(key)) return
            seen.add(key)
            // Kayıtlı müşteri değilse (henüz customer oluşturulmamış) picker'da gösterme
            if (!e.customer_id) return
            mapped!.push({
              id: e.customer_id,
              name: e.customer_name,
              phone: e.customer_phone,
              waitlistPosition: idx + 1,
            })
          })
          waitlistCacheRef.current = mapped
        }
        const filtered = q
          ? mapped.filter(
              (c) =>
                c.name.toLowerCase().includes(q.toLowerCase()) ||
                c.phone.includes(q)
            )
          : mapped
        setResults(filtered)
      } else {
        const params = new URLSearchParams({ businessId })
        if (q) params.set('q', q)
        if (selectedId) params.set('selectedId', selectedId)

        const res = await fetch(`/api/customers/search?${params}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        setResults(data.customers || [])
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') setResults([])
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [businessId, mode])

  // Debounce'lu arama tetikle
  useEffect(() => {
    if (!open) return
    fetchCustomers(debouncedSearch)
  }, [debouncedSearch, open, fetchCustomers])

  useEffect(() => {
    if (!value || !businessId || initialFetchDone.current) return
    initialFetchDone.current = true

    const loadSelected = async () => {
      try {
        const params = new URLSearchParams({ businessId, selectedId: value, limit: '1' })
        const res = await fetch(`/api/customers/search?${params}`)
        if (!res.ok) return
        const data = await res.json()
        const found = data.customers?.find((c: SimpleCustomer) => c.id === value)
        if (found) {
          setSelectedCustomer(found)
          onCustomerSelect?.(found)
        }
      } catch {}
    }
    loadSelected()
  }, [value, businessId, onCustomerSelect])

  // value dışarıdan temizlenirse
  useEffect(() => {
    if (!value && selectedCustomer) {
      setSelectedCustomer(null)
      initialFetchDone.current = false
    }
  }, [value, selectedCustomer])

  const handleSelect = (customer: SimpleCustomer) => {
    setSelectedCustomer(customer)
    onChange(customer.id)
    onCustomerSelect?.(customer)
    setOpen(false)
    setSearch('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedCustomer(null)
    onChange('')
    onCustomerSelect?.(null)
    initialFetchDone.current = false
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setOpen(v => !v)
          if (!open) setTimeout(() => inputRef.current?.focus(), 50)
        }}
        className={cn(
          'input w-full flex items-center justify-between gap-2 text-left',
          !selectedCustomer && 'text-gray-400 dark:text-gray-500',
          disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
        )}
      >
        <span className="truncate">
          {selectedCustomer
            ? `${selectedCustomer.name} — ${selectedCustomer.phone}`
            : placeholder}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {value && selectedCustomer && (
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <X className="h-3.5 w-3.5 text-gray-400" />
            </span>
          )}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-gray-400 transition-transform duration-150',
              open && 'rotate-180'
            )}
          />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-[70] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl overflow-hidden modal-content">
          <CommandPrimitive shouldFilter={false}>
            {/* Mod Toggle (opsiyonel) */}
            {allowWaitlistToggle && (
              <div className="flex border-b border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setMode('waitlist')}
                  className={cn(
                    'flex-1 px-3 py-2 text-xs font-medium transition-colors',
                    mode === 'waitlist'
                      ? 'text-pulse-900 dark:text-pulse-300 border-b-2 border-pulse-900 dark:border-pulse-300 bg-pulse-50/50 dark:bg-pulse-900/20'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  )}
                >
                  Bekleme Listesi
                </button>
                <button
                  type="button"
                  onClick={() => setMode('all')}
                  className={cn(
                    'flex-1 px-3 py-2 text-xs font-medium transition-colors',
                    mode === 'all'
                      ? 'text-pulse-900 dark:text-pulse-300 border-b-2 border-pulse-900 dark:border-pulse-300 bg-pulse-50/50 dark:bg-pulse-900/20'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  )}
                >
                  Tüm Danışanlar
                </button>
              </div>
            )}

            {/* Arama inputu */}
            <div className="p-2 border-b border-gray-100 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <CommandPrimitive.Input
                  ref={inputRef}
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Ad veya telefon ile ara..."
                  className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-1 focus:ring-pulse-900 dark:text-gray-100 placeholder:text-gray-400"
                />
              </div>
            </div>

            <CommandPrimitive.List className="max-h-52 overflow-y-auto py-1">
              {/* Loading */}
              {loading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-400">Aranıyor...</span>
                </div>
              )}

              {/* Sonuç yok */}
              {!loading && results.length === 0 && (
                <div className="py-4 text-center text-sm text-gray-400 px-3">
                  {mode === 'waitlist'
                    ? (search
                        ? 'Bekleme listesinde sonuç yok'
                        : allowWaitlistToggle
                          ? 'Bekleme listesi boş — "Tüm Danışanlar" sekmesine geçebilirsiniz'
                          : 'Bekleme listesi boş')
                    : (search ? 'Sonuç bulunamadı' : 'Henüz müşteri kaydı yok')}
                </div>
              )}

              {/* Başlık */}
              {!loading && results.length > 0 && !search && mode === 'all' && (
                <div className="px-3 py-1.5 text-xs font-medium text-gray-400 dark:text-gray-500">
                  Son Ziyaretler
                </div>
              )}
              {!loading && results.length > 0 && mode === 'waitlist' && (
                <div className="px-3 py-1.5 text-xs font-medium text-gray-400 dark:text-gray-500">
                  Bekleme Sırası
                </div>
              )}

              {/* Sonuçlar */}
              {!loading && results.map(c => (
                <CommandPrimitive.Item
                  key={c.id}
                  value={c.id}
                  onSelect={() => handleSelect(c)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between gap-2 cursor-pointer',
                    'data-[selected=true]:bg-gray-100 dark:data-[selected=true]:bg-gray-700',
                    value === c.id
                      ? 'bg-pulse-50 text-pulse-900 dark:bg-pulse-900/30 dark:text-pulse-300 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {c.waitlistPosition !== undefined && (
                      <span className="flex-shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-full bg-pulse-900/10 text-pulse-900 dark:bg-pulse-300/20 dark:text-pulse-300 text-[10px] font-semibold">
                        {c.waitlistPosition}
                      </span>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="truncate font-medium">{c.name}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{c.phone}</span>
                    </div>
                  </div>
                  {value === c.id && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                </CommandPrimitive.Item>
              ))}
            </CommandPrimitive.List>
          </CommandPrimitive>
        </div>
      )}
    </div>
  )
}
