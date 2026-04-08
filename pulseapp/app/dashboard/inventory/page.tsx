'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { useDebounce } from '@/lib/hooks/use-debounce'
import {
  Plus, Package, Loader2, X, Pencil, Trash2,
  AlertTriangle, LayoutList, LayoutGrid, Search,
  History, Truck, Download, TrendingDown, TrendingUp,
  ChevronRight, Filter, ArrowUpDown,
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { useViewMode } from '@/lib/hooks/use-view-mode'
import { logAudit } from '@/lib/utils/audit'
import CompactBoxCard from '@/components/ui/compact-box-card'
import { AnimatedList, AnimatedItem } from '@/components/ui/animated-list'
import { CustomSelect } from '@/components/ui/custom-select'
import { ToolbarPopover, SortPopoverContent } from '@/components/ui/toolbar-popover'
import { exportToCSV } from '@/lib/utils/export'
import type { StockMovement, Supplier } from '@/types'

interface Product {
  id: string
  business_id: string
  name: string
  description: string | null
  category: string | null
  price: number | null
  stock_count: number
  min_stock_level: number
  unit: string
  supplier_id: string | null
  is_active: boolean
  created_at: string
}

type DetailTab = 'info' | 'movements'
type PageTab = 'products' | 'suppliers'

export default function StoklarPage() {
  const { businessId, staffId, staffName, loading: ctxLoading, permissions } = useBusinessContext()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [panelClosing, setPanelClosing] = useState(false)
  const closePanelAnimated = useCallback(() => setPanelClosing(true), [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [viewMode, setViewMode] = useViewMode('stoklar', 'list')
  const { confirm } = useConfirm()
  const [pageTab, setPageTab] = useState<PageTab>('products')
  const [detailTab, setDetailTab] = useState<DetailTab>('info')
  const [stockFilter, setStockFilter] = useState<'low' | 'out' | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Movement history
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [movementsLoading, setMovementsLoading] = useState(false)

  // Suppliers
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [suppliersLoading, setSuppliersLoading] = useState(false)
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [supplierName, setSupplierName] = useState('')
  const [supplierPhone, setSupplierPhone] = useState('')
  const [supplierEmail, setSupplierEmail] = useState('')
  const [supplierNotes, setSupplierNotes] = useState('')
  const [savingSupplier, setSavingSupplier] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('')
  const [stockCount, setStockCount] = useState('0')
  const [minStockLevel, setMinStockLevel] = useState('5')
  const [unit, setUnit] = useState('adet')
  const [supplierId, setSupplierId] = useState('')
  const [addAsExpense, setAddAsExpense] = useState(false)
  const [expenseCost, setExpenseCost] = useState('')

  const supabase = createClient()

  const fetchProducts = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    const query = supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name')

    const { data, error } = await query
    if (error) {
      if (error.message.includes('relation "public.products" does not exist') ||
          error.message.includes('does not exist')) {
        setDbError('Ürünler tablosu henüz oluşturulmamış. Lütfen Supabase\'de gerekli SQL\'i çalıştırın.')
      } else {
        console.error('Ürün çekme hatası:', error)
      }
    } else {
      setProducts(data || [])
      setDbError(null)
    }
    setLoading(false)
  }, [businessId])

  const fetchSuppliers = useCallback(async () => {
    if (!businessId) return
    setSuppliersLoading(true)
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .eq('business_id', businessId)
      .order('name')
    setSuppliers(data || [])
    setSuppliersLoading(false)
  }, [businessId])

  useEffect(() => {
    if (!ctxLoading) {
      fetchProducts()
      fetchSuppliers()
    }
  }, [fetchProducts, fetchSuppliers, ctxLoading])

  useEffect(() => {
    if (!showModal) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false) }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [showModal])

  const fetchMovements = useCallback(async (productId: string) => {
    setMovementsLoading(true)
    try {
      const res = await fetch(`/api/stock-movements?productId=${productId}`)
      const json = await res.json()
      setMovements(json.movements || [])
    } catch {
      setMovements([])
    }
    setMovementsLoading(false)
  }, [])

  function openNewModal() {
    setEditingProduct(null)
    setName(''); setDescription(''); setCategory('')
    setPrice(''); setStockCount('0'); setMinStockLevel('5'); setUnit('adet'); setSupplierId('')
    setAddAsExpense(false); setExpenseCost('')
    setError(null); setShowModal(true)
  }

  function openEditModal(product: Product) {
    setEditingProduct(product)
    setName(product.name)
    setDescription(product.description || '')
    setCategory(product.category || '')
    setPrice(product.price ? String(product.price) : '')
    setStockCount(String(product.stock_count))
    setMinStockLevel(String(product.min_stock_level))
    setUnit(product.unit)
    setSupplierId(product.supplier_id || '')
    setAddAsExpense(false); setExpenseCost('')
    setError(null); setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null)

    const payload = {
      name,
      description: description || null,
      category: category || null,
      price: price ? parseFloat(price) : null,
      stock_count: parseInt(stockCount) || 0,
      min_stock_level: parseInt(minStockLevel) || 5,
      unit: unit || 'adet',
      supplier_id: supplierId || null,
    }

    if (editingProduct) {
      const { error: err } = await supabase
        .from('products')
        .update(payload)
        .eq('id', editingProduct.id)
      if (err) { setError('Güncelleme hatası: ' + err.message); setSaving(false); return }
      setSelectedProduct(prev => prev?.id === editingProduct.id ? { ...prev, ...payload } as Product : prev)
    } else {
      const { error: err } = await supabase
        .from('products')
        .insert({ ...payload, business_id: businessId, is_active: true })
      if (err) { setError('Ekleme hatası: ' + err.message); setSaving(false); return }

      if (addAsExpense && expenseCost) {
        await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_id: businessId,
            category: 'Stok',
            description: `Stok alımı: ${name}`,
            amount: parseFloat(expenseCost),
            expense_date: new Date().toISOString().split('T')[0],
            is_recurring: false,
          }),
        })
      }
    }

    setSaving(false); setShowModal(false); fetchProducts()
    logAudit({ businessId: businessId!, staffId, staffName, action: editingProduct ? 'update' : 'create', resource: 'inventory', resourceId: editingProduct?.id, details: { name } })
  }

  async function handleDelete(product: Product) {
    const ok = await confirm({ title: 'Onay', message: `"${product.name}" ürününü silmek istediğinize emin misiniz?` })
    if (!ok) return
    const { error: err } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', product.id)
    if (err) { alert('Silme hatası: ' + err.message); return }
    if (selectedProduct?.id === product.id) setSelectedProduct(null)
    fetchProducts()
    logAudit({ businessId: businessId!, staffId, staffName, action: 'delete', resource: 'inventory', resourceId: product.id, details: { name: product.name } })
  }

  async function updateStock(product: Product, delta: number) {
    try {
      const res = await fetch('/api/stock-movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: product.business_id,
          productId: product.id,
          quantity: Math.abs(delta),
          type: delta > 0 ? 'in' : 'out',
          staffId: staffId || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { alert('Stok güncelleme hatası: ' + json.error); return }

      const newCount = json.newStock
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock_count: newCount } : p))
      if (selectedProduct?.id === product.id) {
        setSelectedProduct(prev => prev ? { ...prev, stock_count: newCount } : null)
        if (detailTab === 'movements') fetchMovements(product.id)
      }
    } catch (err) {
      alert('Stok güncelleme hatası')
    }
  }

  // Supplier CRUD
  function openNewSupplierModal() {
    setEditingSupplier(null)
    setSupplierName(''); setSupplierPhone(''); setSupplierEmail(''); setSupplierNotes('')
    setShowSupplierModal(true)
  }

  function openEditSupplierModal(supplier: Supplier) {
    setEditingSupplier(supplier)
    setSupplierName(supplier.name)
    setSupplierPhone(supplier.phone || '')
    setSupplierEmail(supplier.email || '')
    setSupplierNotes(supplier.notes || '')
    setShowSupplierModal(true)
  }

  async function handleSaveSupplier(e: React.FormEvent) {
    e.preventDefault(); setSavingSupplier(true)
    const payload = {
      name: supplierName,
      phone: supplierPhone || null,
      email: supplierEmail || null,
      notes: supplierNotes || null,
    }
    if (editingSupplier) {
      await supabase.from('suppliers').update(payload).eq('id', editingSupplier.id)
    } else {
      await supabase.from('suppliers').insert({ ...payload, business_id: businessId })
    }
    setSavingSupplier(false); setShowSupplierModal(false); fetchSuppliers()
  }

  async function handleDeleteSupplier(supplier: Supplier) {
    const ok = await confirm({ title: 'Onay', message: `"${supplier.name}" tedarikçisini silmek istediğinize emin misiniz?` })
    if (!ok) return
    await supabase.from('suppliers').delete().eq('id', supplier.id)
    fetchSuppliers()
  }

  // Summary stats (always from full products list, not filtered)
  const totalValue = products.reduce((sum, p) => sum + (p.stock_count * (p.price || 0)), 0)
  const lowStockCount = products.filter(p => p.stock_count > 0 && p.stock_count <= p.min_stock_level).length
  const outOfStockCount = products.filter(p => p.stock_count === 0).length

  // Unique categories derived from all products
  const categories = [...new Set(products.filter(p => p.category).map(p => p.category!))].sort()

  const hasActiveFilters = !!(stockFilter || categoryFilter)
  const SORT_OPTIONS = [
    { value: 'name', label: 'İsim' },
    { value: 'stock_count', label: 'Stok adedi' },
    { value: 'price', label: 'Fiyat' },
    { value: 'category', label: 'Kategori' },
  ]

  // Client-side filtered list
  const filteredProducts = (() => {
    let list = products.filter(p => {
      if (stockFilter === 'low' && !(p.stock_count <= p.min_stock_level && p.stock_count > 0)) return false
      if (stockFilter === 'out' && p.stock_count !== 0) return false
      if (categoryFilter && p.category !== categoryFilter) return false
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase()
        if (!p.name.toLowerCase().includes(q) && !(p.category?.toLowerCase().includes(q))) return false
      }
      return true
    })
    if (sortField) {
      list = [...list].sort((a, b) => {
        const va = (a as any)[sortField]
        const vb = (b as any)[sortField]
        if (va == null && vb == null) return 0
        if (va == null) return 1
        if (vb == null) return -1
        const cmp = typeof va === 'string' ? va.localeCompare(vb, 'tr') : (va as number) - (vb as number)
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return list
  })()

  function stockBadge(product: Product) {
    if (product.stock_count === 0)
      return <span className="badge bg-red-100 text-red-700">Stok Yok</span>
    if (product.stock_count <= product.min_stock_level)
      return <span className="badge bg-amber-100 text-amber-700">Az Stok</span>
    return <span className="badge bg-green-100 text-green-700">Stokta Var</span>
  }

  function movementTypeLabel(type: string) {
    const labels: Record<string, { text: string; color: string }> = {
      in: { text: 'Giriş', color: 'text-green-600' },
      out: { text: 'Çıkış', color: 'text-red-600' },
      adjustment: { text: 'Düzeltme', color: 'text-blue-600' },
      appointment: { text: 'Randevu', color: 'text-purple-600' },
      order: { text: 'Sipariş', color: 'text-orange-600' },
    }
    return labels[type] || { text: type, color: 'text-gray-600' }
  }

  function handleExport() {
    exportToCSV(
      products.map(p => ({
        name: p.name,
        category: p.category || '',
        stock_count: p.stock_count,
        unit: p.unit,
        price: p.price || 0,
        total_value: p.stock_count * (p.price || 0),
        min_stock_level: p.min_stock_level,
        status: p.stock_count === 0 ? 'Stok Yok' : p.stock_count <= p.min_stock_level ? 'Az Stok' : 'Stokta Var',
      })),
      'stok-raporu',
      [
        { key: 'name', label: 'Ürün Adı' },
        { key: 'category', label: 'Kategori' },
        { key: 'stock_count', label: 'Stok Miktarı' },
        { key: 'unit', label: 'Birim' },
        { key: 'price', label: 'Birim Fiyat (TL)' },
        { key: 'total_value', label: 'Toplam Değer (TL)' },
        { key: 'min_stock_level', label: 'Min. Stok' },
        { key: 'status', label: 'Durum' },
      ]
    )
  }

  if (permissions && !permissions.inventory) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">İşletme sahibinizle iletişime geçin.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-pulse-900" /></div>
  }

  return (
    <div>
      {/* Başlık */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Stoklar</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {dbError ? 'Ürün ve stok yönetimi' : `${products.length} ürün`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {!dbError && pageTab === 'products' && (
            <>
              <button onClick={handleExport} className="btn-secondary text-sm gap-1.5">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Dışa Aktar</span>
              </button>
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <ToolbarPopover icon={<Filter className="h-4 w-4" />} label="Filtre" active={hasActiveFilters}>
                  <div className="p-3 w-56 space-y-3">
                    <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Stok Durumu</p>
                    {([['low', 'Az Stok'], ['out', 'Stok Yok']] as ['low'|'out', string][]).map(([val, lbl]) => (
                      <button key={val} onClick={() => setStockFilter(stockFilter === val ? null : val)}
                        className={cn('w-full text-left px-3 py-2 rounded-lg text-sm transition-colors', stockFilter === val ? 'bg-pulse-50 text-pulse-900 dark:bg-pulse-900/30 dark:text-pulse-300 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700')}>
                        {lbl}
                      </button>
                    ))}
                    {categories.length > 0 && (
                      <>
                        <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider pt-1 border-t dark:border-gray-700">Kategori</p>
                        {categories.map(cat => (
                          <button key={cat} onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)}
                            className={cn('w-full text-left px-3 py-2 rounded-lg text-sm transition-colors', categoryFilter === cat ? 'bg-pulse-50 text-pulse-900 dark:bg-pulse-900/30 dark:text-pulse-300 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700')}>
                            {cat}
                          </button>
                        ))}
                      </>
                    )}
                    {hasActiveFilters && (
                      <button onClick={() => { setStockFilter(null); setCategoryFilter('') }}
                        className="w-full text-xs text-center py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-1 mt-1">
                        <X className="h-3 w-3" /> Temizle
                      </button>
                    )}
                  </div>
                </ToolbarPopover>
                <ToolbarPopover icon={<ArrowUpDown className="h-4 w-4" />} label="Sırala" active={sortField !== null}>
                  <SortPopoverContent options={SORT_OPTIONS} sortField={sortField} sortDir={sortDir} onSortField={setSortField} onSortDir={setSortDir} />
                </ToolbarPopover>
                <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-0.5" />
                <button onClick={() => setViewMode('list')} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', viewMode === 'list' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')} title="Liste"><LayoutList className="h-4 w-4" /></button>
                <button onClick={() => setViewMode('box')} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', viewMode === 'box' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')} title="Kutular"><LayoutGrid className="h-4 w-4" /></button>
              </div>
            </>
          )}
          <button
            onClick={pageTab === 'products' ? openNewModal : openNewSupplierModal}
            className="btn-primary"
          >
            <Plus className="mr-2 h-4 w-4" />
            {pageTab === 'products' ? 'Ürün Ekle' : 'Tedarikçi Ekle'}
          </button>
        </div>
      </div>

      {/* Sekme Navigasyonu */}
      {!dbError && (
        <div className="mb-6 flex gap-1 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setPageTab('products')}
            className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors', pageTab === 'products' ? 'border-pulse-900 text-pulse-900 dark:text-pulse-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200')}
          >
            <Package className="h-4 w-4" />Ürünler
          </button>
          <button
            onClick={() => setPageTab('suppliers')}
            className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors', pageTab === 'suppliers' ? 'border-pulse-900 text-pulse-900 dark:text-pulse-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200')}
          >
            <Truck className="h-4 w-4" />Tedarikçiler
          </button>
        </div>
      )}

      {/* DB Hata Mesajı */}
      {dbError && (
        <div className="card border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-300">{dbError}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── ÜRÜNLER SEKMESİ ── */}
      {!dbError && pageTab === 'products' && (
        <>
          {/* Özet Kartlar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <button
              onClick={() => { setStockFilter(null); setCategoryFilter('') }}
              className="card p-4 text-left transition-all hover:shadow-md"
            >
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Toplam Ürün</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{products.length}</p>
            </button>
            <div className="card p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Stok Değeri</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{formatCurrency(totalValue)}</p>
            </div>
            <button
              onClick={() => setStockFilter(stockFilter === 'low' ? null : 'low')}
              className={cn('card p-4 text-left transition-all hover:shadow-md', stockFilter === 'low' && 'ring-2 ring-amber-500')}
            >
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Az Stok</p>
              <div className="flex items-center gap-2">
                <p className={cn('text-2xl font-bold', lowStockCount > 0 ? 'text-amber-600' : 'text-gray-900 dark:text-gray-100')}>{lowStockCount}</p>
                {lowStockCount > 0 && <TrendingDown className="h-5 w-5 text-amber-600" />}
              </div>
            </button>
            <button
              onClick={() => setStockFilter(stockFilter === 'out' ? null : 'out')}
              className={cn('card p-4 text-left transition-all hover:shadow-md', stockFilter === 'out' && 'ring-2 ring-red-500')}
            >
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Stok Yok</p>
              <div className="flex items-center gap-2">
                <p className={cn('text-2xl font-bold', outOfStockCount > 0 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100')}>{outOfStockCount}</p>
                {outOfStockCount > 0 && <AlertTriangle className="h-4 w-4 text-red-500" />}
              </div>
            </button>
          </div>

          {/* Arama */}
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" placeholder="Ürün ara..." />
          </div>

          {/* Ürün Listesi */}
          {products.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-24 text-center">
              <Package className="mb-4 h-16 w-16 text-gray-200 dark:text-gray-600" />
              <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300">Henüz ürün eklenmemiş</h3>
              <p className="mt-1 mb-4 text-sm text-gray-400">Sağ üstteki butonu kullanarak ilk ürününüzü ekleyin.</p>
              <button onClick={openNewModal} className="btn-primary"><Plus className="mr-2 h-4 w-4" />İlk Ürünü Ekle</button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <Package className="mb-4 h-12 w-12 text-gray-300" />
              <p className="text-gray-500">Filtreye uyan ürün bulunamadı</p>
              <button
                onClick={() => { setStockFilter(null); setCategoryFilter(''); setSearch('') }}
                className="mt-3 btn-secondary text-sm"
              >
                Filtreleri Temizle
              </button>
            </div>
          ) : viewMode === 'list' ? (
            <AnimatedList className="space-y-3">
              {filteredProducts.map((product) => (
                <AnimatedItem
                  key={product.id}
                  onClick={() => { setSelectedProduct(product); setDetailTab('info') }}
                  className={cn('card flex items-center gap-4 p-4 cursor-pointer transition-all hover:shadow-md', selectedProduct?.id === product.id && 'ring-2 ring-pulse-900')}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                    <Package className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{product.name}</span>
                      {stockBadge(product)}
                      {product.category && <span className="badge bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{product.category}</span>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                      <span>{product.stock_count} {product.unit}</span>
                      {product.price && <span className="text-price">{formatCurrency(product.price)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => updateStock(product, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold text-lg leading-none">−</button>
                    <span className="w-8 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">{product.stock_count}</span>
                    <button onClick={() => updateStock(product, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold text-lg leading-none">+</button>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openEditModal(product)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 transition-colors"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(product)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </AnimatedItem>
              ))}
            </AnimatedList>
          ) : (
            <AnimatedList className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-2">
              {filteredProducts.map((product) => (
                <AnimatedItem key={product.id}>
                  <CompactBoxCard
                    initials={product.name.slice(0, 2).toUpperCase()}
                    title={product.name}
                    colorClass="bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                    selected={selectedProduct?.id === product.id}
                    onClick={() => { setSelectedProduct(product); setDetailTab('info') }}
                  >
                    <button onClick={(e) => { e.stopPropagation(); updateStock(product, -1) }} className="flex h-5 w-5 items-center justify-center rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold text-xs">−</button>
                    <button onClick={(e) => { e.stopPropagation(); updateStock(product, 1) }} className="flex h-5 w-5 items-center justify-center rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold text-xs">+</button>
                  </CompactBoxCard>
                </AnimatedItem>
              ))}
            </AnimatedList>
          )}
        </>
      )}

      {/* ── TEDARİKÇİLER SEKMESİ ── */}
      {!dbError && pageTab === 'suppliers' && (
        <>
          {suppliersLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-pulse-900" /></div>
          ) : suppliers.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-24 text-center">
              <Truck className="mb-4 h-16 w-16 text-gray-200 dark:text-gray-600" />
              <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300">Henüz tedarikçi eklenmemiş</h3>
              <p className="mt-1 mb-4 text-sm text-gray-400">Ürün tedarikçilerinizi buraya ekleyebilirsiniz.</p>
              <button onClick={openNewSupplierModal} className="btn-primary"><Plus className="mr-2 h-4 w-4" />İlk Tedarikçiyi Ekle</button>
            </div>
          ) : (
            <div className="space-y-3">
              {suppliers.map((supplier) => (
                <div key={supplier.id} className="card flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pulse-100 dark:bg-pulse-900/30 flex-shrink-0">
                    <Truck className="h-5 w-5 text-pulse-900 dark:text-pulse-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{supplier.name}</p>
                    <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {supplier.phone && <span>{supplier.phone}</span>}
                      {supplier.email && <span>{supplier.email}</span>}
                    </div>
                    {supplier.notes && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">{supplier.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEditSupplierModal(supplier)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 transition-colors"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => handleDeleteSupplier(supplier)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Ürün Detay Slide-Over Paneli ── */}
      {selectedProduct && (
        <>
          <div className="fixed inset-x-0 bottom-0 top-14 z-[54] bg-black/30 dark:bg-black/50" onClick={closePanelAnimated} />
          <div
            className={`slide-panel !top-14 border-l border-gray-200 dark:border-gray-700 ${panelClosing ? 'closing' : ''}`}
            onAnimationEnd={() => { if (panelClosing) { setSelectedProduct(null); setPanelClosing(false) } }}
          >
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Ürün Detayı</h3>
              <button onClick={closePanelAnimated} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Detay Sekmeler */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setDetailTab('info')}
                className={cn('flex-1 px-4 py-2.5 text-sm font-medium transition-colors', detailTab === 'info' ? 'border-b-2 border-pulse-900 text-pulse-900 dark:text-pulse-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700')}
              >Bilgiler</button>
              <button
                onClick={() => {
                  setDetailTab('movements')
                  fetchMovements(selectedProduct.id)
                }}
                className={cn('flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1', detailTab === 'movements' ? 'border-b-2 border-pulse-900 text-pulse-900 dark:text-pulse-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700')}
              ><History className="h-3.5 w-3.5" />Hareketler</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {detailTab === 'info' ? (
                <>
                  <div className="text-center">
                    <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                      <Package className="h-8 w-8 text-gray-500 dark:text-gray-400" />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedProduct.name}</h4>
                    <div className="mt-1">{stockBadge(selectedProduct)}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{selectedProduct.stock_count}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{selectedProduct.unit}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <p className="text-2xl font-bold text-amber-600">{selectedProduct.min_stock_level}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Min. Stok</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-4">
                    <button onClick={() => updateStock(selectedProduct, -1)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold text-xl transition-colors">−</button>
                    <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 min-w-[3rem] text-center">{selectedProduct.stock_count}</span>
                    <button onClick={() => updateStock(selectedProduct, 1)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold text-xl transition-colors">+</button>
                  </div>

                  <div className="space-y-2 text-sm">
                    {selectedProduct.category && (
                      <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Kategori</span><span className="text-gray-900 dark:text-gray-100">{selectedProduct.category}</span></div>
                    )}
                    {selectedProduct.price && (
                      <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Birim Fiyat</span><span className="text-price">{formatCurrency(selectedProduct.price)}</span></div>
                    )}
                    {selectedProduct.price && (
                      <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Toplam Değer</span><span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(selectedProduct.stock_count * selectedProduct.price)}</span></div>
                    )}
                    {selectedProduct.supplier_id && suppliers.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Tedarikçi</span>
                        <span className="text-gray-900 dark:text-gray-100">{suppliers.find(s => s.id === selectedProduct.supplier_id)?.name || '—'}</span>
                      </div>
                    )}
                    {selectedProduct.description && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Açıklama</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">{selectedProduct.description}</p>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex gap-2">
                    <button onClick={() => { openEditModal(selectedProduct); setSelectedProduct(null) }} className="btn-secondary flex-1 text-sm">
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />Düzenle
                    </button>
                    <button onClick={() => handleDelete(selectedProduct)} className="btn-danger flex-1 text-sm">
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />Sil
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {movementsLoading ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-pulse-900" /></div>
                  ) : movements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <History className="mb-3 h-12 w-12 text-gray-200 dark:text-gray-600" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">Henüz stok hareketi yok</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {movements.map((movement) => {
                        const typeInfo = movementTypeLabel(movement.type)
                        const isIn = movement.quantity > 0
                        return (
                          <div key={movement.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                            <div className={cn('flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0', isIn ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30')}>
                              {isIn ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className={cn('text-xs font-medium', typeInfo.color)}>{typeInfo.text}</span>
                                <span className={cn('text-sm font-bold', isIn ? 'text-green-600' : 'text-red-600')}>
                                  {isIn ? '+' : ''}{movement.quantity}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {new Date(movement.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                {movement.staff_members?.name && ` • ${movement.staff_members.name}`}
                              </div>
                              {movement.notes && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{movement.notes}</p>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Ürün Ekle / Düzenleme Modal */}
      {showModal && (
        <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="modal-content card w-full max-w-md max-h-[90vh] overflow-y-auto dark:bg-gray-900">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingProduct ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="label">Ürün Adı</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Saç Boyası No.5" required autoFocus />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Kategori (opsiyonel)</label>
                  <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} className="input" placeholder="Boya" />
                </div>
                <div>
                  <label className="label">Birim</label>
                  <CustomSelect
                    value={unit}
                    onChange={v => setUnit(v)}
                    options={[
                      { value: 'adet', label: 'Adet' },
                      { value: 'kutu', label: 'Kutu' },
                      { value: 'şişe', label: 'Şişe' },
                      { value: 'paket', label: 'Paket' },
                      { value: 'lt', label: 'Litre' },
                      { value: 'kg', label: 'Kilogram' },
                      { value: 'gr', label: 'Gram' },
                      { value: 'ml', label: 'Mililitre' },
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Stok Miktarı</label>
                  <input type="number" value={stockCount} onChange={(e) => setStockCount(e.target.value)} className="input" min="0" />
                </div>
                <div>
                  <label className="label">Min. Stok Uyarısı</label>
                  <input type="number" value={minStockLevel} onChange={(e) => setMinStockLevel(e.target.value)} className="input" min="0" />
                </div>
              </div>

              <div>
                <label className="label">Fiyat (TL, opsiyonel)</label>
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="input" placeholder="0.00" min="0" step="0.01" />
              </div>

              {suppliers.length > 0 && (
                <div>
                  <label className="label">Tedarikçi (opsiyonel)</label>
                  <CustomSelect
                    value={supplierId}
                    onChange={v => setSupplierId(v)}
                    placeholder="— Seçin —"
                    options={suppliers.map(s => ({ value: s.id, label: s.name }))}
                  />
                </div>
              )}

              <div>
                <label className="label">Açıklama (opsiyonel)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={2} placeholder="Ürün hakkında ek bilgi..." />
              </div>

              {!editingProduct && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={addAsExpense}
                      onChange={(e) => setAddAsExpense(e.target.checked)}
                      className="h-4 w-4 accent-pulse-900"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Gider olarak ekle</span>
                  </label>
                  {addAsExpense && (
                    <div>
                      <label className="label">Gider maliyeti (₺)</label>
                      <input
                        type="number"
                        value={expenseCost}
                        onChange={(e) => setExpenseCost(e.target.value)}
                        className="input"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  )}
                </div>
              )}

              {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">İptal</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingProduct ? 'Güncelle' : 'Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tedarikçi Ekle / Düzenle Modal */}
      {showSupplierModal && (
        <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="modal-content card w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingSupplier ? 'Tedarikçiyi Düzenle' : 'Yeni Tedarikçi'}
              </h2>
              <button onClick={() => setShowSupplierModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSaveSupplier} className="space-y-4">
              <div>
                <label className="label">Tedarikçi Adı</label>
                <input type="text" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="input" required autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Telefon</label>
                  <input type="tel" value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} className="input" placeholder="05XX XXX XX XX" />
                </div>
                <div>
                  <label className="label">E-posta</label>
                  <input type="email" value={supplierEmail} onChange={(e) => setSupplierEmail(e.target.value)} className="input" placeholder="info@firma.com" />
                </div>
              </div>
              <div>
                <label className="label">Notlar (opsiyonel)</label>
                <textarea value={supplierNotes} onChange={(e) => setSupplierNotes(e.target.value)} className="input" rows={2} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowSupplierModal(false)} className="btn-secondary flex-1">İptal</button>
                <button type="submit" disabled={savingSupplier} className="btn-primary flex-1">
                  {savingSupplier && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingSupplier ? 'Güncelle' : 'Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
