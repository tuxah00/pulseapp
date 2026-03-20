'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import {
  Plus, Loader2, X, Pencil, Trash2, Search, AlertTriangle,
  ClipboardList, UserCheck, Briefcase, PawPrint, Car, BookOpen,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type RecordType = 'patient_file' | 'client_file' | 'case_file' | 'pet' | 'vehicle' | 'diet_plan' | 'student'

interface BusinessRecord {
  id: string
  business_id: string
  type: RecordType
  title: string
  data: Record<string, string>
  customer_id: string | null
  created_at: string
  updated_at: string
}

interface FieldDef {
  key: string
  label: string
  type?: 'text' | 'date' | 'textarea' | 'select'
  options?: { value: string; label: string }[]
  placeholder?: string
}

interface TypeConfig {
  label: string
  Icon: React.ElementType
  addLabel: string
  fields: FieldDef[]
  primarySubtitle?: string
}

// ─── Type Config ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<RecordType, TypeConfig> = {
  patient_file: {
    label: 'Hasta Dosyaları',
    Icon: ClipboardList,
    addLabel: 'Hasta Ekle',
    primarySubtitle: 'diagnosis',
    fields: [
      { key: 'title', label: 'Ad Soyad', placeholder: 'Ahmet Yılmaz' },
      { key: 'dob', label: 'Doğum Tarihi', type: 'date' },
      { key: 'phone', label: 'Telefon', placeholder: '0500 000 00 00' },
      { key: 'diagnosis', label: 'Teşhis', placeholder: 'Örn: Diş çürüğü' },
      { key: 'treatment_notes', label: 'Tedavi Notları', type: 'textarea', placeholder: 'Tedavi sürecine dair notlar...' },
      { key: 'allergies', label: 'Alerjiler', placeholder: 'Penisilin, lateks...' },
      { key: 'next_visit', label: 'Sonraki Ziyaret', type: 'date' },
    ],
  },
  client_file: {
    label: 'Danışan Dosyaları',
    Icon: UserCheck,
    addLabel: 'Danışan Ekle',
    primarySubtitle: 'treatment_plan',
    fields: [
      { key: 'title', label: 'Ad Soyad', placeholder: 'Fatma Kaya' },
      { key: 'phone', label: 'Telefon', placeholder: '0500 000 00 00' },
      { key: 'treatment_plan', label: 'Tedavi Planı', type: 'textarea', placeholder: 'Uygulanan terapi ve yaklaşımlar...' },
      { key: 'session_notes', label: 'Seans Notları', type: 'textarea', placeholder: 'Seansa ait önemli notlar...' },
    ],
  },
  case_file: {
    label: 'Müvekkil Dosyaları',
    Icon: Briefcase,
    addLabel: 'Dava Ekle',
    primarySubtitle: 'client_name',
    fields: [
      { key: 'title', label: 'Dava Adı', placeholder: 'Miras Davası - Kaya Ailesi' },
      { key: 'client_name', label: 'Müvekkil', placeholder: 'Mehmet Kaya' },
      { key: 'case_type', label: 'Dava Türü', placeholder: 'Miras, Boşanma, Ceza...' },
      {
        key: 'status',
        label: 'Durum',
        type: 'select',
        options: [
          { value: 'active', label: 'Aktif' },
          { value: 'pending', label: 'Beklemede' },
          { value: 'closed', label: 'Kapandı' },
        ],
      },
      { key: 'hearing_date', label: 'Duruşma Tarihi', type: 'date' },
      { key: 'court', label: 'Mahkeme', placeholder: 'İstanbul Anadolu Adalet Sarayı' },
      { key: 'notes', label: 'Notlar', type: 'textarea', placeholder: 'Dava ile ilgili notlar...' },
    ],
  },
  pet: {
    label: 'Hasta Dosyaları',
    Icon: PawPrint,
    addLabel: 'Hasta Ekle',
    primarySubtitle: 'owner_name',
    fields: [
      { key: 'title', label: 'Hayvan Adı', placeholder: 'Karamel' },
      { key: 'owner_name', label: 'Sahip', placeholder: 'Ali Demir' },
      { key: 'owner_phone', label: 'Sahip Tel', placeholder: '0500 000 00 00' },
      {
        key: 'species',
        label: 'Tür',
        type: 'select',
        options: [
          { value: 'köpek', label: 'Köpek' },
          { value: 'kedi', label: 'Kedi' },
          { value: 'kuş', label: 'Kuş' },
          { value: 'diğer', label: 'Diğer' },
        ],
      },
      { key: 'breed', label: 'Irk', placeholder: 'Golden Retriever' },
      { key: 'birth_date', label: 'Doğum Tarihi', type: 'date' },
      { key: 'vaccinations', label: 'Aşı Geçmişi', type: 'textarea', placeholder: 'Uygulanan aşılar ve tarihleri...' },
      { key: 'vet_notes', label: 'Veteriner Notları', type: 'textarea', placeholder: 'Muayene notları...' },
    ],
  },
  vehicle: {
    label: 'Araç Kayıtları',
    Icon: Car,
    addLabel: 'Araç Ekle',
    primarySubtitle: 'owner_name',
    fields: [
      { key: 'title', label: 'Plaka', placeholder: '34 ABC 123' },
      { key: 'brand', label: 'Marka', placeholder: 'Toyota' },
      { key: 'model', label: 'Model', placeholder: 'Corolla' },
      { key: 'year', label: 'Yıl', placeholder: '2020' },
      { key: 'owner_name', label: 'Sahip', placeholder: 'Hasan Çelik' },
      { key: 'owner_phone', label: 'Sahip Tel', placeholder: '0500 000 00 00' },
      { key: 'service_history', label: 'Servis Geçmişi', type: 'textarea', placeholder: 'Yapılan bakım ve onarımlar...' },
    ],
  },
  diet_plan: {
    label: 'Diyet Programları',
    Icon: ClipboardList,
    addLabel: 'Danışan Ekle',
    primarySubtitle: 'goal',
    fields: [
      { key: 'title', label: 'Danışan Adı', placeholder: 'Ayşe Şahin' },
      { key: 'phone', label: 'Telefon', placeholder: '0500 000 00 00' },
      { key: 'goal', label: 'Hedef', placeholder: 'Kilo vermek, kas kazanmak...' },
      { key: 'start_weight', label: 'Başlangıç Kilo (kg)', placeholder: '85' },
      { key: 'current_weight', label: 'Güncel Kilo (kg)', placeholder: '78' },
      { key: 'plan_notes', label: 'Program Notları', type: 'textarea', placeholder: 'Diyet planı ve öneriler...' },
    ],
  },
  student: {
    label: 'Öğrenci Bilgileri',
    Icon: BookOpen,
    addLabel: 'Öğrenci Ekle',
    primarySubtitle: 'subject',
    fields: [
      { key: 'title', label: 'Öğrenci Adı', placeholder: 'Can Yıldız' },
      { key: 'parent_name', label: 'Veli Adı', placeholder: 'Mustafa Yıldız' },
      { key: 'parent_phone', label: 'Veli Tel', placeholder: '0500 000 00 00' },
      { key: 'subject', label: 'Ders / Konu', placeholder: 'Matematik, Fizik...' },
      { key: 'level', label: 'Seviye', placeholder: '9. Sınıf, YKS Hazırlık...' },
      { key: 'schedule', label: 'Ders Programı', placeholder: 'Salı-Perşembe 16:00' },
      { key: 'progress_notes', label: 'İlerleme Notları', type: 'textarea', placeholder: 'Öğrencinin gelişimine dair notlar...' },
    ],
  },
}

const DEFAULT_TYPE: RecordType = 'patient_file'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidType(t: string | null): t is RecordType {
  return !!t && t in TYPE_CONFIG
}

function formatDate(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Main Component (wrapped in Suspense boundary) ────────────────────────────

function RecordsPageInner() {
  const searchParams = useSearchParams()
  const rawType = searchParams.get('type')
  const recordType: RecordType = isValidType(rawType) ? rawType : DEFAULT_TYPE

  const { businessId, loading: ctxLoading } = useBusinessContext()
  const config = TYPE_CONFIG[recordType]

  const [records, setRecords] = useState<BusinessRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<BusinessRecord | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<BusinessRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Dynamic form state: one string per field key
  const [formData, setFormData] = useState<Record<string, string>>({})

  // Reset state when type changes
  useEffect(() => {
    setRecords([])
    setSelectedRecord(null)
    setSearch('')
    setDbError(null)
  }, [recordType])

  const fetchRecords = useCallback(async () => {
    if (!businessId) return
    setLoading(true)

    const params = new URLSearchParams({ businessId, type: recordType })
    if (search.trim()) params.set('search', search.trim())

    const res = await fetch(`/api/records?${params.toString()}`)
    const json = await res.json()

    if (!res.ok) {
      if (json.error?.includes('does not exist')) {
        setDbError('business_records tablosu henüz oluşturulmamış. Supabase\'de 009_create_business_records.sql migrasyonunu çalıştırın.')
      } else {
        setDbError(json.error || 'Bir hata oluştu.')
      }
    } else {
      setRecords(json.records || [])
      setDbError(null)
    }
    setLoading(false)
  }, [businessId, recordType, search])

  useEffect(() => {
    if (!ctxLoading) fetchRecords()
  }, [fetchRecords, ctxLoading])

  // ── Modal helpers ──────────────────────────────────────────────────────────

  function buildEmptyForm(): Record<string, string> {
    const defaults: Record<string, string> = {}
    config.fields.forEach((f) => {
      if (f.type === 'select' && f.options?.length) {
        defaults[f.key] = f.options[0].value
      } else {
        defaults[f.key] = ''
      }
    })
    return defaults
  }

  function openNewModal() {
    setEditingRecord(null)
    setFormData(buildEmptyForm())
    setFormError(null)
    setShowModal(true)
  }

  function openEditModal(record: BusinessRecord) {
    setEditingRecord(record)
    const fd = buildEmptyForm()
    // Merge saved data into form; title is top-level
    fd['title'] = record.title
    Object.entries(record.data).forEach(([k, v]) => {
      fd[k] = v ?? ''
    })
    setFormError(null)
    setShowModal(true)
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)

    const { title, ...rest } = formData
    const dataPayload: Record<string, string> = {}
    Object.entries(rest).forEach(([k, v]) => {
      if (v.trim()) dataPayload[k] = v.trim()
    })

    if (!title.trim()) {
      setFormError('Başlık alanı zorunludur.')
      setSaving(false)
      return
    }

    if (editingRecord) {
      const res = await fetch(`/api/records?id=${editingRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), data: dataPayload }),
      })
      const json = await res.json()
      if (!res.ok) { setFormError(json.error || 'Güncelleme hatası'); setSaving(false); return }
      // Update selectedRecord if open
      if (selectedRecord?.id === editingRecord.id) {
        setSelectedRecord({ ...selectedRecord, title: title.trim(), data: dataPayload })
      }
    } else {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: businessId, type: recordType, title: title.trim(), data: dataPayload }),
      })
      const json = await res.json()
      if (!res.ok) { setFormError(json.error || 'Ekleme hatası'); setSaving(false); return }
    }

    setSaving(false)
    setShowModal(false)
    fetchRecords()
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(record: BusinessRecord) {
    if (!confirm(`"${record.title}" kaydını silmek istediğinize emin misiniz?`)) return
    const res = await fetch(`/api/records?id=${record.id}`, { method: 'DELETE' })
    if (!res.ok) { alert('Silme hatası'); return }
    if (selectedRecord?.id === record.id) setSelectedRecord(null)
    fetchRecords()
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  const { Icon } = config

  function getSubtitle(record: BusinessRecord): string {
    const key = config.primarySubtitle
    if (!key) return ''
    return record.data[key] || ''
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-pulse-500" />
      </div>
    )
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{config.label}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {dbError ? config.label : `${records.length} kayıt`}
          </p>
        </div>
        <button onClick={openNewModal} className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />{config.addLabel}
        </button>
      </div>

      {/* ── DB Error ── */}
      {dbError && (
        <div className="card border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-300">{dbError}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Search ── */}
      {!dbError && (
        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
            placeholder={`${config.label} içinde ara...`}
          />
        </div>
      )}

      {/* ── Empty state ── */}
      {!dbError && records.length === 0 && (
        <div className="card flex flex-col items-center justify-center py-24 text-center">
          <Icon className="mb-4 h-16 w-16 text-gray-200 dark:text-gray-600" />
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300">
            {search ? 'Aramanızla eşleşen kayıt bulunamadı' : 'Henüz kayıt eklenmemiş'}
          </h3>
          {!search && (
            <>
              <p className="mt-1 mb-4 text-sm text-gray-400">
                Sağ üstteki butonu kullanarak ilk kaydı ekleyin.
              </p>
              <button onClick={openNewModal} className="btn-primary">
                <Plus className="mr-2 h-4 w-4" />{config.addLabel}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Record list ── */}
      {!dbError && records.length > 0 && (
        <div className="space-y-3">
          {records.map((record) => (
            <div
              key={record.id}
              onClick={() => setSelectedRecord(record)}
              className={cn(
                'card flex items-center gap-4 p-4 cursor-pointer transition-all hover:shadow-md',
                selectedRecord?.id === record.id && 'ring-2 ring-pulse-500'
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pulse-50 dark:bg-pulse-900/20 flex-shrink-0">
                <Icon className="h-5 w-5 text-pulse-600 dark:text-pulse-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-900 dark:text-gray-100 truncate block">
                  {record.title}
                </span>
                {getSubtitle(record) && (
                  <span className="text-sm text-gray-500 dark:text-gray-400 truncate block">
                    {getSubtitle(record)}
                  </span>
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {formatDate(record.created_at)}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => { openEditModal(record); setSelectedRecord(null) }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(record)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* ── Slide-over Detail Panel ── */}
      {selectedRecord && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 dark:bg-black/50"
            onClick={() => setSelectedRecord(null)}
          />
          <div className="slide-panel border-l border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Kayıt Detayı</h3>
              <button
                onClick={() => setSelectedRecord(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Avatar + title */}
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-pulse-50 dark:bg-pulse-900/20">
                  <Icon className="h-8 w-8 text-pulse-600 dark:text-pulse-400" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {selectedRecord.title}
                </h4>
                <p className="text-xs text-gray-400 mt-1">{formatDate(selectedRecord.created_at)}</p>
              </div>

              {/* Fields */}
              <div className="space-y-3 text-sm">
                {config.fields
                  .filter((f) => f.key !== 'title')
                  .map((f) => {
                    const val = selectedRecord.data[f.key]
                    if (!val) return null
                    return (
                      <div key={f.key}>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">{f.label}</p>
                        {f.type === 'textarea' ? (
                          <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 whitespace-pre-wrap">
                            {val}
                          </p>
                        ) : f.type === 'select' ? (
                          <p className="text-sm text-gray-900 dark:text-gray-100">
                            {f.options?.find((o) => o.value === val)?.label ?? val}
                          </p>
                        ) : f.type === 'date' ? (
                          <p className="text-sm text-gray-900 dark:text-gray-100">{formatDate(val)}</p>
                        ) : (
                          <p className="text-sm text-gray-900 dark:text-gray-100">{val}</p>
                        )}
                      </div>
                    )
                  })}
              </div>

              {/* Actions */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex gap-2">
                <button
                  onClick={() => { openEditModal(selectedRecord); setSelectedRecord(null) }}
                  className="btn-secondary flex-1 text-sm"
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />Düzenle
                </button>
                <button
                  onClick={() => handleDelete(selectedRecord)}
                  className="btn-danger flex-1 text-sm"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />Sil
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingRecord ? 'Kaydı Düzenle' : config.addLabel}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {config.fields.map((f) => (
                <div key={f.key}>
                  <label className="label">{f.label}</label>
                  {f.type === 'textarea' ? (
                    <textarea
                      value={formData[f.key] ?? ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      className="input"
                      rows={3}
                      placeholder={f.placeholder}
                      required={f.key === 'title'}
                    />
                  ) : f.type === 'select' ? (
                    <select
                      value={formData[f.key] ?? ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      className="input"
                    >
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type ?? 'text'}
                      value={formData[f.key] ?? ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      className="input"
                      placeholder={f.placeholder}
                      required={f.key === 'title'}
                      autoFocus={f.key === 'title'}
                    />
                  )}
                </div>
              ))}

              {formError && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  İptal
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingRecord ? 'Güncelle' : 'Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Export with Suspense (required for useSearchParams) ──────────────────────

export default function RecordsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-pulse-500" />
      </div>
    }>
      <RecordsPageInner />
    </Suspense>
  )
}
