'use client'

import { useState, useEffect, useCallback } from 'react'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Loader2, X, Trash2, ChefHat, Clock, CheckCircle,
  CreditCard, XCircle, ArrowRight, ClipboardList, Minus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'

interface OrderItem {
  product_id: string
  name: string
  quantity: number
  price: number
}

interface Order {
  id: string
  customer_name: string | null
  table_number: string | null
  items: OrderItem[]
  total_amount: number
  status: string
  notes: string | null
  created_at: string
}

interface Product {
  id: string
  name: string
  price: number
  stock_count: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: 'Bekliyor', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-900/30', icon: Clock },
  preparing: { label: 'Hazırlanıyor', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-100 dark:bg-blue-900/30', icon: ChefHat },
  ready: { label: 'Hazır', color: 'text-green-700 dark:text-green-300', bg: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle },
  served: { label: 'Servis Edildi', color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-100 dark:bg-purple-900/30', icon: ClipboardList },
  paid: { label: 'Ödendi', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700', icon: CreditCard },
  cancelled: { label: 'İptal', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-100 dark:bg-red-900/30', icon: XCircle },
}

const STATUS_FLOW: Record<string, string> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'served',
  served: 'paid',
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'Tümü' },
  { value: 'pending', label: 'Bekliyor' },
  { value: 'preparing', label: 'Hazırlanıyor' },
  { value: 'ready', label: 'Hazır' },
  { value: 'served', label: 'Servis' },
  { value: 'paid', label: 'Ödendi' },
  { value: 'cancelled', label: 'İptal' },
]

export default function OrdersPage() {
  const { businessId, loading: ctxLoading, permissions } = useBusinessContext()
  const { confirm } = useConfirm()
  const supabase = createClient()

  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)

  // New order form
  const [customerName, setCustomerName] = useState('')
  const [tableNumber, setTableNumber] = useState('')
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [orderNotes, setOrderNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('status', filter)
      const res = await fetch(`/api/orders?${params}`)
      const json = await res.json()
      setOrders(json.orders || [])
    } finally {
      setLoading(false)
    }
  }, [filter])

  const fetchProducts = useCallback(async () => {
    if (!businessId) return
    const { data } = await supabase
      .from('products')
      .select('id, name, price, stock_count')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name')
    setProducts(data || [])
  }, [businessId])

  useEffect(() => {
    if (!ctxLoading && businessId) {
      fetchOrders()
      fetchProducts()
    }
  }, [fetchOrders, fetchProducts, ctxLoading, businessId])

  useEffect(() => {
    if (!showModal) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false) }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [showModal])

  function addItem(product: Product) {
    setOrderItems(prev => {
      const existing = prev.find(i => i.product_id === product.id)
      if (existing) {
        return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { product_id: product.id, name: product.name, quantity: 1, price: product.price }]
    })
  }

  function updateItemQuantity(productId: string, delta: number) {
    setOrderItems(prev => {
      return prev.map(i => {
        if (i.product_id !== productId) return i
        const newQty = i.quantity + delta
        return newQty <= 0 ? null : { ...i, quantity: newQty }
      }).filter(Boolean) as OrderItem[]
    })
  }

  const orderTotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0)

  async function createOrder() {
    if (orderItems.length === 0) return
    setSaving(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName || null,
          table_number: tableNumber || null,
          items: orderItems,
          total_amount: orderTotal,
          notes: orderNotes || null,
        }),
      })
      if (res.ok) {
        setShowModal(false)
        setCustomerName('')
        setTableNumber('')
        setOrderItems([])
        setOrderNotes('')
        fetchOrders()
        fetchProducts() // refresh stock
      }
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(orderId: string, newStatus: string) {
    await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orderId, status: newStatus }),
    })
    fetchOrders()
  }

  async function deleteOrder(orderId: string) {
    const ok = await confirm({ title: 'Onay', message: 'Bu siparişi silmek istediğinize emin misiniz?' })
    if (!ok) return
    await fetch(`/api/orders?id=${orderId}`, { method: 'DELETE' })
    fetchOrders()
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  }

  if (permissions && !permissions.orders) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Siparişler</h1>
          <p className="text-sm text-gray-500 mt-1">Sipariş oluşturun ve durumlarını takip edin</p>
        </div>
        <button
          onClick={() => { setShowModal(true); fetchProducts() }}
          className="flex items-center gap-2 rounded-lg bg-pulse-800 px-4 py-2 text-sm font-medium text-white hover:bg-pulse-800"
        >
          <Plus className="h-4 w-4" /> Yeni Sipariş
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
              filter === opt.value
                ? 'bg-pulse-800 text-white border-pulse-900'
                : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-600 hover:border-gray-400'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Orders Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : orders.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <ClipboardList className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Sipariş bulunamadı</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map(order => {
            const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
            const StatusIcon = config.icon
            const nextStatus = STATUS_FLOW[order.status]

            return (
              <div key={order.id} className="card space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {order.table_number && (
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        Masa {order.table_number}
                      </span>
                    )}
                    {order.customer_name && (
                      <span className="text-sm text-gray-500">{order.customer_name}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{formatTime(order.created_at)}</span>
                </div>

                {/* Status */}
                <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', config.bg, config.color)}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {config.label}
                </div>

                {/* Items */}
                <div className="space-y-1">
                  {(order.items || []).map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">
                        {item.quantity}x {item.name}
                      </span>
                      <span className="text-gray-500">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Toplam</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatCurrency(order.total_amount)}</span>
                </div>

                {order.notes && (
                  <p className="text-xs text-gray-400 italic">{order.notes}</p>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {nextStatus && (
                    <button
                      onClick={() => updateStatus(order.id, nextStatus)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-pulse-800 px-3 py-2 text-xs font-medium text-white hover:bg-pulse-800 transition-colors"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      {STATUS_CONFIG[nextStatus]?.label}
                    </button>
                  )}
                  {(order.status === 'pending' || order.status === 'cancelled') && (
                    <button
                      onClick={() => order.status === 'pending' ? updateStatus(order.id, 'cancelled') : deleteOrder(order.id)}
                      className="flex items-center justify-center gap-1 rounded-lg border border-red-200 dark:border-red-800 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      {order.status === 'cancelled' ? <Trash2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      {order.status === 'cancelled' ? 'Sil' : 'İptal'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New Order Modal */}
      {showModal && (
        <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
          <div className="modal-content bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Yeni Sipariş</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Müşteri Adı</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="input"
                  placeholder="Opsiyonel"
                />
              </div>
              <div>
                <label className="label">Masa No</label>
                <input
                  type="text"
                  value={tableNumber}
                  onChange={e => setTableNumber(e.target.value)}
                  className="input"
                  placeholder="Ör: 5"
                />
              </div>
            </div>

            {/* Product selection */}
            <div>
              <label className="label">Ürün Ekle</label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2">
                {products.length === 0 ? (
                  <p className="col-span-2 text-sm text-gray-400 text-center py-4">
                    Ürün bulunamadı. Stoklar sayfasından ürün ekleyin.
                  </p>
                ) : products.map(product => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addItem(product)}
                    className="text-left p-2 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-pulse-300 hover:bg-pulse-50 dark:hover:bg-pulse-900/20 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{product.name}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(product.price)}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Selected items */}
            {orderItems.length > 0 && (
              <div className="space-y-2">
                <label className="label">Sipariş Kalemleri</label>
                {orderItems.map(item => (
                  <div key={item.product_id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-900 dark:text-gray-100">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateItemQuantity(item.product_id, -1)}
                        className="p-1 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateItemQuantity(item.product_id, 1)}
                        className="p-1 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <span className="text-sm text-gray-500 w-20 text-right">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">Toplam</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100">{formatCurrency(orderTotal)}</span>
                </div>
              </div>
            )}

            <div>
              <label className="label">Not</label>
              <input
                type="text"
                value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                className="input"
                placeholder="Ekstra not..."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">İptal</button>
              <button
                onClick={createOrder}
                disabled={saving || orderItems.length === 0}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-pulse-800 px-4 py-2 text-sm font-medium text-white hover:bg-pulse-800 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Sipariş Oluştur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
