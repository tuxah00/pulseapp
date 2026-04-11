'use client'

import { useState, useRef, useEffect } from 'react'
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
 * Kullanım:
 * ```tsx
 * <CustomSelect
 *   options={[{ value: 'pending', label: 'Bekleyen' }, ...]}
 *   value={status}
 *   onChange={setStatus}
 *   placeholder="Tümü"
 * />
 * ```
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
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
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
    <div ref={ref} className={cn('relative', open && 'z-[70]', className)}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
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

      {/* Dropdown panel */}
      {open && (
        <div className={cn(
          'absolute left-0 right-0 z-[200] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl overflow-hidden modal-content',
          dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
        )}>
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
        </div>
      )}
    </div>
  )
}
