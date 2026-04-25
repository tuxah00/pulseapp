'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { X, Calendar, Tag, Folder, ArrowRight } from 'lucide-react'

export interface LightboxPhoto {
  id: string
  photo_url: string
  photo_type: string
  tags?: string[] | null
  notes?: string | null
  taken_at?: string | null
  created_at?: string | null
  is_from_record?: boolean
  record_id?: string
  record_title?: string
}

const TYPE_LABELS: Record<string, string> = {
  before: 'Öncesi',
  after: 'Sonrası',
  progress: 'Süreç',
  xray: 'Röntgen',
  panoramic: 'Panoramik',
}

interface PhotoLightboxProps {
  photo: LightboxPhoto | null
  onClose: () => void
  onOpenRecord?: (recordId: string) => void
}

export function PhotoLightbox({ photo, onClose, onOpenRecord }: PhotoLightboxProps) {
  useEffect(() => {
    if (!photo) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [photo, onClose])

  if (!photo) return null

  const taken = photo.taken_at || photo.created_at
  const takenDate = taken ? new Date(taken).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Kapat"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="max-w-4xl w-full max-h-[90vh] flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <Image
          src={photo.photo_url}
          alt={TYPE_LABELS[photo.photo_type] || 'Fotoğraf'}
          width={1200}
          height={900}
          className="max-h-[70vh] w-auto mx-auto rounded-xl object-contain shadow-2xl"
          style={{ height: 'auto' }}
        />

        <div className="bg-white/95 dark:bg-gray-900/95 rounded-xl p-4 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pulse-900/10 dark:bg-pulse-900/30 text-pulse-900 dark:text-pulse-200 font-medium text-xs">
              {TYPE_LABELS[photo.photo_type] || photo.photo_type}
            </span>
            {photo.is_from_record && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-medium text-xs">
                <Folder className="h-3 w-3" />
                {photo.record_title || 'Hasta Dosyası'}
              </span>
            )}
            {takenDate && (
              <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400 text-xs">
                <Calendar className="h-3.5 w-3.5" />
                {takenDate}
              </span>
            )}
            {photo.tags && photo.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-gray-400" />
                {photo.tags.map((t, i) => (
                  <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
          {photo.notes && (
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{photo.notes}</p>
          )}
          {photo.is_from_record && photo.record_id && onOpenRecord && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => onOpenRecord(photo.record_id!)}
                className="inline-flex items-center gap-1 text-xs font-medium text-pulse-900 dark:text-pulse-300 hover:underline"
              >
                Kayıtta Aç
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
