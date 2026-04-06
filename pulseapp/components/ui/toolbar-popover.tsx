'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ToolbarPopoverProps {
  icon: ReactNode
  label?: string
  active?: boolean
  children: ReactNode
  className?: string
}

export function ToolbarPopover({ icon, label, active, children, className }: ToolbarPopoverProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Click outside → close
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center justify-center rounded-lg transition-colors gap-1.5',
          label ? 'px-3 h-9 text-xs font-medium' : 'h-9 w-9',
          active
            ? 'bg-pulse-50 text-pulse-900 dark:bg-pulse-900/40 dark:text-pulse-300'
            : open
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
        )}
      >
        {icon}
        {label && <span>{label}</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl modal-content min-w-[220px]">
          {children}
        </div>
      )}
    </div>
  )
}

/* ── Filter list popover content ── */

interface FilterPopoverListProps {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
  allLabel?: string
}

export function FilterPopoverList({ label, options, value, onChange, allLabel = 'Tümü' }: FilterPopoverListProps) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <div className="space-y-0.5 max-h-36 overflow-y-auto">
        <button
          onClick={() => onChange('')}
          className={cn(
            'w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors',
            value === ''
              ? 'bg-pulse-50 text-pulse-900 dark:bg-pulse-900/30 dark:text-pulse-300 font-medium'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          )}
        >
          {allLabel}
        </button>
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors',
              value === opt.value
                ? 'bg-pulse-50 text-pulse-900 dark:bg-pulse-900/30 dark:text-pulse-300 font-medium'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Sort helper popover content ── */

interface SortOption {
  value: string
  label: string
}

interface SortPopoverContentProps {
  options: SortOption[]
  sortField: string | null
  sortDir: 'asc' | 'desc'
  onSortField: (field: string | null) => void
  onSortDir: (dir: 'asc' | 'desc') => void
}

export function SortPopoverContent({ options, sortField, sortDir, onSortField, onSortDir }: SortPopoverContentProps) {
  return (
    <div className="p-3 w-56 space-y-1">
      <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Sırala</p>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onSortField(sortField === opt.value ? null : opt.value)}
          className={cn(
            'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
            sortField === opt.value
              ? 'bg-pulse-50 text-pulse-900 dark:bg-pulse-900/30 dark:text-pulse-300 font-medium'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          )}
        >
          {opt.label}
        </button>
      ))}
      <div className="border-t border-gray-100 dark:border-gray-700 pt-2 mt-2 flex gap-1">
        <button
          onClick={() => onSortDir('asc')}
          className={cn(
            'flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            sortDir === 'asc'
              ? 'bg-pulse-50 text-pulse-900 dark:bg-pulse-900/30 dark:text-pulse-300'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
          )}
        >
          A→Z / Artan
        </button>
        <button
          onClick={() => onSortDir('desc')}
          className={cn(
            'flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            sortDir === 'desc'
              ? 'bg-pulse-50 text-pulse-900 dark:bg-pulse-900/30 dark:text-pulse-300'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
          )}
        >
          Z→A / Azalan
        </button>
      </div>
    </div>
  )
}
