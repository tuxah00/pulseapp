'use client'

import { cn } from '@/lib/utils'

interface CompactBoxCardProps {
  /** İki harflik baş harf (örn: "AK") */
  initials: string
  /** Kart başlığı / isim */
  title: string
  /** Avatar arka plan ve yazı rengi (ör: "bg-pulse-100 text-pulse-900") */
  colorClass?: string
  /** Rozet (rol etiketi vb.) */
  badge?: React.ReactNode
  /** İkinci satır bilgi (yetki sayısı, telefon vb.) */
  meta?: string
  /** Seçili durumu */
  selected?: boolean
  /** Tıklama olayı */
  onClick?: () => void
  /** Alt aksiyon butonları (ör: Düzenle, Sil) */
  children?: React.ReactNode
  className?: string
}

/**
 * Kompakt kare kart bileşeni — box görünüm için standart yapı.
 * Tüm box görünüm sayfalarında bu bileşen kullanılmalı.
 */
export default function CompactBoxCard({
  initials,
  title,
  colorClass = 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  badge,
  meta,
  selected,
  onClick,
  children,
  className,
}: CompactBoxCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'card p-2 cursor-pointer hover:shadow-md transition-all aspect-square flex flex-col items-center justify-center text-center',
        selected && 'ring-2 ring-pulse-900',
        className
      )}
    >
      {/* Avatar */}
      <div className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full font-bold text-xs flex-shrink-0',
        colorClass
      )}>
        {initials}
      </div>

      {/* İsim */}
      <p className="mt-1.5 text-xs font-medium text-gray-900 dark:text-gray-100 truncate w-full">
        {title}
      </p>

      {/* Rozet */}
      {badge && (
        <div className="mt-1 flex items-center justify-center gap-1 flex-wrap">
          {badge}
        </div>
      )}

      {/* Meta bilgi */}
      {meta && (
        <p className="text-[10px] text-gray-400 mt-1 truncate w-full">{meta}</p>
      )}

      {/* Aksiyon butonları */}
      {children && (
        <div
          className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 w-full flex items-center justify-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </div>
  )
}
