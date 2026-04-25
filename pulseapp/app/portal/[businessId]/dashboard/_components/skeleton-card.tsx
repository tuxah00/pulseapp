/**
 * Portal sayfaları için ortak iskelet (skeleton) loader.
 *
 * Spinner yerine içeriğin yapısını taklit eder — algılanan hız artar.
 * Mevcut sayfalarda <SkeletonList /> ya da <SkeletonCard /> ile kullanılır.
 */

import { cn } from '@/lib/utils'

interface SkeletonCardProps {
  className?: string
  /** Avatar/icon konumu (sol üstte yuvarlak placeholder). */
  withAvatar?: boolean
  /** Satır sayısı (text placeholder'ları). */
  lines?: number
}

export function SkeletonCard({ className, withAvatar = false, lines = 3 }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 animate-pulse',
        className
      )}
    >
      <div className="flex items-start gap-3">
        {withAvatar && (
          <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-800 flex-shrink-0" />
        )}
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-2/3" />
          {Array.from({ length: Math.max(0, lines - 1) }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-3 bg-gray-100 dark:bg-gray-800/70 rounded',
                i === lines - 2 ? 'w-1/3' : 'w-5/6'
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface SkeletonListProps {
  count?: number
  className?: string
  withAvatar?: boolean
  lines?: number
}

export function SkeletonList({ count = 3, className, withAvatar, lines }: SkeletonListProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} withAvatar={withAvatar} lines={lines} />
      ))}
    </div>
  )
}
