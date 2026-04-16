'use client'

interface GroupSectionProps {
  title: string
  description?: string
  icon?: React.ReactNode
  children: React.ReactNode
}

export function GroupSection({ title, description, icon, children }: GroupSectionProps) {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start gap-2">
        {icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pulse-100 dark:bg-pulse-900/30 text-pulse-900 dark:text-pulse-400 shrink-0">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}
