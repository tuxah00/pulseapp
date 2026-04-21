'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Portal } from '@/components/ui/portal'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { requirePermission, requireSectorModule } from '@/lib/hooks/use-require-permission'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/utils/audit'
import {
  Image as ImageIcon,
  Plus,
  Star,
  Trash2,
  Upload,
  X,
  Filter,
  Tag,
  Sparkles,
  Loader2,
} from 'lucide-react'

interface PortfolioItem {
  id: string
  business_id: string
  title: string
  description: string | null
  image_url: string | null
  storage_path: string | null
  category: string | null
  is_featured: boolean
  created_at: string
}

interface UploadForm {
  title: string
  category: string
  description: string
  is_featured: boolean
}

const INITIAL_FORM: UploadForm = {
  title: '',
  category: '',
  description: '',
  is_featured: false,
}

export default function PortfolioPage() {
  const { businessId, staffId, staffName, sector, permissions } = useBusinessContext()
  const [items, setItems] = useState<PortfolioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [isClosingModal, setIsClosingModal] = useState(false)
  const [form, setForm] = useState<UploadForm>(INITIAL_FORM)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [isClosingDeleteConfirm, setIsClosingDeleteConfirm] = useState(false)
  const closeDeleteConfirm = () => setIsClosingDeleteConfirm(true)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // AI Analysis state
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<string | null>(null)
  const [analysisItem, setAnalysisItem] = useState<PortfolioItem | null>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [isClosingAnalysis, setIsClosingAnalysis] = useState(false)
  const closeAnalysis = () => setIsClosingAnalysis(true)
  const onAnalysisClosed = () => { setShowAnalysis(false); setIsClosingAnalysis(false); setAnalysisResult(null); setAnalysisItem(null) }

  const categories = ['all', ...Array.from(new Set(items.map((i) => i.category).filter(Boolean) as string[]))]

  const fetchItems = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ businessId })
      if (activeCategory !== 'all') params.set('category', activeCategory)
      const res = await fetch(`/api/portfolio?${params}`)
      const json = await res.json()
      setItems(json.items || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [businessId, activeCategory])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  function openModal() {
    setForm(INITIAL_FORM)
    setSelectedFile(null)
    setPreviewUrl(null)
    setUploadError(null)
    setShowModal(true)
  }

  function closeModal() {
    setIsClosingModal(true)
  }
  function onModalClosed() {
    setShowModal(false)
    setIsClosingModal(false)
    setSelectedFile(null)
    setPreviewUrl(null)
    setUploadError(null)
  }

  function handleFileSelect(file: File) {
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function onDragLeave() {
    setIsDragging(false)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) handleFileSelect(file)
  }

  async function handleUpload() {
    if (!businessId || !form.title.trim()) {
      setUploadError('Başlık gereklidir.')
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      let imageUrl: string | null = null
      let storagePath: string | null = null

      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop()
        storagePath = `${businessId}/${Date.now()}.${fileExt}`
        const supabase = createClient()
        const { error: storageError } = await supabase.storage
          .from('portfolio')
          .upload(storagePath, selectedFile)

        if (storageError) {
          setUploadError(`Görsel yüklenemedi: ${storageError.message}`)
          setUploading(false)
          return
        }

        const { data: { publicUrl } } = supabase.storage.from('portfolio').getPublicUrl(storagePath)
        imageUrl = publicUrl
      }

      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          title: form.title.trim(),
          category: form.category.trim() || null,
          description: form.description.trim() || null,
          image_url: imageUrl,
          storage_path: storagePath,
          is_featured: form.is_featured,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setUploadError(json.error || 'Kayıt başarısız.')
        return
      }

      closeModal()
      fetchItems()
      logAudit({ businessId: businessId!, staffId: staffId || null, staffName: staffName || null, action: 'create', resource: 'portfolio', details: { title: form.title.trim() } })
    } catch (err) {
      setUploadError('Beklenmeyen hata oluştu.')
    } finally {
      setUploading(false)
    }
  }

  async function toggleFeatured(item: PortfolioItem) {
    const res = await fetch(`/api/portfolio?id=${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_featured: !item.is_featured }),
    })
    if (res.ok) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_featured: !item.is_featured } : i))
      )
    }
  }

  async function handleDelete(id: string) {
    const item = items.find(i => i.id === id)
    const res = await fetch(`/api/portfolio?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id))
      closeDeleteConfirm()
      logAudit({ businessId: businessId!, staffId: staffId || null, staffName: staffName || null, action: 'delete', resource: 'portfolio', details: { title: item?.title || null } })
    }
  }

  async function handleAnalyze(item: PortfolioItem) {
    if (!businessId || !item.image_url) return
    setAnalyzingId(item.id)
    setAnalysisItem(item)
    try {
      const res = await fetch('/api/ai/photo-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          imageUrl: item.image_url,
          title: item.title,
          category: item.category,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setAnalysisResult(json.analysis)
        setShowAnalysis(true)
      } else {
        setAnalysisResult(json.error || 'Analiz yapılamadı')
        setShowAnalysis(true)
      }
    } catch {
      setAnalysisResult('Beklenmeyen bir hata oluştu')
      setShowAnalysis(true)
    } finally {
      setAnalyzingId(null)
    }
  }

  requireSectorModule(sector, 'portfolio')
  requirePermission(permissions, 'portfolio')

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Çalışma Galerisi</h1>
          <p className="text-sm text-gray-500 mt-1">Çalışmalarınızı sergileyin</p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Yeni Görsel Ekle
        </button>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {cat === 'all' ? 'Tümü' : cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <ImageIcon className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 text-lg font-medium">Henüz portfolyo görseli eklenmedi.</p>
          <p className="text-gray-400 text-sm mt-1">İlk görselinizi ekleyin!</p>
          <button
            onClick={openModal}
            className="mt-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Görsel Ekle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="relative group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md dark:hover:border-blue-500/40 transition-all"
            >
              {/* Image or placeholder */}
              <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-10 h-10 text-gray-300" />
                  </div>
                )}

                {/* Overlay actions */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  {item.image_url && (
                    <button
                      onClick={() => handleAnalyze(item)}
                      disabled={analyzingId === item.id}
                      title="AI Analiz"
                      className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors disabled:opacity-60"
                    >
                      {analyzingId === item.id ? (
                        <Loader2 className="w-4 h-4 text-pulse-900 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-pulse-900" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => toggleFeatured(item)}
                    title={item.is_featured ? 'Öne çıkarmayı kaldır' : 'Öne çıkar'}
                    className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                  >
                    <Star
                      className={`w-4 h-4 ${item.is_featured ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'}`}
                    />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(item.id)}
                    title="Sil"
                    className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>

                {/* Featured badge */}
                {item.is_featured && (
                  <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3 fill-yellow-900" />
                    Öne Çıkan
                  </div>
                )}
              </div>

              {/* Card body */}
              <div className="p-3">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{item.title}</p>
                {item.category && (
                  <span className="badge-info mt-1 gap-1">
                    <Tag className="w-3 h-3" />
                    {item.category}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showModal && (
        <Portal>
        <div className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/50 dark:bg-black/70 p-4 modal-overlay ${isClosingModal ? 'closing' : ''}`} onAnimationEnd={() => { if (isClosingModal) onModalClosed() }}>
          <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md modal-content ${isClosingModal ? 'closing' : ''}`}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Yeni Görsel Ekle</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Drag-drop zone */}
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onFileChange}
                />
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Önizleme"
                    className="max-h-36 rounded-lg object-contain"
                  />
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500 text-center">
                      Görseli buraya sürükleyin veya{' '}
                      <span className="text-blue-600 font-medium">seçin</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP desteklenir</p>
                  </>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Başlık <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Çalışma başlığı"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kategori</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="ör. Portre, Dövme, Düğün..."
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Açıklama</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="İsteğe bağlı açıklama..."
                  rows={3}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Featured toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className={`w-4 h-4 ${form.is_featured ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Öne Çıkar</span>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, is_featured: !f.is_featured }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.is_featured ? 'bg-yellow-400' : 'bg-gray-200 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      form.is_featured ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {uploadError && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{uploadError}</p>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closeModal}
                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !form.title.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Yükleniyor...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Yükle
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* AI Analysis Modal */}
      {showAnalysis && analysisItem && (
        <Portal>
        <div className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/50 dark:bg-black/70 p-4 modal-overlay ${isClosingAnalysis ? 'closing' : ''}`} onAnimationEnd={() => { if (isClosingAnalysis) onAnalysisClosed() }}>
          <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto modal-content ${isClosingAnalysis ? 'closing' : ''}`}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-pulse-900" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">AI Görsel Analizi</h2>
              </div>
              <button onClick={closeAnalysis} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Image preview */}
              {analysisItem.image_url && (
                <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={analysisItem.image_url} alt={analysisItem.title} className="w-full max-h-48 object-cover" />
                </div>
              )}
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{analysisItem.title}</p>

              {/* Analysis result */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {analysisResult}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closeAnalysis}
                className="w-full bg-pulse-900 hover:bg-pulse-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Delete confirm dialog */}
      {deleteConfirm && (
        <Portal>
        <div className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/50 dark:bg-black/70 p-4 modal-overlay ${isClosingDeleteConfirm ? 'closing' : ''}`} onAnimationEnd={() => { if (isClosingDeleteConfirm) { setDeleteConfirm(null); setIsClosingDeleteConfirm(false) } }}>
          <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm p-6 modal-content ${isClosingDeleteConfirm ? 'closing' : ''}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Görseli Sil</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Bu işlem geri alınamaz.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => closeDeleteConfirm()}
                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  )
}
