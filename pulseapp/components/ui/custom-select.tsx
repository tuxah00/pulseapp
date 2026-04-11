'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
}

interface CustomSelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  /** Boş seçenek etiketi — verilirse dropdown'ın en üstünde gösterilir */
  placeholder?: string
  className?: string
  disabled?: boolean
  /** Dropdown'ı yukarı doğru açar (modal alt kısmında kullanım için) */
  dropUp?: boolean
}

/**
 * Native <select> yerine geçen, FilterPopoverList / SortPopoverContent
 * ile aynı görsel stile sahip özel açılır liste bileşeni.
 *
 * Dropdown portal ile render edilir — overflow:hidden içinde de düzgün çalışır.
 */
export function CustomSelect({
  options,
  value,
  onChange,
  placeholder,
  className,
  disabled,
  dropUp,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const selected = options.find(o => o.value === value)

  const updatePosition = useCallback(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    if (dropUp) {
      setPos({ top: rect.top - 4, left: rect.left, width: rect.width })
    } else {
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
  }, [dropUp])

  useEffect(() => {
    if (!open) return
    updatePosition()
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (ref.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function handleScroll() { updatePosition() }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleScroll)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleScroll)
    }
  }, [open, updatePosition])

  return (
    <div ref={ref} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { updatePosition(); setOpen(v => !v) } }}
        className={cn(
          'input w-full min-w-[140px] flex items-center justify-between gap-2 text-left',
          !selected && placeholder && 'text-gray-400 dark:text-gray-500',
          disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
        )}
      >
        <span className="truncate">
          {selected?.label ?? placeholder ?? 'Seçin...'}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-150',
            open && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown panel — portal ile body'ye render edilir */}
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: dropUp ? undefined : pos.top, bottom: dropUp ? `calc(100vh - ${pos.top}px)` : undefined, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl overflow-hidden"
        >
          <div className="max-h-52 overflow-y-auto py-1">
            {/* Placeholder / "Tümü" seçeneği */}
            {placeholder !== undefined && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false) }}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between gap-2',
                  !value
                    ? 'bg-pulse-50 text-pulse-900 dark:bg-pulse-900/30 dark:text-pulse-300 font-medium'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
              >
                <span>{placeholder || 'Tümü'}</span>
                {!value && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
              </button>
            )}

            {/* Seçenekler */}
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between gap-2',
                  value === opt.value
                    ? 'bg-pulse-50 text-pulse-900 dark:bg-pulse-900/30 dark:text-pulse-300 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
              >
                <span className="truncate">{opt.label}</span>
                {value === opt.value && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
