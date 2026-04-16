'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { FolderHeart, Image as ImageIcon, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FileCard, FileDetailModal, type PortalRecord } from '../_components/file-card'
import { PhotoLightbox, type LightboxPhoto } from '../_components/photo-lightbox'
import { SectionHeader } from '../_components/section-header'
import { getFilesPageTitle, getFilesPageSubtitle } from '@/lib/portal/sector-labels'

interface PhotoRow extends LightboxPhoto {
  session_id?: string | null
  protocol_id?: string | null
}

const PHOTO_FILTERS: Array<{ key: string; label: string; match: (t: string) => boolean }> = [
  { key: 'all', label: 'Hepsi', match: () => true },
  { key: 'before', label: 'Öncesi', match: (t) => t === 'before' },
  { key: 'after', label: 'Sonrası', match: (t) => t === 'after' },
  { key: 'xray', label: 'Röntgen', match: (t) => t === 'xray' },
  { key: 'panoramic', label: 'Panoramik', match: (t) => t === 'panoramic' },
  { key: 'progress', label: 'Süreç', match: (t) => t === 'progress' },
]

export default function PortalFilesPage() {
  const params = useParams()
  const businessId = params.businessId as string

  const [tab, setTab] = useState<'records' | 'photos'>('records')
  const [records, setRecords] = useState<PortalRecord[]>([])
  const [photos, setPhotos] = useState<PhotoRow[]>([])
  const [sector, setSector] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [activeRecord, setActiveRecord] = useState<PortalRecord | null>(null)
  const [activePhoto, setActivePhoto] = useState<LightboxPhoto | null>(null)
  const [photoFilter, setPhotoFilter] = useState<string>('all')

  useEffect(() => {
    (async () => {
      try {
        const [meRes, recRes, phRes] = await Promise.all([
          fetch('/api/portal/me'),
          fetch('/api/portal/records'),
          fetch('/api/portal/photos'),
        ])
        if (meRes.ok) {
          const data = await meRes.json()
          setSector(data.business?.sector ?? null)
        }
        if (recRes.ok) {
          const data = await recRes.json()
          setRecords(data.records || [])
        }
        if (phRes.ok) {
          const data = await phRes.json()
          setPhotos(data.photos || [])
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const title = getFilesPageTitle(sector)
  const subtitle = getFilesPageSubtitle(sector)

  const filteredPhotos = useMemo(() => {
    const f = PHOTO_FILTERS.find((x) => x.key === photoFilter)
    if (!f) return photos
    return photos.filter((p) => f.match(p.photo_type))
  }, [photos, photoFilter])

  // Aktif filtrenin hangi tipleri içerdiğini say
  const photoCounts = useMemo(() => {
    const counts: Record<string, number> = { all: photos.length }
    for (const p of photos) {
      counts[p.photo_type] = (counts[p.photo_type] || 0) + 1
    }
    return counts
  }, [photos])

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-serif font-bold text-gray-900 dark:text-gray-100">{title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
      </div>

      {/* Tabs */}
      <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
        <button
          onClick={() => setTab('records')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2',
            tab === 'records'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          )}
        >
          <FolderHeart className="h-4 w-4" />
          Kayıtlar
          {records.length > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-pulse-900/10 dark:bg-pulse-900/30 text-pulse-900 dark:text-pulse-300">
              {records.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('photos')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2',
            tab === 'photos'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          )}
        >
          <ImageIcon className="h-4 w-4" />
          Fotoğraflar
          {photos.length > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-pulse-900/10 dark:bg-pulse-900/30 text-pulse-900 dark:text-pulse-300">
              {photos.length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : tab === 'records' ? (
        records.length === 0 ? (
          <EmptyCard icon={FolderHeart} title="Henüz kayıt yok" description="İşletme senin için dosya eklediğinde burada görünecek." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {records.map((r) => (
              <FileCard key={r.id} record={r} onClick={() => setActiveRecord(r)} />
            ))}
          </div>
        )
      ) : (
        <div>
          {/* Filtreler */}
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {PHOTO_FILTERS.map((f) => {
                const count = f.key === 'all' ? photos.length : (photoCounts[f.key] || 0)
                if (f.key !== 'all' && count === 0) return null
                return (
                  <button
                    key={f.key}
                    onClick={() => setPhotoFilter(f.key)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                      photoFilter === f.key
                        ? 'bg-pulse-900 text-white border-pulse-900 dark:bg-pulse-700 dark:border-pulse-700'
                        : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-pulse-900/40'
                    )}
                  >
                    {f.label}
                    <span className="ml-1 opacity-70">{count}</span>
                  </button>
                )
              })}
            </div>
          )}

          {filteredPhotos.length === 0 ? (
            <EmptyCard icon={ImageIcon} title="Fotoğraf yok" description="Bu kategoride fotoğraf bulunmuyor." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredPhotos.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActivePhoto(p)}
                  className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 hover:ring-2 hover:ring-pulse-900 transition-all group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.photo_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <span className="absolute bottom-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/60 text-white capitalize">
                    {PHOTO_FILTERS.find((f) => f.key === p.photo_type)?.label || p.photo_type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <FileDetailModal
        record={activeRecord}
        onClose={() => setActiveRecord(null)}
        onImageClick={(url) => {
          // Record detayındaki resimlere tıklanınca lightbox'ta aç
          setActivePhoto({ id: `rec-${url}`, photo_url: url, photo_type: 'progress' })
        }}
      />
      <PhotoLightbox photo={activePhoto} onClose={() => setActivePhoto(null)} />
    </div>
  )
}

interface EmptyCardProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}
function EmptyCard({ icon: Icon, title, description }: EmptyCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-10 text-center">
      <div className="h-14 w-14 rounded-full bg-pulse-900/5 dark:bg-pulse-900/20 flex items-center justify-center mx-auto mb-3">
        <Icon className="h-7 w-7 text-pulse-900/50 dark:text-pulse-300" />
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
    </div>
  )
}
