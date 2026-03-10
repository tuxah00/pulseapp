import { Plus, Package } from 'lucide-react'

export default function StoklarPage() {
  return (
    <div>
      {/* Sayfa başlığı */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stoklar</h1>
          <p className="mt-1 text-sm text-gray-500">Ürün ve stok yönetimi</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-pulse-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-pulse-700">
          <Plus className="h-4 w-4" />
          Ürün Ekle
        </button>
      </div>

      {/* Boş durum */}
      <div className="card flex flex-col items-center justify-center py-24 text-center">
        <Package className="mb-4 h-16 w-16 text-gray-200" />
        <h3 className="text-base font-semibold text-gray-700">Henüz ürün yok</h3>
        <p className="mt-1 text-sm text-gray-400">
          Sağ üstteki butonu kullanarak ilk ürününüzü ekleyin.
        </p>
      </div>
    </div>
  )
}
