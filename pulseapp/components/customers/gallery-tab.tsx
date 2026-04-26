'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Camera, Clock, Globe2, ImageOff, Loader2, Plus, Sparkles, Trash2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { BeforeAfterUpload } from './before-after-upload'
import { PhotoLightbox, type LightboxPhoto } from '@/app/portal/[businessId]/dashboard/_components/photo-lightbox'

type AppointmentStatusForGallery = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'

interface Photo extends LightboxPhoto {
  pair_id?: string | null
  session_id?: string | null
  is_public?: boolean | null
  ai_analysis?: AIAnalysis | null
}

interface AIAnalysis {
  text: string
  generatedAt: string
}

interface GalleryTabProps {
  customerId: string
  canWrite: boolean
  /** Opsiyonel — randevu detayından açılırsa bu randevuya bağlı fotoğraflar yüklenir/listelenir. */
  appointmentId?: string
  /** appointmentId varsa true: yalnızca o randevunun fotoğraflarını listele. */
  filterByAppointment?: boolean
  /**
   * Randevu durumu — verilirse foto yükleme bu kurallara göre kısıtlanır:
   * - pending  → Foto bölümü gizli (onay bekliyor mesajı)
   * - confirmed → Sadece "öncesi" + "süreç" yüklenebilir
   * - completed → Hepsi (öncesi + sonrası + süreç)
   * - cancelled / no_show → Foto bölümü gizli
   */
  appointmentStatus?: AppointmentStatusForGallery
}

function toast(type: 'success' | 'error', title: string, body?: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type, title, body } }))
}

interface Pair { key: string; before?: Photo; after?: Photo }

export function GalleryTab({ customerId, canWrite, appointmentId, filterByAppointment, appointmentStatus }: GalleryTabProps) {
  const { confirm } = useConfirm()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [active, setActive] = useState<LightboxPhoto | null>(null)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [analyzingPair, setAnalyzingPair] = useState<string | null>(null)

  // Status'e göre yükleme kısıtı
  const uploadAllowedTypes: Array<'before' | 'after' | 'progress'> | undefined = (() => {
    if (!appointmentStatus) return undefined // randevu bağlamı yok → hepsi açık
    if (appointmentStatus === 'confirmed') return ['before', 'progress']
    if (appointmentStatus === 'completed') return undefined // hepsi
    return [] // pending / cancelled / no_show → yükleme yok
  })()
  const canUpload = canWrite && (uploadAllowedTypes === undefined || uploadAllowedTypes.length > 0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ customerId })
      if (filterByAppointment && appointmentId) params.set('appointmentId', appointmentId)
      const res = await fetch(`/api/photos?${params.toString()}`)
      const json = await res.json()
      if (res.ok) setPhotos(json.photos || [])
      else toast('error', 'Fotoğraflar yüklenemedi', json.error)
    } catch (e) {
      toast('error', 'Fotoğraflar yüklenemedi', e instanceof Error ? e.message : undefined)
    } finally {
      setLoading(false)
    }
  }, [customerId, appointmentId, filterByAppointment])

  useEffect(() => { load() }, [load])

  const { pairs, singles } = useMemo(() => groupPhotos(photos), [photos])

  function markBusy(id: string, on: boolean) {
    setBusyIds(prev => {
      const next = new Set(prev)
      if (on) next.add(id); else next.delete(id)
      return next
    })
  }

  async function togglePublic(photo: Photo) {
    const nextPublic = !photo.is_public
    markBusy(photo.id, true)
    try {
      const res = await fetch(`/api/photos/${photo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: nextPublic }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, is_public: nextPublic } : p))
      toast('success', nextPublic ? 'Portfolio\'ya yayımlandı' : 'Portfolio\'dan kaldırıldı')
    } catch (e) {
      toast('error', 'Güncellenemedi', e instanceof Error ? e.message : undefined)
    } finally {
      markBusy(photo.id, false)
    }
  }

  async function remove(photo: Photo) {
    const ok = await confirm({
      title: 'Fotoğrafı sil',
      message: 'Bu fotoğraf kalıcı olarak silinecek. Emin misiniz?',
      confirmText: 'Sil',
      variant: 'danger',
    })
    if (!ok) return
    markBusy(photo.id, true)
    try {
      const res = await fetch(`/api/photos/${photo.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error)
      setPhotos(prev => prev.filter(p => p.id !== photo.id))
      toast('success', 'Fotoğraf silindi')
    } catch (e) {
      toast('error', 'Silinemedi', e instanceof Error ? e.message : undefined)
    } finally {
      markBusy(photo.id, false)
    }
  }

  async function analyzePair(pair: Pair) {
    if (!pair.before || !pair.after) {
      toast('error', 'AI analizi için öncesi ve sonrası gerekli')
      return
    }
    setAnalyzingPair(pair.key)
    try {
      const res = await fetch('/api/ai/before-after', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beforeUrl: pair.before.photo_url,
          afterUrl: pair.after.photo_url,
          customerId,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      const aiAnalysis: AIAnalysis = { text: json.analysis, generatedAt: new Date().toISOString() }
      const target = pair.after
      const patchRes = await fetch(`/api/photos/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_analysis: aiAnalysis }),
      })
      if (!patchRes.ok) {
        const err = await patchRes.json().catch(() => ({}))
        throw new Error(err.error)
      }
      setPhotos(prev => prev.map(p => p.id === target.id ? { ...p, ai_analysis: aiAnalysis } : p))
      toast('success', 'AI analizi tamamlandı')
    } catch (e) {
      toast('error', 'Analiz yapılamadı', e instanceof Error ? e.message : undefined)
    } finally {
      setAnalyzingPair(null)
    }
  }

  // Pending: hiç gösterme — onay bekleniyor mesajı
  if (appointmentStatus === 'pending') {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-start gap-3">
        <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-amber-900 dark:text-amber-200">Onay bekleniyor</p>
          <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
            Randevu onaylandığında öncesi fotoğrafları yüklenebilecek.
          </p>
        </div>
      </div>
    )
  }

  // Cancelled / no-show: hiç gösterme — bilgilendir
  if (appointmentStatus === 'cancelled' || appointmentStatus === 'no_show') {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-4 flex items-start gap-3">
        <XCircle className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-gray-700 dark:text-gray-300">
            {appointmentStatus === 'cancelled' ? 'Randevu iptal edildi' : 'Randevu gerçekleşmedi'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Bu randevuya fotoğraf eklenemiyor.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          <Camera className="h-4 w-4 text-pulse-900" />
          Galeri
          {!loading && <span className="text-xs text-gray-500 dark:text-gray-400">({photos.length})</span>}
        </div>
        {canUpload && (
          <button onClick={() => setUploadOpen(true)} className="btn-primary text-xs py-1.5">
            <Plus className="h-3.5 w-3.5 mr-1" />Fotoğraf Ekle
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-pulse-900" />
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ImageOff className="h-10 w-10 text-gray-300 dark:text-gray-700 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Henüz fotoğraf yok.</p>
          {canWrite && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Üstteki butondan öncesi/sonrası çifti ekleyebilirsiniz.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {pairs.length > 0 && (
            <div className="space-y-3">
              {pairs.map(pair => {
                const analysis = pair.after?.ai_analysis || pair.before?.ai_analysis
                const analyzing = analyzingPair === pair.key
                return (
                  <div key={pair.key} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="grid grid-cols-2 gap-1 bg-gray-100 dark:bg-gray-800">
                      <PhotoCell
                        label="Öncesi"
                        photo={pair.before}
                        busy={pair.before ? busyIds.has(pair.before.id) : false}
                        canWrite={canWrite}
                        onOpen={setActive}
                        onTogglePublic={togglePublic}
                        onDelete={remove}
                      />
                      <PhotoCell
                        label="Sonrası"
                        photo={pair.after}
                        busy={pair.after ? busyIds.has(pair.after.id) : false}
                        canWrite={canWrite}
                        onOpen={setActive}
                        onTogglePublic={togglePublic}
                        onDelete={remove}
                      />
                    </div>
                    {(canWrite || analysis) && (
                      <div className="p-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 space-y-2">
                        {analysis && (
                          <div className="rounded-lg bg-pulse-50 dark:bg-pulse-900/20 p-2.5">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-pulse-900 dark:text-pulse-300 mb-1">
                              <Sparkles className="h-3.5 w-3.5" />AI Analizi
                            </div>
                            <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{analysis.text}</p>
                          </div>
                        )}
                        {canWrite && pair.before && pair.after && (
                          <button
                            onClick={() => analyzePair(pair)}
                            disabled={analyzing}
                            className="w-full btn-secondary text-xs py-1.5 disabled:opacity-60"
                          >
                            {analyzing ? (
                              <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Analiz ediliyor…</>
                            ) : (
                              <><Sparkles className="h-3.5 w-3.5 mr-1" />{analysis ? 'Yeniden Analiz Et' : 'AI Analizi Çalıştır'}</>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {singles.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {singles.map(p => (
                <PhotoCell
                  key={p.id}
                  photo={p}
                  busy={busyIds.has(p.id)}
                  canWrite={canWrite}
                  rounded
                  onOpen={setActive}
                  onTogglePublic={togglePublic}
                  onDelete={remove}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <BeforeAfterUpload
        customerId={customerId}
        appointmentId={appointmentId}
        allowedTypes={uploadAllowedTypes}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={load}
      />
      <PhotoLightbox photo={active} onClose={() => setActive(null)} />
    </div>
  )
}

// pair_id → before/after eşleştirme; portal'dan gelen session_id de fallback anahtar
function groupPhotos(photos: Photo[]): { pairs: Pair[]; singles: Photo[] } {
  const byKey: Record<string, Pair> = {}
  const singles: Photo[] = []
  for (const p of photos) {
    const key = p.pair_id || p.session_id
    const pairable = key && (p.photo_type === 'before' || p.photo_type === 'after')
    if (pairable) {
      byKey[key] = byKey[key] || { key }
      if (p.photo_type === 'before') byKey[key].before = p
      else byKey[key].after = p
    } else {
      singles.push(p)
    }
  }
  return { pairs: Object.values(byKey), singles }
}

interface PhotoCellProps {
  photo?: Photo
  label?: string
  busy: boolean
  canWrite: boolean
  rounded?: boolean
  onOpen: (p: LightboxPhoto) => void
  onTogglePublic: (p: Photo) => void
  onDelete: (p: Photo) => void
}

function PhotoCell({ photo, label, busy, canWrite, rounded, onOpen, onTogglePublic, onDelete }: PhotoCellProps) {
  if (!photo) {
    return (
      <div className="relative aspect-square bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
        <span className="text-[11px] text-gray-500 dark:text-gray-400">Bekleniyor</span>
        {label && (
          <span className="absolute top-2 left-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/80 dark:bg-gray-900/80 text-gray-700 dark:text-gray-300">
            {label}
          </span>
        )}
      </div>
    )
  }
  return (
    <div className={cn('relative aspect-square group', rounded && 'rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800')}>
      <Image src={photo.photo_url} alt={label ?? ''} fill className="object-cover group-hover:opacity-90 transition-opacity" />
      <button onClick={() => onOpen(photo)} aria-label={label ? `${label} fotoğrafını aç` : 'Fotoğrafı aç'} className="absolute inset-0 w-full h-full" />
      {label && (
        <span className="absolute top-2 left-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/60 text-white pointer-events-none">
          {label}
        </span>
      )}
      {canWrite && (
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePublic(photo) }}
            disabled={busy}
            title={photo.is_public ? 'Portfolio\'dan kaldır' : 'Portfolio\'ya yayımla'}
            className={cn(
              'p-1 rounded-md backdrop-blur-sm disabled:opacity-60',
              photo.is_public ? 'bg-emerald-500/90 text-white' : 'bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-300 hover:text-emerald-600'
            )}
          >
            <Globe2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(photo) }}
            disabled={busy}
            title="Sil"
            className="p-1 rounded-md bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-300 hover:text-red-600 backdrop-blur-sm disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
