'use client'

import { useEffect, useMemo, useState } from 'react'
import NextImage from 'next/image'
import { useParams, useSearchParams } from 'next/navigation'
import { Folder, Image as ImageIcon, Stethoscope } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FileCard, FileDetailModal, type PortalRecord } from '../_components/file-card'
import { PhotoLightbox, type LightboxPhoto } from '../_components/photo-lightbox'
import { getFilesPageTitle, getFilesPageSubtitle } from '@/lib/portal/sector-labels'
import { SkeletonList } from '../_components/skeleton-card'

// API'den gelen ham fotoğraf satırı (protocol join dahil)
interface RawPhoto {
  id: string
  photo_url: string
  photo_type: string
  tags?: string[] | null
  notes?: string | null
  taken_at?: string | null
  created_at?: string | null
  protocol_id?: string | null
  session_id?: string | null
  protocol?: {
    id: string
    name: string
    service?: { id: string; name: string } | null
  } | null
}

interface PhotoRow extends LightboxPhoto {
  protocol_id?: string | null
  session_id?: string | null
}

// Protokol/hizmet grubunu temsil eder
interface PhotoGroup {
  key: string           // protocol_id veya 'general'
  serviceLabel: string  // Hizmet / protokol adı
  firstDate: string     // En erken çekilme tarihi (grup başlığında gösterilir)
  photos: PhotoRow[]
}

const TYPE_LABELS: Record<string, string> = {
  before: 'Öncesi',
  after: 'Sonrası',
  progress: 'Süreç',
  xray: 'Röntgen',
  panoramic: 'Panoramik',
}

// Filtre butonları — aktif filtre 0 fotoğrafa sahipse gizlenir
const PHOTO_FILTERS: Array<{ key: string; label: string; types: string[] }> = [
  { key: 'all',      label: 'Hepsi',    types: [] },
  { key: 'before',   label: 'Öncesi',   types: ['before'] },
  { key: 'after',    label: 'Sonrası',  types: ['after'] },
  { key: 'xray',     label: 'Röntgen',  types: ['xray'] },
  { key: 'panoramic',label: 'Panoramik',types: ['panoramic'] },
  { key: 'progress', label: 'Süreç',    types: ['progress'] },
]

// Ham API yanıtını PhotoRow'a dönüştür
function normalizePhoto(raw: RawPhoto): PhotoRow {
  return {
    id: raw.id,
    photo_url: raw.photo_url,
    photo_type: raw.photo_type,
    tags: raw.tags,
    notes: raw.notes,
    taken_at: raw.taken_at,
    created_at: raw.created_at,
    service_name: raw.protocol?.service?.name ?? null,
    protocol_name: raw.protocol?.name ?? null,
    protocol_id: raw.protocol_id,
    session_id: raw.session_id,
  }
}

// Records içindeki resimleri synthetic PhotoRow'a dönüştür
const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|heic|heif|bmp|tiff?|dcm)(\?|$)/i

function isImageFile(name: string | undefined, url: string, mime: string | undefined): boolean {
  if (mime) {
    if (mime.startsWith('image/')) return true
    if (mime === 'application/dicom') return true
  }
  return IMAGE_EXT_RE.test((name || '') + ' ' + url)
}

function classifyRecordPhoto(name: string | undefined, url: string, mime: string | undefined): string {
  const lower = ((name || '') + ' ' + url).toLowerCase()
  if (mime === 'application/dicom' || /\.dcm(\?|$)/i.test(url)) return 'xray'
  if (/panoramic|panoramik/.test(lower)) return 'panoramic'
  if (/r[öo]ntgen|x-?ray/.test(lower)) return 'xray'
  return 'progress'
}

function extractRecordPhotos(records: PortalRecord[]): PhotoRow[] {
  const out: PhotoRow[] = []
  for (const rec of records) {
    const data = (rec.data || {}) as Record<string, unknown>
    const fileUrls = Array.isArray(data.file_urls) ? (data.file_urls as string[]) : []
    const fileMeta = Array.isArray(data.file_metadata)
      ? (data.file_metadata as Array<{ name?: string; type?: string }>)
      : []
    fileUrls.forEach((url, i) => {
      if (!url || typeof url !== 'string') return
      const meta = fileMeta[i] || {}
      if (!isImageFile(meta.name, url, meta.type)) return
      out.push({
        id: `rec-${rec.id}-${i}`,
        photo_url: url,
        photo_type: classifyRecordPhoto(meta.name, url, meta.type),
        taken_at: rec.created_at,
        notes: meta.name || null,
        protocol_id: null,
      })
    })
  }
  return out
}

// Fotoğrafları protokol/hizmet bazında grupla.
// protocol_id olanlar hizmet grubuna, olmayanlar 'general'a girer.
function groupPhotos(photos: PhotoRow[]): { groups: PhotoGroup[]; general: PhotoRow[] } {
  const groupMap = new Map<string, PhotoGroup>()
  const general: PhotoRow[] = []

  for (const p of photos) {
    if (!p.protocol_id) {
      general.push(p)
      continue
    }
    const key = p.protocol_id
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key,
        serviceLabel: p.service_name || p.protocol_name || 'Tedavi',
        firstDate: p.taken_at || p.created_at || '',
        photos: [],
      })
    }
    groupMap.get(key)!.photos.push(p)
  }

  const groups = Array.from(groupMap.values())
  return { groups, general }
}

function formatGroupDate(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
  } catch { return '' }
}

export default function PortalFilesPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const businessId = params.businessId as string
  const openRecordId = searchParams.get('open')

  const [tab, setTab] = useState<'records' | 'photos'>('records')
  const [records, setRecords] = useState<PortalRecord[]>([])
  const [rawPhotos, setRawPhotos] = useState<RawPhoto[]>([])
  const [sector, setSector] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [activeRecord, setActiveRecord] = useState<PortalRecord | null>(null)
  const [activePhoto, setActivePhoto] = useState<LightboxPhoto | null>(null)
  const [photoFilter, setPhotoFilter] = useState<string>('all')

  useEffect(() => {
    (async () => {
      try {
        const [meRes, recRes, phRes] = await Promise.all([
          fetch('/api/portal/me'),
          fetch('/api/portal/records'),
          fetch('/api/portal/photos'),
        ])
        if (meRes.ok) {
          const d = await meRes.json()
          setSector(d.business?.sector ?? null)
        }
        if (recRes.ok) {
          const d = await recRes.json()
          const recs: PortalRecord[] = d.records || []
          setRecords(recs)
          if (openRecordId) {
            const target = recs.find((r) => r.id === openRecordId)
            if (target) setActiveRecord(target)
          }
        }
        if (phRes.ok) {
          const d = await phRes.json()
          setRawPhotos(d.photos || [])
        }
      } finally {
        setLoading(false)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const title = getFilesPageTitle(sector)
  const subtitle = getFilesPageSubtitle(sector)

  // customer_photos (normalize edilmiş) + records'tan çıkarılan resimler
  const allPhotos = useMemo<PhotoRow[]>(() => {
    return [...rawPhotos.map(normalizePhoto), ...extractRecordPhotos(records)]
  }, [rawPhotos, records])

  // Aktif filtreye göre fotoğrafları kırp
  const filteredPhotos = useMemo<PhotoRow[]>(() => {
    const f = PHOTO_FILTERS.find((x) => x.key === photoFilter)
    if (!f || f.types.length === 0) return allPhotos
    return allPhotos.filter((p) => f.types.includes(p.photo_type))
  }, [allPhotos, photoFilter])

  // Filtreli fotoğrafları grupla
  const { groups, general } = useMemo(() => groupPhotos(filteredPhotos), [filteredPhotos])

  // Filtre buton sayaçları (tüm allPhotos üzerinden, filtreden bağımsız)
  const photoCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allPhotos.length }
    for (const p of allPhotos) {
      counts[p.photo_type] = (counts[p.photo_type] || 0) + 1
    }
    return counts
  }, [allPhotos])

  const hasProtocolPhotos = groups.length > 0
  const hasGeneralPhotos = general.length > 0

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
      </div>

      {/* Sekmeler */}
      <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
        <TabButton active={tab === 'records'} onClick={() => setTab('records')} icon={<Folder className="h-4 w-4" />} label="Kayıtlar" count={records.length} />
        <TabButton active={tab === 'photos'} onClick={() => setTab('photos')} icon={<ImageIcon className="h-4 w-4" />} label="Fotoğraflar" count={allPhotos.length} />
      </div>

      {loading ? (
        <SkeletonList count={4} lines={2} withAvatar />
      ) : tab === 'records' ? (
        records.length === 0 ? (
          <EmptyCard icon={Folder} title="Henüz kayıt yok" description="İşletme senin için dosya eklediğinde burada görünecek." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {records.map((r) => (
              <FileCard key={r.id} record={r} onClick={() => setActiveRecord(r)} />
            ))}
          </div>
        )
      ) : (
        /* ── Fotoğraflar sekmesi ── */
        <div className="space-y-6">

          {/* Filtre butonları */}
          {allPhotos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {PHOTO_FILTERS.map((f) => {
                const count = f.key === 'all' ? allPhotos.length : (photoCounts[f.key] || 0)
                if (f.key !== 'all' && count === 0) return null
                return (
                  <button
                    key={f.key}
                    onClick={() => setPhotoFilter(f.key)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                      photoFilter === f.key
                        ? 'bg-pulse-900 text-white border-pulse-900 dark:bg-pulse-700 dark:border-pulse-700'
                        : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-pulse-900/40'
                    )}
                  >
                    {f.label}
                    <span className="ml-1 opacity-70">{count}</span>
                  </button>
                )
              })}
            </div>
          )}

          {filteredPhotos.length === 0 ? (
            <EmptyCard icon={ImageIcon} title="Fotoğraf yok" description="Bu kategoride henüz fotoğraf bulunmuyor." />
          ) : (
            <>
              {/* ── Protokol/hizmet grupları ── */}
              {hasProtocolPhotos && (
                <div className="space-y-4">
                  {/* Başlık sadece hem gruplu hem genel foto varsa gösterilir */}
                  {hasGeneralPhotos && (
                    <SectionLabel icon={<Stethoscope className="h-4 w-4" />} text="Tedavi Fotoğrafları" />
                  )}

                  {groups.map((group) => (
                    <div
                      key={group.key}
                      className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden"
                    >
                      {/* Grup başlığı */}
                      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-pulse-900/5 dark:bg-pulse-900/20 flex items-center justify-center flex-shrink-0">
                          <Stethoscope className="h-3.5 w-3.5 text-pulse-900 dark:text-pulse-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {group.serviceLabel}
                          </p>
                          {group.firstDate && (
                            <p className="text-[11px] text-gray-400 dark:text-gray-500">
                              {formatGroupDate(group.firstDate)}
                            </p>
                          )}
                        </div>
                        <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 flex-shrink-0">
                          {group.photos.length} fotoğraf
                        </span>
                      </div>

                      {/* Grup fotoğraf grid'i */}
                      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {group.photos.map((p) => (
                          <PhotoTile
                            key={p.id}
                            photo={p}
                            onClick={() => setActivePhoto(p)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Genel / protokolsüz fotoğraflar ── */}
              {hasGeneralPhotos && (
                <div className="space-y-3">
                  {hasProtocolPhotos && (
                    <SectionLabel icon={<ImageIcon className="h-4 w-4" />} text="Diğer Fotoğraflar" />
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {general.map((p) => (
                      <PhotoTile key={p.id} photo={p} onClick={() => setActivePhoto(p)} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <FileDetailModal
        record={activeRecord}
        onClose={() => setActiveRecord(null)}
        onImageClick={(url) => {
          setActivePhoto({ id: `img-${url}`, photo_url: url, photo_type: 'progress' })
        }}
      />

      <PhotoLightbox
        photo={activePhoto}
        onClose={() => setActivePhoto(null)}
      />
    </div>
  )
}

// ── Küçük yardımcı bileşenler ──

interface TabButtonProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  count: number
}
function TabButton({ active, onClick, icon, label, count }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2',
        active
          ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
      )}
    >
      {icon}
      {label}
      {count > 0 && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-pulse-900/10 dark:bg-pulse-900/30 text-pulse-900 dark:text-pulse-300">
          {count}
        </span>
      )}
    </button>
  )
}

interface SectionLabelProps {
  icon: React.ReactNode
  text: string
}
function SectionLabel({ icon, text }: SectionLabelProps) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
      {icon}
      {text}
    </div>
  )
}

interface PhotoTileProps {
  photo: PhotoRow
  onClick: () => void
}
function PhotoTile({ photo, onClick }: PhotoTileProps) {
  const label = TYPE_LABELS[photo.photo_type] || photo.photo_type
  return (
    <button
      onClick={onClick}
      className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 hover:ring-2 hover:ring-pulse-900 transition-all group"
    >
      <NextImage
        src={photo.photo_url}
        alt={label}
        fill
        className="object-cover group-hover:scale-105 transition-transform"
      />
      <span className="absolute bottom-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/60 text-white">
        {label}
      </span>
    </button>
  )
}

interface EmptyCardProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}
function EmptyCard({ icon: Icon, title, description }: EmptyCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-10 text-center">
      <div className="h-14 w-14 rounded-full bg-pulse-900/5 dark:bg-pulse-900/20 flex items-center justify-center mx-auto mb-3">
        <Icon className="h-7 w-7 text-pulse-900/50 dark:text-pulse-300" />
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
    </div>
  )
}
