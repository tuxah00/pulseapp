'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import {
  Plus, Package, Loader2, X, Pencil, Trash2,
  AlertTriangle, LayoutList, LayoutGrid, Search,
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { useViewMode } from '@/lib/hooks/use-view-mode'
import CompactBoxCard from '@/components/ui/compact-box-card'

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
  is_active: boolean
  created_at: string
}

export default function StoklarPage() {
  const { businessId, loading: ctxLoading, permissions } = useBusinessContext()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useViewMode('stoklar', 'list')

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('')
  const [stockCount, setStockCount] = useState('0')
  const [minStockLevel, setMinStockLevel] = useState('5')
  const [unit, setUnit] = useState('adet')

  const supabase = createClient()

  const fetchProducts = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    let query = supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name')

    if (search.trim()) {
      query = query.ilike('name', `%${search}%`)
    }

    const { data, error } = await query
    if (error) {
      if (error.message.includes('relation "public.products" does not exist') ||
          error.message.includes('does not exist')) {
        setDbError('Ürünler tablosu henüz oluşturulmamış. Lütfen Supabase\'de aşağıdaki SQL\'i çalıştırın.')
      } else {
        console.error('Ürün çekme hatası:', error)
      }
    } else {
      setProducts(data || [])
      setDbError(null)
    }
    setLoading(false)
  }, [businessId, search])

  useEffect(() => { if (!ctxLoading) fetchProducts() }, [fetchProducts, ctxLoading])

  function openNewModal() {
    setEditingProduct(null)
    setName(''); setDescription(''); setCategory('')
    setPrice(''); setStockCount('0'); setMinStockLevel('5'); setUnit('adet')
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
    }

    setSaving(false); setShowModal(false); fetchProducts()
  }

  async function handleDelete(product: Product) {
    if (!confirm(`"${product.name}" ürününü silmek istediğinize emin misiniz?`)) return
    const { error: err } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', product.id)
    if (err) { alert('Silme hatası: ' + err.message); return }
    if (selectedProduct?.id === product.id) setSelectedProduct(null)
    fetchProducts()
  }

  async function updateStock(product: Product, delta: number) {
    const newCount = Math.max(0, product.stock_count + delta)
    const { error: err } = await supabase
      .from('products')
      .update({ stock_count: newCount })
      .eq('id', product.id)
    if (err) { alert('Stok güncelleme hatası: ' + err.message); return }
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock_count: newCount } : p))
    if (selectedProduct?.id === product.id) {
      setSelectedProduct(prev => prev ? { ...prev, stock_count: newCount } : null)
    }
  }

  const filteredProducts = products

  function stockBadge(product: Product) {
    if (product.stock_count === 0)
      return <span className="badge bg-red-100 text-red-700">Stok Yok</span>
    if (product.stock_count <= product.min_stock_level)
      return <span className="badge bg-amber-100 text-amber-700">Az Stok</span>
    return <span className="badge bg-green-100 text-green-700">Stokta Var</span>
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
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-pulse-500" /></div>
  }

  return (
    <div>
      {/* Başlık */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Stoklar</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {dbError ? 'Ürün ve stok yönetimi' : `${products.length} ürün`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button onClick={() => setViewMode('list')} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', viewMode === 'list' ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700')} title="Liste"><LayoutList className="h-4 w-4" /></button>
            <button onClick={() => setViewMode('box')} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', viewMode === 'box' ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700')} title="Kutular"><LayoutGrid className="h-4 w-4" /></button>
          </div>
          <button onClick={openNewModal} className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />Ürün Ekle
          </button>
        </div>
      </div>

      {/* DB Hata Mesajı */}
      {dbError && (
        <div className="card border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-300">{dbError}</p>
              <details className="mt-3">
                <summary className="text-sm text-amber-700 dark:text-amber-400 cursor-pointer hover:underline">SQL'i göster</summary>
                <pre className="mt-2 text-xs bg-amber-100 dark:bg-amber-900/40 rounded-lg p-3 overflow-x-auto text-amber-900 dark:text-amber-200">{`CREATE TABLE IF NOT EXISTS public.products (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  category    text,
  price       numeric(10,2),
  stock_count integer NOT NULL DEFAULT 0,
  min_stock_level integer NOT NULL DEFAULT 5,
  unit        text NOT NULL DEFAULT 'adet',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_products" ON public.products
  USING (business_id IN (
    SELECT business_id FROM staff_members WHERE user_id = auth.uid() AND is_active = true
  ));`}</pre>
              </details>
            </div>
          </div>
        </div>
      )}

      {/* Arama */}
      {!dbError && (
        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" placeholder="Ürün ara..." />
        </div>
      )}

      {/* İçerik */}
      {!dbError && filteredProducts.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-24 text-center">
          <Package className="mb-4 h-16 w-16 text-gray-200 dark:text-gray-600" />
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300">
            {search ? 'Aramanızla eşleşen ürün bulunamadı' : 'Henüz ürün eklenmemiş'}
          </h3>
          {!search && (
            <p className="mt-1 mb-4 text-sm text-gray-400">
              Sağ üstteki butonu kullanarak ilk ürününüzü ekleyin.
            </p>
          )}
          {!search && (
            <button onClick={openNewModal} className="btn-primary">
              <Plus className="mr-2 h-4 w-4" />İlk Ürünü Ekle
            </button>
          )}
        </div>
      ) : !dbError && viewMode === 'list' ? (
        <div className="space-y-3">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              onClick={() => setSelectedProduct(product)}
              className={cn('card flex items-center gap-4 p-4 cursor-pointer transition-all hover:shadow-md', selectedProduct?.id === product.id && 'ring-2 ring-pulse-500')}
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
              {/* Hızlı stok güncelleme */}
              <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => updateStock(product, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold text-lg leading-none">−</button>
                <span className="w-8 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">{product.stock_count}</span>
                <button onClick={() => updateStock(product, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold text-lg leading-none">+</button>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => openEditModal(product)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 transition-colors"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => handleDelete(product)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      ) : !dbError ? (
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-2">
          {filteredProducts.map((product) => (
            <CompactBoxCard
              key={product.id}
              initials={product.name.slice(0, 2).toUpperCase()}
              title={product.name}
              colorClass="bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              selected={selectedProduct?.id === product.id}
              onClick={() => setSelectedProduct(product)}
              badge={stockBadge(product)}
              meta={`${product.stock_count} ${product.unit}`}
            >
              <button onClick={() => updateStock(product, -1)} className="flex h-5 w-5 items-center justify-center rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold text-xs">−</button>
              <button onClick={() => updateStock(product, 1)} className="flex h-5 w-5 items-center justify-center rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold text-xs">+</button>
            </CompactBoxCard>
          ))}
        </div>
      ) : null}

      {/* ── Ürün Detay Slide-Over Paneli ── */}
      {selectedProduct && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 dark:bg-black/50" onClick={() => setSelectedProduct(null)} />
          <div className="slide-panel border-l border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Ürün Detayı</h3>
              <button onClick={() => setSelectedProduct(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                  <Package className="h-8 w-8 text-gray-500 dark:text-gray-400" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedProduct.name}</h4>
                <div className="mt-1">{stockBadge(selectedProduct)}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{selectedProduct.stock_count}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{selectedProduct.unit}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <p className="text-2xl font-bold text-amber-600">{selectedProduct.min_stock_level}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Min. Stok</p>
                </div>
              </div>

              {/* Hızlı stok */}
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
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Fiyat</span><span className="text-price">{formatCurrency(selectedProduct.price)}</span></div>
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
            </div>
          </div>
        </>
      )}

      {/* Ürün Ekle / Düzenleme Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingProduct ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
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
                  <select value={unit} onChange={(e) => setUnit(e.target.value)} className="input">
                    <option value="adet">Adet</option>
                    <option value="kutu">Kutu</option>
                    <option value="şişe">Şişe</option>
                    <option value="paket">Paket</option>
                    <option value="lt">Litre</option>
                    <option value="kg">Kilogram</option>
                    <option value="gr">Gram</option>
                    <option value="ml">Mililitre</option>
                  </select>
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

              <div>
                <label className="label">Açıklama (opsiyonel)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={2} placeholder="Ürün hakkında ek bilgi..." />
              </div>

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
    </div>
  )
}
