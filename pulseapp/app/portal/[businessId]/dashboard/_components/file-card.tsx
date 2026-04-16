'use client'

import { FileText, Image as ImageIcon, Folder, ChevronRight } from 'lucide-react'

export interface PortalRecord {
  id: string
  type: string
  title: string
  data: Record<string, any>
  created_at: string
}

const TYPE_LABELS: Record<string, string> = {
  patient_file: 'Hasta Dosyası',
  client_file: 'Danışan Dosyası',
  case_file: 'Dava Dosyası',
  pet: 'Evcil Hayvan',
  vehicle: 'Araç',
  diet_plan: 'Beslenme Planı',
  student: 'Öğrenci Dosyası',
}

const TYPE_ICONS: Record<string, typeof Folder> = {
  patient_file: Folder,
  client_file: Folder,
  case_file: FileText,
  pet: Folder,
  vehicle: Folder,
  diet_plan: FileText,
  student: FileText,
}

function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|webp|gif|heic|heif|bmp|svg)(\?|$)/i.test(url)
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return iso
  }
}

interface FileCardProps {
  record: PortalRecord
  onClick: () => void
}

export function FileCard({ record, onClick }: FileCardProps) {
  const Icon = TYPE_ICONS[record.type] || Folder
  const label = TYPE_LABELS[record.type] || 'Dosya'
  const files: string[] = Array.isArray(record.data?.file_urls) ? record.data.file_urls : []
  const thumbnails = files.filter(isImageUrl).slice(0, 3)

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 hover:shadow-md hover:border-pulse-900/30 dark:hover:border-pulse-700 transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-xl bg-pulse-900/5 dark:bg-pulse-900/20 flex items-center justify-center flex-shrink-0">
          <Icon className="h-5 w-5 text-pulse-900/70 dark:text-pulse-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">{record.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] font-medium text-pulse-900 dark:text-pulse-300 uppercase tracking-wide">
              {label}
            </span>
            <span className="text-gray-300 dark:text-gray-700">·</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(record.created_at)}</span>
          </div>
          {files.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{files.length} dosya</p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-pulse-900 dark:group-hover:text-pulse-300 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
      </div>

      {thumbnails.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {thumbnails.map((url, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={i}
              src={url}
              alt=""
              loading="lazy"
              decoding="async"
              className="aspect-square w-full rounded-lg object-cover bg-gray-100 dark:bg-gray-800"
            />
          ))}
        </div>
      )}
    </button>
  )
}

interface FileDetailModalProps {
  record: PortalRecord | null
  onClose: () => void
  onImageClick?: (url: string) => void
}

export function FileDetailModal({ record, onClose, onImageClick }: FileDetailModalProps) {
  if (!record) return null

  const { file_urls = [], file_metadata = [], ...fields } = (record.data || {}) as any
  const files: string[] = Array.isArray(file_urls) ? file_urls : []
  const fieldEntries = Object.entries(fields).filter(
    ([k, v]) => !['file_urls', 'file_metadata', 'created_by_staff_id', 'created_by_staff_name'].includes(k) && v !== null && v !== undefined && v !== ''
  )

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 dark:bg-black/70 flex items-center justify-center p-4 modal-overlay"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-pulse-900 dark:text-pulse-300 uppercase tracking-wide">
              {TYPE_LABELS[record.type] || 'Dosya'}
            </p>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
              {record.title}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatDate(record.created_at)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          {fieldEntries.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Detaylar</h4>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {fieldEntries.map(([k, v]) => (
                  <div key={k} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <dt className="text-[11px] font-medium text-gray-500 dark:text-gray-400 capitalize">
                      {k.replace(/_/g, ' ')}
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100 mt-0.5 break-words">
                      {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {files.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Dosyalar ({files.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {files.map((url: string, i: number) => {
                  const meta = Array.isArray(file_metadata) ? file_metadata[i] : null
                  const isImg = isImageUrl(url)
                  return isImg ? (
                    <button
                      key={i}
                      onClick={() => onImageClick?.(url)}
                      className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 hover:ring-2 hover:ring-pulse-900 transition-all"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={meta?.name || ''} className="w-full h-full object-cover" />
                    </button>
                  ) : (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square rounded-lg bg-gray-50 dark:bg-gray-800/50 flex flex-col items-center justify-center p-3 hover:bg-pulse-900/5 dark:hover:bg-pulse-900/20 transition-colors border border-gray-100 dark:border-gray-800"
                    >
                      <FileText className="h-8 w-8 text-pulse-900/60 dark:text-pulse-300" />
                      <span className="mt-2 text-[11px] text-gray-700 dark:text-gray-300 text-center line-clamp-2 break-all">
                        {meta?.name || 'Dosya'}
                      </span>
                    </a>
                  )
                })}
              </div>
            </div>
          )}

          {fieldEntries.length === 0 && files.length === 0 && (
            <div className="text-center py-8">
              <ImageIcon className="h-10 w-10 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Bu kayıtta henüz detay yok.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
