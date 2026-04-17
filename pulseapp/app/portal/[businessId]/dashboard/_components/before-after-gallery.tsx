'use client'

import { useMemo, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { PhotoLightbox, type LightboxPhoto } from './photo-lightbox'

interface Photo extends LightboxPhoto {
  session_id?: string | null
}

interface BeforeAfterGalleryProps {
  photos: Photo[]
}

/**
 * Aynı session_id'ye ait öncesi/sonrası fotoğrafları yan yana eşleştirir.
 * Ayrı fotoğraflar (progress) alt satırda ayrı grid olarak gösterilir.
 */
export function BeforeAfterGallery({ photos }: BeforeAfterGalleryProps) {
  const [active, setActive] = useState<LightboxPhoto | null>(null)

  const { pairs, singles } = useMemo(() => {
    const bySession: Record<string, { before?: Photo; after?: Photo }> = {}
    const lone: Photo[] = []
    for (const p of photos) {
      if (p.session_id && (p.photo_type === 'before' || p.photo_type === 'after')) {
        bySession[p.session_id] = bySession[p.session_id] || {}
        if (p.photo_type === 'before') bySession[p.session_id].before = p
        else bySession[p.session_id].after = p
      } else {
        lone.push(p)
      }
    }
    const pairs = Object.entries(bySession).map(([sid, { before, after }]) => ({ sid, before, after }))
    return { pairs, singles: lone }
  }, [photos])

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <ImageOff className="h-8 w-8 text-gray-300 dark:text-gray-700 mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Henüz öncesi/sonrası fotoğrafı yok.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {pairs.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {pairs.map(({ sid, before, after }) => (
            <div key={sid} className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
              <PairCell label="Öncesi" photo={before} onClick={setActive} />
              <PairCell label="Sonrası" photo={after} onClick={setActive} />
            </div>
          ))}
        </div>
      )}

      {singles.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {singles.map((p) => (
            <button
              key={p.id}
              onClick={() => setActive(p)}
              className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 hover:ring-2 hover:ring-pulse-900 transition-all"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.photo_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <PhotoLightbox photo={active} onClose={() => setActive(null)} />
    </div>
  )
}

interface PairCellProps {
  label: string
  photo?: Photo
  onClick: (p: LightboxPhoto) => void
}

function PairCell({ label, photo, onClick }: PairCellProps) {
  if (!photo) {
    return (
      <div className="relative aspect-square bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
        <span className="text-[11px] text-gray-500 dark:text-gray-400">Bekleniyor</span>
        <span className="absolute top-2 left-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/80 dark:bg-gray-900/80 text-gray-700 dark:text-gray-300">
          {label}
        </span>
      </div>
    )
  }
  return (
    <button onClick={() => onClick(photo)} className="relative aspect-square group">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.photo_url} alt={label} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
      <span className="absolute top-2 left-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/60 text-white">
        {label}
      </span>
    </button>
  )
}
