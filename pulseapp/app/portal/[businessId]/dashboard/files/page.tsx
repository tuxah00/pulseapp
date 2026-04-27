'use client'

import { useEffect, useMemo, useState } from 'react'
import NextImage from 'next/image'
import { useParams, useSearchParams } from 'next/navigation'
import { Folder, Image as ImageIcon, Stethoscope, CalendarCheck, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FileCard, FileDetailModal, type PortalRecord } from '../_components/file-card'
import { PhotoLightbox, type LightboxPhoto } from '../_components/photo-lightbox'
import { getFilesPageTitle, getFilesPageSubtitle } from '@/lib/portal/sector-labels'
import { SkeletonList } from '../_components/skeleton-card'

// API'den gelen ham fotoğraf satırı (protocol + appointment join dahil)
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
  appointment_id?: string | null
  protocol?: {
    id: string
    name: string
    service?: { id: string; name: string } | null
  } | null
  appointment?: {
    id: string
    appointment_date: string
    start_time: string
    customer_package_id?: string | null
    package_name?: string | null
    service?: { id: string; name: string } | null
  } | null
}

interface PhotoRow extends LightboxPhoto {
  protocol_id?: string | null
  session_id?: string | null
  appointment_id?: string | null
  appointment_date?: string | null
  customer_package_id?: string | null
  package_name?: string | null
}

// Grup tipi — paket > protokol > randevu > diğer önceliği ile
type GroupKind = 'package' | 'protocol' | 'appointment'

// Paket / protokol / randevu grubunu temsil eder
interface PhotoGroup {
  key: string           // 'package:<id>' | 'protocol:<id>' | 'appointment:<id>'
  kind: GroupKind
  serviceLabel: string  // Paket / protokol / hizmet adı
  firstDate: string     // Grup başlığında gösterilen tarih (en yeni fotoğraf)
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

// Ham API yanıtını PhotoRow'a dönüştür.
// service_name önceliği: randevunun hizmeti → protokolün hizmeti.
function normalizePhoto(raw: RawPhoto): PhotoRow {
  const apptServiceName = raw.appointment?.service?.name ?? null
  const protoServiceName = raw.protocol?.service?.name ?? null
  return {
    id: raw.id,
    photo_url: raw.photo_url,
    photo_type: raw.photo_type,
    tags: raw.tags,
    notes: raw.notes,
    taken_at: raw.taken_at,
    created_at: raw.created_at,
    service_name: apptServiceName ?? protoServiceName,
    protocol_name: raw.protocol?.name ?? null,
    protocol_id: raw.protocol_id,
    session_id: raw.session_id,
    appointment_id: raw.appointment_id,
    appointment_date: raw.appointment?.appointment_date ?? null,
    customer_package_id: raw.appointment?.customer_package_id ?? null,
    package_name: raw.appointment?.package_name ?? null,
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

// Fotoğrafları gruplama önceliği (yüksekten düşüğe):
//   1. customer_package_id varsa → "Paket" grubu (aynı paketin tüm seansları toplanır)
//   2. protocol_id varsa → "Protokol" grubu (tüm seansları toplanır)
//   3. appointment_id varsa → "Randevu" grubu (tek randevu)
//   4. hiçbiri yoksa → general (Diğer Fotoğraflar)
//
// Aynı grubun fotoları kendi içinde tarihe göre sıralanır (en eski → en yeni
// kronolojik akış için before/after takibi).
// Gruplar arası sıralama: en yeni grup üstte (firstDate = grup içindeki en yeni foto).
function groupPhotos(photos: PhotoRow[]): { groups: PhotoGroup[]; general: PhotoRow[] } {
  const packageMap = new Map<string, PhotoGroup>()
  const protoMap = new Map<string, PhotoGroup>()
  const apptMap = new Map<string, PhotoGroup>()
  const general: PhotoRow[] = []

  const pickDate = (p: PhotoRow): string =>
    p.taken_at || p.appointment_date || p.created_at || ''

  for (const p of photos) {
    // 1. Paket — aynı paketin tüm seans fotoları tek grupta
    if (p.customer_package_id) {
      const key = `package:${p.customer_package_id}`
      if (!packageMap.has(key)) {
        packageMap.set(key, {
          key,
          kind: 'package',
          serviceLabel: p.package_name || p.service_name || 'Paket',
          firstDate: pickDate(p),
          photos: [],
        })
      }
      packageMap.get(key)!.photos.push(p)
      continue
    }
    // 2. Protokol — aynı protokolün tüm seans fotoları tek grupta
    if (p.protocol_id) {
      const key = `protocol:${p.protocol_id}`
      if (!protoMap.has(key)) {
        protoMap.set(key, {
          key,
          kind: 'protocol',
          serviceLabel: p.service_name || p.protocol_name || 'Tedavi',
          firstDate: pickDate(p),
          photos: [],
        })
      }
      protoMap.get(key)!.photos.push(p)
      continue
    }
    // 3. Randevu — tek randevuya bağlı fotolar
    if (p.appointment_id) {
      const key = `appointment:${p.appointment_id}`
      if (!apptMap.has(key)) {
        apptMap.set(key, {
          key,
          kind: 'appointment',
          serviceLabel: p.service_name || 'Randevu',
          firstDate: pickDate(p),
          photos: [],
        })
      }
      apptMap.get(key)!.photos.push(p)
      continue
    }
    general.push(p)
  }

  // Her grubun firstDate'ini içindeki en yeni fotoğrafa eşitle + foto'ları
  // kronolojik (eski→yeni) sırala: before/after takibi için doğal akış
  const finalize = (g: PhotoGroup): PhotoGroup => {
    const sorted = [...g.photos].sort((a, b) => pickDate(a).localeCompare(pickDate(b)))
    const newest = sorted.length > 0 ? pickDate(sorted[sorted.length - 1]) : g.firstDate
    return { ...g, photos: sorted, firstDate: newest }
  }

  // Tüm grupları birleştir — paket > protokol > randevu öncelik sırası içinde
  // her kategori kendi içinde en yeni tarih önce
  const sortDesc = (a: PhotoGroup, b: PhotoGroup) => (b.firstDate || '').localeCompare(a.firstDate || '')
  const packageGroups = Array.from(packageMap.values()).map(finalize).sort(sortDesc)
  const protoGroups = Array.from(protoMap.values()).map(finalize).sort(sortDesc)
  const apptGroups = Array.from(apptMap.values()).map(finalize).sort(sortDesc)

  return {
    groups: [...packageGroups, ...protoGroups, ...apptGroups],
    general: general.sort((a, b) => pickDate(b).localeCompare(pickDate(a))),
  }
}

// Randevu grupları için tek-gün gösterimi (gün ay yıl).
// Paket / protokol grupları için ay-yıl (çoklu seans olabilir).
function formatGroupDate(iso: string, kind: GroupKind): string {
  if (!iso) return ''
  try {
    const opts: Intl.DateTimeFormatOptions = kind === 'appointment'
      ? { day: 'numeric', month: 'long', year: 'numeric' }
      : { month: 'long', year: 'numeric' }
    return new Date(iso).toLocaleDateString('tr-TR', opts)
  } catch { return '' }
}

// Grup başlığında gösterilecek tip etiketi
const GROUP_KIND_LABELS: Record<GroupKind, string> = {
  package: 'Paket',
  protocol: 'Protokol',
  appointment: 'Randevu',
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
              {/* ── Randevu / Protokol grupları ── */}
              {hasProtocolPhotos && (
                <div className="space-y-4">
                  {/* Başlık sadece hem gruplu hem genel foto varsa gösterilir */}
                  {hasGeneralPhotos && (
                    <SectionLabel icon={<Stethoscope className="h-4 w-4" />} text="Tedavi & Randevu Fotoğrafları" />
                  )}

                  {groups.map((group) => {
                    const GroupIcon = group.kind === 'package'
                      ? Package
                      : group.kind === 'appointment'
                        ? CalendarCheck
                        : Stethoscope
                    // Aynı paket/protokol içindeki benzersiz randevu sayısı (kaç seans?)
                    const sessionCount = group.kind !== 'appointment'
                      ? new Set(group.photos.map(p => p.appointment_id).filter(Boolean)).size
                      : 0
                    return (
                    <div
                      key={group.key}
                      className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden"
                    >
                      {/* Grup başlığı */}
                      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-pulse-900/5 dark:bg-pulse-900/20 flex items-center justify-center flex-shrink-0">
                          <GroupIcon className="h-3.5 w-3.5 text-pulse-900 dark:text-pulse-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {group.serviceLabel}
                          </p>
                          {group.firstDate && (
                            <p className="text-[11px] text-gray-400 dark:text-gray-500">
                              {GROUP_KIND_LABELS[group.kind]} • {formatGroupDate(group.firstDate, group.kind)}
                              {sessionCount > 1 && ` • ${sessionCount} seans`}
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
                    )
                  })}
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
