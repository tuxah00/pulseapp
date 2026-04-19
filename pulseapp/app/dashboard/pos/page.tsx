'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { getCustomerLabelSingular } from '@/lib/config/sector-modules'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { requirePermission } from '@/lib/hooks/use-require-permission'
import { logAudit } from '@/lib/utils/audit'
import { formatCurrency, formatDateTime, cn, formatDateISO } from '@/lib/utils'
import type { Service, POSItem, POSPayment, POSTransaction, POSSession, PaymentMethod, Referral, RewardType } from '@/types'
import { REWARD_TYPE_LABELS } from '@/types'
import { CustomSelect } from '@/components/ui/custom-select'
import { CustomerSearchSelect } from '@/components/ui/customer-search-select'
import { Portal } from '@/components/ui/portal'
import {
  Loader2, Search, Plus, Minus, Trash2, X, Wallet,
  CreditCard, Banknote, ArrowRightLeft, ShoppingBag,
  Scissors, Package, User, Clock, Receipt,
  DoorOpen, DoorClosed, ChevronDown, ShieldX, Gift,
} from 'lucide-react'

interface Product {
  id: string
  name: string
  price: number | null
  stock_count: number
  category: string | null
  is_active: boolean
}

interface ServicePackage {
  id: string
  name: string
  service_id: string | null
  sessions_total: number
  price: number
  is_active: boolean
}

interface CartItem extends POSItem {
  _key: string
}

const PAYMENT_METHODS: { key: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { key: 'cash', label: 'Nakit', icon: <Banknote className="h-4 w-4" /> },
  { key: 'card', label: 'Kart', icon: <CreditCard className="h-4 w-4" /> },
  { key: 'transfer', label: 'Havale', icon: <ArrowRightLeft className="h-4 w-4" /> },
]

function showToast(title: string, body?: string) {
  window.dispatchEvent(new CustomEvent('pulse-toast', {
    detail: { type: 'system', title, body: body || null, related_id: null, related_type: null, created_at: Date.now() }
  }))
}

export default function KasaPage() {
  const { businessId, staffId, staffName, staffRole, sector, permissions } = useBusinessContext()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const { confirm } = useConfirm()
  const searchParams = useSearchParams()
  const appointmentId = searchParams.get('appointmentId')

  // Data
  const [services, setServices] = useState<Service[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [packages, setPackages] = useState<ServicePackage[]>([])
  const [transactions, setTransactions] = useState<POSTransaction[]>([])
  const [session, setSession] = useState<POSSession | null>(null)
  const [loading, setLoading] = useState(true)

  // Cart
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [linkedAppointmentId, setLinkedAppointmentId] = useState<string | null>(appointmentId)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('fixed')
  const [taxRate, setTaxRate] = useState(0)

  // Referral rewards
  const [availableRewards, setAvailableRewards] = useState<Referral[]>([])
  const [appliedReferralId, setAppliedReferralId] = useState<string | null>(null)
  const [freeServiceItemKey, setFreeServiceItemKey] = useState<string | null>(null)

  // Sadakat puanı
  const [loyaltyBalance, setLoyaltyBalance] = useState(0)
  const [loyaltyRedemptionRate, setLoyaltyRedemptionRate] = useState(10)
  const [loyaltyPointsInput, setLoyaltyPointsInput] = useState('')
  const [loyaltyDiscountApplied, setLoyaltyDiscountApplied] = useState(0)
  const [appliedLoyaltyPoints, setAppliedLoyaltyPoints] = useState(0)

  // Payment
  const [paymentRows, setPaymentRows] = useState<POSPayment[]>([])
  const [processing, setProcessing] = useState(false)

  // UI
  const [itemTab, setItemTab] = useState<'services' | 'products' | 'packages'>('services')
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)

  // Session modal
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [isClosingSessionModal, setIsClosingSessionModal] = useState(false)
  const closeSessionModal = () => setIsClosingSessionModal(true)
  const [openingCash, setOpeningCash] = useState('')
  const [closingCash, setClosingCash] = useState('')
  const [closingNote, setClosingNote] = useState('')

  // ── Veri yükleme ──
  const fetchData = useCallback(async () => {
    if (!businessId) return
    setLoading(true)

    const [svcRes, prodRes, pkgRes, txRes, sessRes] = await Promise.all([
      supabase.from('services').select('*').eq('business_id', businessId).eq('is_active', true).order('sort_order'),
      supabase.from('products').select('id, name, price, stock_count, category, is_active').eq('business_id', businessId).eq('is_active', true).order('name'),
      supabase.from('service_packages').select('id, name, service_id, sessions_total, price, is_active').eq('business_id', businessId).eq('is_active', true).order('sort_order'),
      fetch(`/api/pos?businessId=${businessId}&from=${formatDateISO(new Date())}`).then(r => r.json()),
      fetch(`/api/pos/sessions?businessId=${businessId}`).then(r => r.json()),
    ])

    setServices(svcRes.data || [])
    setProducts(prodRes.data || [])
    setPackages(pkgRes.data || [])
    setTransactions(txRes.transactions || [])
    setSession(sessRes.openSession || null)
    setLoading(false)
  }, [businessId])

  useEffect(() => { fetchData() }, [fetchData])

  // Randevudan geldiyse otomatik doldur
  useEffect(() => {
    if (!appointmentId || !businessId || services.length === 0) return
    const loadAppointment = async () => {
      const { data: apt } = await supabase
        .from('appointments')
        .select('id, customer_id, service_id, services(name, price)')
        .eq('id', appointmentId)
        .single()

      if (apt) {
        if (apt.customer_id) setSelectedCustomerId(apt.customer_id)
        const svc = apt.services as unknown as { name: string; price: number | null } | null
        if (svc && svc.price) {
          addToCart({
            id: apt.service_id || crypto.randomUUID(),
            name: svc.name,
            type: 'service',
            quantity: 1,
            unit_price: svc.price,
            total: svc.price,
            service_id: apt.service_id || undefined,
          })
        }
      }
    }
    loadAppointment()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId, businessId, services.length])

  // Referans ödülü: müşteri seçildiğinde kullanılabilir ödüller
  useEffect(() => {
    if (!selectedCustomerId || !businessId) {
      setAvailableRewards([])
      setAppliedReferralId(null)
      setFreeServiceItemKey(null)
      setLoyaltyBalance(0)
      setLoyaltyPointsInput('')
      setLoyaltyDiscountApplied(0)
      setAppliedLoyaltyPoints(0)
      return
    }
    const fetchRewards = async () => {
      try {
        const res = await fetch(`/api/referrals?businessId=${businessId}&referrerId=${selectedCustomerId}&status=pending`)
        const json = await res.json()
        const rewards = (json.referrals || []).filter((r: Referral) => r.reward_type && r.reward_value)
        setAvailableRewards(rewards)
      } catch { /* ignore */ }
    }
    const fetchLoyalty = async () => {
      try {
        const res = await fetch(`/api/loyalty?customerId=${selectedCustomerId}`)
        if (!res.ok) return
        const json = await res.json()
        setLoyaltyBalance(json.loyalty?.points_balance ?? 0)
        setLoyaltyRedemptionRate(json.redemptionRate ?? 10)
      } catch { /* ignore */ }
    }
    fetchRewards()
    fetchLoyalty()
  }, [selectedCustomerId, businessId])

  // ── Cart Hesaplamaları ──
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.total, 0), [cart])
  const discountCalc = useMemo(() => {
    if (discountType === 'percentage') return Math.round(subtotal * (discountAmount / 100) * 100) / 100
    return discountAmount
  }, [subtotal, discountAmount, discountType])
  const afterDiscount = subtotal - discountCalc
  const taxCalc = useMemo(() => Math.round(afterDiscount * (taxRate / 100) * 100) / 100, [afterDiscount, taxRate])
  const grandTotal = afterDiscount + taxCalc
  const paidTotal = useMemo(() => paymentRows.reduce((sum, p) => sum + p.amount, 0), [paymentRows])
  const remaining = Math.max(0, Math.round((grandTotal - paidTotal) * 100) / 100)

  // ── Cart İşlemleri ──
  function addToCart(item: Omit<CartItem, '_key'>) {
    const existing = cart.find(c => c.id === item.id && c.type === item.type)
    if (existing) {
      setCart(prev => prev.map(c =>
        c._key === existing._key
          ? { ...c, quantity: c.quantity + 1, total: (c.quantity + 1) * c.unit_price }
          : c
      ))
    } else {
      setCart(prev => [...prev, { ...item, _key: crypto.randomUUID() }])
    }
  }

  function updateQuantity(key: string, delta: number) {
    setCart(prev => prev.map(c => {
      if (c._key !== key) return c
      const newQty = Math.max(1, c.quantity + delta)
      return { ...c, quantity: newQty, total: newQty * c.unit_price }
    }))
  }

  function removeFromCart(key: string) {
    setCart(prev => prev.filter(c => c._key !== key))
  }

  function clearCart() {
    setCart([])
    setSelectedCustomerId(null)
    setLinkedAppointmentId(null)
    setDiscountAmount(0)
    setDiscountType('fixed')
    setTaxRate(0)
    setPaymentRows([])
    setAppliedReferralId(null)
    setAvailableRewards([])
    setFreeServiceItemKey(null)
    setLoyaltyBalance(0)
    setLoyaltyPointsInput('')
    setLoyaltyDiscountApplied(0)
    setAppliedLoyaltyPoints(0)
  }

  // ── Referans Ödülü ──
  function applyReferralReward(ref: Referral) {
    if (!ref.reward_type || ref.reward_value == null) return

    switch (ref.reward_type) {
      case 'discount_percent':
        setDiscountType('percentage')
        setDiscountAmount(ref.reward_value)
        break
      case 'discount_amount':
        setDiscountType('fixed')
        setDiscountAmount(ref.reward_value)
        break
      case 'free_service':
        // For free_service, user picks which cart item to zero out
        // We'll show a selector in the UI
        break
      case 'points':
        // Convert points to fixed discount (1 point = 1₺)
        setDiscountType('fixed')
        setDiscountAmount(ref.reward_value)
        break
    }
    setAppliedReferralId(ref.id)
  }

  function applyFreeService(itemKey: string) {
    setFreeServiceItemKey(itemKey)
    setCart(prev => prev.map(c => {
      if (c._key === itemKey) return { ...c, unit_price: 0, total: 0 }
      return c
    }))
  }

  function removeReferralReward() {
    if (freeServiceItemKey) {
      // Restore original price of the free service item
      const originalItem = services.find(s => cart.find(c => c._key === freeServiceItemKey && c.service_id === s.id))
      if (originalItem && originalItem.price) {
        setCart(prev => prev.map(c => {
          if (c._key === freeServiceItemKey) return { ...c, unit_price: originalItem.price!, total: originalItem.price! * c.quantity }
          return c
        }))
      }
      setFreeServiceItemKey(null)
    } else {
      setDiscountAmount(0)
      setDiscountType('fixed')
    }
    setAppliedReferralId(null)
  }

  // ── Sadakat Puanı ──
  function applyLoyaltyPoints() {
    const pts = parseInt(loyaltyPointsInput, 10)
    if (!pts || pts <= 0 || pts > loyaltyBalance) return
    const discountTL = Math.floor(pts / loyaltyRedemptionRate)
    if (discountTL <= 0) return
    setAppliedLoyaltyPoints(pts)
    setLoyaltyDiscountApplied(discountTL)
    setDiscountAmount(prev => prev + discountTL)
    setDiscountType('fixed')
    setLoyaltyPointsInput('')
  }

  function removeLoyaltyPoints() {
    setDiscountAmount(prev => Math.max(0, prev - loyaltyDiscountApplied))
    setAppliedLoyaltyPoints(0)
    setLoyaltyDiscountApplied(0)
  }

  // ── Ödeme ──
  function addPaymentRow(method: PaymentMethod) {
    const existingIdx = paymentRows.findIndex(p => p.method === method)
    if (existingIdx >= 0) {
      // Var olan satırın tutarını artır
      if (remaining > 0) {
        setPaymentRows(prev => prev.map((p, i) =>
          i === existingIdx ? { ...p, amount: p.amount + remaining } : p
        ))
      }
    } else if (remaining <= 0 && paymentRows.length === 1) {
      // Tek satır varsa ve kalan 0 ise → yöntemi değiştir (hızlı geçiş)
      setPaymentRows([{ method, amount: paymentRows[0].amount }])
    } else {
      setPaymentRows(prev => [...prev, { method, amount: remaining }])
    }
  }

  function updatePaymentAmount(index: number, amount: number) {
    setPaymentRows(prev => prev.map((p, i) => i === index ? { ...p, amount } : p))
  }

  function removePaymentRow(index: number) {
    setPaymentRows(prev => prev.filter((_, i) => i !== index))
  }

  async function handleCheckout() {
    if (cart.length === 0 || remaining > 0.01) return
    if (cartHasPackage && !selectedCustomerId) {
      showToast('Müşteri Gerekli', 'Paket satışı için müşteri seçilmelidir.')
      return
    }
    setProcessing(true)

    try {
      const res = await fetch('/api/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          customer_id: selectedCustomerId,
          appointment_id: linkedAppointmentId,
          staff_id: staffId,
          items: cart.map(({ _key, ...rest }) => rest),
          discount_amount: discountAmount,
          discount_type: discountCalc > 0 ? discountType : undefined,
          tax_rate: taxRate,
          payments: paymentRows,
          transaction_type: 'sale',
          referral_id: appliedReferralId,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'İşlem başarısız')

      await logAudit({
        businessId: businessId!,
        staffId: staffId!,
        staffName: staffName || '',
        action: 'create',
        resource: 'pos_transaction',
        resourceId: data.transaction.id,
        details: { total: grandTotal, receipt: data.transaction.receipt_number },
      })

      // Paket satışı varsa customer_packages kayıtlarını oluştur
      const packageItems = cart.filter(c => c.type === 'package')
      if (packageItems.length > 0 && selectedCustomerId) {
        for (const pkgItem of packageItems) {
          for (let i = 0; i < pkgItem.quantity; i++) {
            try {
              await fetch('/api/customer-packages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  business_id: businessId,
                  package_id: pkgItem.package_id,
                  customer_id: selectedCustomerId,
                  package_name: pkgItem.name,
                  service_id: pkgItem.service_id || null,
                  sessions_total: pkgItem.sessions_total || 1,
                  price_paid: pkgItem.unit_price,
                  staff_id: staffId,
                  invoice_id: data.transaction.invoice_id || null,
                }),
              })
            } catch { /* ignore — tek paket hatası işlemi bozmasın */ }
          }
        }
      }

      // Referans ödülü kullanıldıysa otomatik olarak 'rewarded' işaretle
      if (appliedReferralId) {
        await fetch('/api/referrals', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId, id: appliedReferralId, status: 'rewarded' }),
        })
      }

      // Sadakat puanı kullanıldıysa düş
      if (appliedLoyaltyPoints > 0 && selectedCustomerId) {
        await fetch('/api/loyalty', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: selectedCustomerId,
            points: appliedLoyaltyPoints,
            description: `Kasa işlemi — ${loyaltyDiscountApplied}₺ indirim`,
          }),
        })
      }

      // Listeyi güncelle ve sepeti temizle
      setTransactions(prev => [data.transaction, ...prev])
      clearCart()
      showToast('İşlem Tamamlandı')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
      showToast('Hata', message)
    } finally {
      setProcessing(false)
    }
  }

  // ── Kasa Oturumu ──
  async function openSession() {
    const cash = parseFloat(openingCash) || 0
    const res = await fetch('/api/pos/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: businessId, staff_id: staffId, opening_cash: cash }),
    })
    const data = await res.json()
    if (res.ok) {
      setSession(data.session)
      setShowSessionModal(false)
      setOpeningCash('')
      showToast('Kasa Açıldı')
    } else {
      showToast('Hata', data.error || 'Kasa açılamadı')
    }
  }

  async function closeSession() {
    if (!session) return
    const ok = await confirm({
      title: 'Kasayı Kapat',
      message: 'Günlük kasa oturumunu kapatmak istediğinize emin misiniz?',
      confirmText: 'Kapat',
      variant: 'warning',
    })
    if (!ok) return

    const cash = parseFloat(closingCash) || 0
    const res = await fetch(`/api/pos/sessions?id=${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actual_cash: cash, notes: closingNote || undefined }),
    })
    const data = await res.json()
    if (res.ok) {
      setSession(null)
      setShowSessionModal(false)
      setClosingCash('')
      setClosingNote('')
      showToast('Kasa Kapatıldı')
    } else {
      showToast('Hata', data.error || 'Kasa kapatılamadı')
    }
  }

  // ── Filtreleme ──
  const filteredServices = useMemo(() => {
    if (!debouncedSearch) return services
    const q = debouncedSearch.toLowerCase()
    return services.filter(s => s.name.toLowerCase().includes(q))
  }, [services, debouncedSearch])

  const filteredProducts = useMemo(() => {
    if (!debouncedSearch) return products
    const q = debouncedSearch.toLowerCase()
    return products.filter(p => p.name.toLowerCase().includes(q))
  }, [products, debouncedSearch])

  const filteredPackages = useMemo(() => {
    if (!debouncedSearch) return packages
    const q = debouncedSearch.toLowerCase()
    return packages.filter(p => p.name.toLowerCase().includes(q))
  }, [packages, debouncedSearch])

  const cartHasPackage = useMemo(() => cart.some(c => c.type === 'package'), [cart])

  requirePermission(permissions, 'pos')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-pulse-900" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Wallet className="h-6 w-6 text-pulse-900" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Kasa</h1>
          {session && (
            <span className="badge bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Açık
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!session ? (
            <button onClick={() => { setShowSessionModal(true) }} className="btn-primary flex items-center gap-2">
              <DoorOpen className="h-4 w-4" /> Kasayı Aç
            </button>
          ) : (
            <button onClick={() => { setShowSessionModal(true) }} className="btn-secondary flex items-center gap-2">
              <DoorClosed className="h-4 w-4" /> Kasayı Kapat
            </button>
          )}
        </div>
      </div>

      {/* ── 3 Panel Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* ── SOL: Ürün/Hizmet Seçici ── */}
        <div className="lg:col-span-3 card p-4 space-y-3">
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 overflow-x-auto scrollbar-thin">
            <button
              onClick={() => setItemTab('services')}
              className={cn('flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                itemTab === 'services' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              )}
            >
              <Scissors className="h-3.5 w-3.5" /> Hizmetler
            </button>
            <button
              onClick={() => setItemTab('products')}
              className={cn('flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                itemTab === 'products' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Package className="h-3.5 w-3.5" /> Ürünler
            </button>
            <button
              onClick={() => setItemTab('packages')}
              className={cn('flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                itemTab === 'packages' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Gift className="h-3.5 w-3.5" /> Paketler
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ara..."
              className="input pl-9 w-full"
            />
          </div>

          <div className="max-h-[calc(100vh-320px)] overflow-y-auto space-y-1">
            {itemTab === 'services' ? (
              filteredServices.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Hizmet bulunamadı</p>
              ) : (
                filteredServices.map(svc => (
                  <button
                    key={svc.id}
                    onClick={() => svc.price && addToCart({
                      id: svc.id, name: svc.name, type: 'service',
                      quantity: 1, unit_price: svc.price, total: svc.price,
                      service_id: svc.id,
                    })}
                    disabled={!svc.price}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left disabled:opacity-40"
                  >
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{svc.name}</span>
                    <span className="text-sm text-pulse-900 font-semibold flex-shrink-0 ml-2">
                      {svc.price ? formatCurrency(svc.price) : '—'}
                    </span>
                  </button>
                ))
              )
            ) : itemTab === 'products' ? (
              filteredProducts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Ürün bulunamadı</p>
              ) : (
                filteredProducts.map(prod => (
                  <button
                    key={prod.id}
                    onClick={() => prod.price && addToCart({
                      id: prod.id, name: prod.name, type: 'product',
                      quantity: 1, unit_price: prod.price, total: prod.price,
                      product_id: prod.id,
                    })}
                    disabled={!prod.price || prod.stock_count <= 0}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left disabled:opacity-40"
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate block">{prod.name}</span>
                      <span className="text-xs text-gray-400">Stok: {prod.stock_count}</span>
                    </div>
                    <span className="text-sm text-pulse-900 font-semibold flex-shrink-0 ml-2">
                      {prod.price ? formatCurrency(prod.price) : '—'}
                    </span>
                  </button>
                ))
              )
            ) : (
              filteredPackages.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Paket bulunamadı</p>
              ) : (
                filteredPackages.map(pkg => (
                  <button
                    key={pkg.id}
                    onClick={() => pkg.price && addToCart({
                      id: pkg.id, name: pkg.name, type: 'package',
                      quantity: 1, unit_price: pkg.price, total: pkg.price,
                      package_id: pkg.id,
                      service_id: pkg.service_id || undefined,
                      sessions_total: pkg.sessions_total,
                    })}
                    disabled={!pkg.price}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left disabled:opacity-40"
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate block">{pkg.name}</span>
                      <span className="text-xs text-gray-400">{pkg.sessions_total} seans</span>
                    </div>
                    <span className="text-sm text-pulse-900 font-semibold flex-shrink-0 ml-2">
                      {pkg.price ? formatCurrency(pkg.price) : '—'}
                    </span>
                  </button>
                ))
              )
            )}
          </div>
        </div>

        {/* ── ORTA: Adisyon ── */}
        <div className="lg:col-span-5 card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" /> Adisyon
            </h2>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-sm text-red-500 hover:text-red-600">Temizle</button>
            )}
          </div>

          {/* Müşteri seçimi */}
          <CustomerSearchSelect
            value={selectedCustomerId ?? ''}
            onChange={id => setSelectedCustomerId(id || null)}
            businessId={businessId!}
            placeholder={`${getCustomerLabelSingular(sector ?? undefined)} seç (opsiyonel)...`}
          />

          {/* Referans ödülü banner */}
          {availableRewards.length > 0 && !appliedReferralId && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Referans İndirimi Mevcut</span>
              </div>
              {availableRewards.map(ref => (
                <div key={ref.id} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-md px-3 py-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {ref.reward_value}{ref.reward_type === 'discount_percent' ? '%' : ref.reward_type === 'discount_amount' ? '₺' : ref.reward_type === 'points' ? ' puan' : ''} {REWARD_TYPE_LABELS[ref.reward_type!]}
                  </span>
                  <button
                    onClick={() => applyReferralReward(ref)}
                    className="text-xs px-3 py-1 rounded-md bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                  >
                    İndirimi Uygula
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Uygulanan referans ödülü */}
          {appliedReferralId && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">Referans İndirimi Uygulandı</span>
                </div>
                <button onClick={removeReferralReward} className="text-xs text-red-500 hover:text-red-600">Kaldır</button>
              </div>
              {appliedReferralId && availableRewards.find(r => r.id === appliedReferralId)?.reward_type === 'free_service' && !freeServiceItemKey && cart.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-500">Ücretsiz yapılacak kalemi seçin:</p>
                  {cart.map(item => (
                    <button
                      key={item._key}
                      onClick={() => applyFreeService(item._key)}
                      className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-green-100 dark:hover:bg-green-800/30 text-gray-700 dark:text-gray-300 transition-colors"
                    >
                      {item.name} — {formatCurrency(item.total)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sadakat puan banner */}
          {loyaltyBalance > 0 && selectedCustomerId && (
            appliedLoyaltyPoints > 0 ? (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-300">
                      {appliedLoyaltyPoints.toLocaleString('tr-TR')} puan → -{formatCurrency(loyaltyDiscountApplied)} indirim
                    </span>
                  </div>
                  <button onClick={removeLoyaltyPoints} className="text-xs text-red-500 hover:text-red-600">Kaldır</button>
                </div>
              </div>
            ) : (
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                    {loyaltyBalance.toLocaleString('tr-TR')} puan mevcut
                    <span className="text-xs text-purple-500 dark:text-purple-400 ml-1">
                      (max ≈ {Math.floor(loyaltyBalance / loyaltyRedemptionRate).toLocaleString('tr-TR')}₺ indirim)
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={loyaltyRedemptionRate}
                    max={loyaltyBalance}
                    step={loyaltyRedemptionRate}
                    value={loyaltyPointsInput}
                    onChange={e => setLoyaltyPointsInput(e.target.value)}
                    placeholder={`Puan gir (${loyaltyRedemptionRate} puan = 1₺)`}
                    className="input text-sm flex-1"
                  />
                  <button
                    onClick={applyLoyaltyPoints}
                    disabled={!loyaltyPointsInput || parseInt(loyaltyPointsInput) <= 0 || parseInt(loyaltyPointsInput) > loyaltyBalance}
                    className="text-xs px-3 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 transition-colors whitespace-nowrap"
                  >
                    Uygula
                  </button>
                </div>
              </div>
            )
          )}

          {/* Sepet kalemleri */}
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <ShoppingBag className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">Sepet boş</p>
              <p className="text-xs">Soldan hizmet veya ürün ekleyin</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {cart.map(item => (
                <div key={item._key} className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">
                      {formatCurrency(item.unit_price)} x {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQuantity(item._key, -1)} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item._key, 1)} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 w-20 text-right">
                    {formatCurrency(item.total)}
                  </span>
                  <button onClick={() => removeFromCart(item._key)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* İndirim + KDV */}
          {cart.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 w-16">İndirim</label>
                <div className="flex items-center gap-1 flex-1">
                  <input
                    type="number"
                    min="0"
                    value={discountAmount || ''}
                    onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                    className="input w-24 text-sm"
                    placeholder="0"
                  />
                  <CustomSelect
                    value={discountType}
                    onChange={v => setDiscountType(v as 'percentage' | 'fixed')}
                    options={[
                      { value: 'fixed', label: '₺' },
                      { value: 'percentage', label: '%' },
                    ]}
                  />
                </div>
                {discountCalc > 0 && (
                  <span className="text-sm text-red-500">-{formatCurrency(discountCalc)}</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 w-16">KDV</label>
                <CustomSelect
                  value={String(taxRate)}
                  onChange={v => setTaxRate(Number(v))}
                  options={[
                    { value: '0', label: '%0' },
                    { value: '1', label: '%1' },
                    { value: '10', label: '%10' },
                    { value: '20', label: '%20' },
                  ]}
                />
                {taxCalc > 0 && (
                  <span className="text-sm text-gray-500">+{formatCurrency(taxCalc)}</span>
                )}
              </div>

              {/* Toplamlar */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Ara Toplam</span>
                  <span className="text-gray-700 dark:text-gray-300">{formatCurrency(subtotal)}</span>
                </div>
                {discountCalc > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">İndirim</span>
                    <span className="text-red-500">-{formatCurrency(discountCalc)}</span>
                  </div>
                )}
                {taxCalc > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">KDV (%{taxRate})</span>
                    <span className="text-gray-500">+{formatCurrency(taxCalc)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-1">
                  <span className="text-gray-900 dark:text-gray-100">Toplam</span>
                  <span className="text-pulse-900">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── SAĞ: Ödeme Paneli ── */}
        <div className="lg:col-span-4 card p-4 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Wallet className="h-5 w-5" /> Ödeme
          </h2>

          {/* Toplam */}
          <div className="text-center py-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <p className="text-sm text-gray-500 mb-1">Toplam Tutar</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(grandTotal)}</p>
          </div>

          {/* Ödeme yöntemi butonları */}
          <div className="flex gap-2">
            {PAYMENT_METHODS.map(pm => (
              <button
                key={pm.key}
                onClick={() => addPaymentRow(pm.key)}
                disabled={cart.length === 0}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 text-sm font-medium"
              >
                {pm.icon} {pm.label}
              </button>
            ))}
          </div>

          {/* Ödeme satırları */}
          {paymentRows.length > 0 && (
            <div className="space-y-2">
              {paymentRows.map((row, i) => {
                const pm = PAYMENT_METHODS.find(m => m.key === row.method)
                return (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 w-20">
                      {pm?.icon} {pm?.label}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.amount || ''}
                      onChange={(e) => updatePaymentAmount(i, parseFloat(e.target.value) || 0)}
                      className="input flex-1 text-sm text-right"
                    />
                    <span className="text-sm text-gray-400">₺</span>
                    <button onClick={() => removePaymentRow(i)} className="text-red-400 hover:text-red-600">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}

              {remaining > 0.01 && (
                <div className="flex justify-between text-sm px-1">
                  <span className="text-orange-500 font-medium">Kalan</span>
                  <span className="text-orange-500 font-bold">{formatCurrency(remaining)}</span>
                </div>
              )}
            </div>
          )}

          {/* Tahsilat Al butonu */}
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || remaining > 0.01 || processing}
            className="w-full btn-primary py-3 text-base font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {processing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Receipt className="h-5 w-5" />
            )}
            Tahsilat Al
          </button>
        </div>
      </div>

      {/* ── Bugünün İşlemleri ── */}
      {transactions.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Clock className="h-5 w-5" /> Bugünün İşlemleri
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 font-medium">Saat</th>
                  <th className="pb-2 font-medium">Fiş No</th>
                  <th className="pb-2 font-medium">Müşteri</th>
                  <th className="pb-2 font-medium text-right">Tutar</th>
                  <th className="pb-2 font-medium">Ödeme</th>
                  <th className="pb-2 font-medium">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {transactions.map(tx => {
                  const payments = (tx.payments || []) as POSPayment[]
                  const methodLabels = payments.map(p => {
                    const m = PAYMENT_METHODS.find(pm => pm.key === p.method)
                    return m?.label || p.method
                  }).join(' + ')

                  return (
                    <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2 text-gray-700 dark:text-gray-300">
                        {new Date(tx.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 text-gray-500 font-mono text-xs">{tx.receipt_number}</td>
                      <td className="py-2 text-gray-700 dark:text-gray-300">
                        {tx.customers?.name || '—'}
                      </td>
                      <td className="py-2 text-right font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(tx.total)}
                      </td>
                      <td className="py-2 text-gray-500">{methodLabels}</td>
                      <td className="py-2">
                        <span className={cn('badge text-xs',
                          tx.payment_status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          tx.payment_status === 'partial' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-600'
                        )}>
                          {tx.payment_status === 'paid' ? 'Ödendi' : tx.payment_status === 'partial' ? 'Kısmi' : 'Bekliyor'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Kasa Oturumu Modal ── */}
      {(showSessionModal || isClosingSessionModal) && (
        <Portal>
          <div className={`modal-overlay fixed inset-0 z-[100] bg-black/60 dark:bg-black/70 ${isClosingSessionModal ? 'closing' : ''}`} onClick={() => closeSessionModal()} onAnimationEnd={() => { if (isClosingSessionModal) { setShowSessionModal(false); setIsClosingSessionModal(false) } }} />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <div className={`modal-content bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-6 pointer-events-auto ${isClosingSessionModal ? 'closing' : ''}`}>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {!session ? 'Kasayı Aç' : 'Kasayı Kapat'}
              </h3>

              {!session ? (
                <div className="space-y-4">
                  <div>
                    <label className="label">Açılış Nakit (₺)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={openingCash}
                      onChange={(e) => setOpeningCash(e.target.value)}
                      className="input w-full"
                      placeholder="0.00"
                      autoFocus
                    />
                    <p className="mt-1.5 text-xs text-gray-400">Kasadaki mevcut nakit miktarını girin.</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => closeSessionModal()} className="btn-secondary flex-1">İptal</button>
                    <button onClick={openSession} className="btn-primary flex-1">Kasayı Aç</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="label">Kasadaki Nakit (₺)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={closingCash}
                      onChange={(e) => setClosingCash(e.target.value)}
                      className="input w-full"
                      placeholder="Sayım sonucu..."
                      autoFocus
                    />
                    <p className="mt-1.5 text-xs text-gray-400">Kasadaki nakit miktarını sayıp girin. Sistem farkı hesaplayacak.</p>
                  </div>
                  <div>
                    <label className="label">Not (opsiyonel)</label>
                    <textarea
                      value={closingNote}
                      onChange={(e) => setClosingNote(e.target.value)}
                      className="input w-full"
                      rows={2}
                      placeholder="Kasa kapanış notu..."
                    />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => closeSessionModal()} className="btn-secondary flex-1">İptal</button>
                    <button onClick={closeSession} className="btn-primary flex-1 bg-orange-500 hover:bg-orange-600">Kasayı Kapat</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
