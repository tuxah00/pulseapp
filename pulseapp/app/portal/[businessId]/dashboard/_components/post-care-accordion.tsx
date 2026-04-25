'use client'

import { useState } from 'react'
import { Sparkles, ChevronDown, FileText, ExternalLink, Download } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PostCareFile {
  url: string
  name?: string
  type?: string
}

interface PostCareAccordionProps {
  notes: string | null
  files: PostCareFile[] | null
  /** Varsayılan kapalı; manuel açılır */
  defaultOpen?: boolean
}

/**
 * Tedavi seansı sonrası bakım talimatlarını gösterir.
 *
 * Tedavi protokollerinde (estetik+diş kliniği) tamamlanan seansların
 * altında accordion olarak gösterilir. Markdown render etmez — düz metin
 * olarak whitespace-preserve eder; satır kırılımı bilinçli korunur.
 */
export default function PostCareAccordion({
  notes,
  files,
  defaultOpen = false,
}: PostCareAccordionProps) {
  const [open, setOpen] = useState(defaultOpen)

  const validFiles = (files || []).filter(
    (f): f is PostCareFile => !!f && typeof f.url === 'string' && f.url.length > 0
  )
  const hasContent = !!notes?.trim() || validFiles.length > 0

  if (!hasContent) return null

  return (
    <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-900/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left hover:bg-emerald-100/50 dark:hover:bg-emerald-900/20 transition-colors"
      >
        <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <span className="flex-1 text-sm font-medium text-emerald-900 dark:text-emerald-200">
          Bakım Talimatları
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-emerald-600 dark:text-emerald-400 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && (
        <div className="px-3.5 py-3 border-t border-emerald-100 dark:border-emerald-900/40 space-y-3">
          {notes && (
            <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
              {notes}
            </div>
          )}
          {validFiles.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {validFiles.map((f, idx) => {
                const name = f.name || `Belge ${idx + 1}`
                const isImg = f.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(f.url)
                const isVideo = f.type?.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(f.url)
                const Icon = isImg || isVideo ? ExternalLink : Download
                return (
                  <a
                    key={idx}
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="flex-1 truncate">{name}</span>
                    <Icon className="h-3 w-3 flex-shrink-0" />
                  </a>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
