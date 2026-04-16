'use client'

interface Milestone {
  kind: string
  title: string
  subtitle: string
}

interface MilestoneBannerProps {
  milestones: Milestone[]
}

export function MilestoneBanner({ milestones }: MilestoneBannerProps) {
  if (!milestones || milestones.length === 0) return null

  return (
    <div className="space-y-3">
      {milestones.map((m, i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-pink-50 dark:from-amber-900/20 dark:via-orange-900/20 dark:to-pink-900/20 border border-amber-200 dark:border-amber-900/40 p-5"
        >
          <div className="absolute -right-4 -top-4 text-6xl opacity-20 animate-pulse pointer-events-none">
            {m.kind === 'birthday' ? '🎂' : '🎉'}
          </div>
          <h3 className="relative font-serif text-lg font-bold text-amber-900 dark:text-amber-200">
            {m.title}
          </h3>
          <p className="relative text-sm text-amber-800/80 dark:text-amber-200/80 mt-1">
            {m.subtitle}
          </p>
        </div>
      ))}
    </div>
  )
}
