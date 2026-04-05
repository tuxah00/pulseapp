'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useDebounce } from '@/lib/hooks/use-debounce'
import {
  Plus, Loader2, X, Pencil, Trash2, Search, AlertTriangle,
  ClipboardList, UserCheck, Briefcase, PawPrint, Car, BookOpen,
  ChevronRight, LayoutList, LayoutGrid, Upload, FileText, Image as ImageIcon, ArrowUpDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useViewMode } from '@/lib/hooks/use-view-mode'
import { ToolbarPopover, SortPopoverContent } from '@/components/ui/toolbar-popover'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/utils/audit'
import { useConfirm } from '@/lib/hooks/use-confirm'
import type { Customer } from '@/types'
import CompactBoxCard from '@/components/ui/compact-box-card'
import { AnimatedList, AnimatedItem } from '@/components/ui/animated-list'

// ─── Types ────────────────────────────────────────────────────────────────────

type RecordType = 'patient_file' | 'client_file' | 'case_file' | 'pet' | 'vehicle' | 'diet_plan' | 'student'

interface BusinessRecord {
  id: string
  business_id: string
  type: RecordType
  title: string
  data: Record<string, any>
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
    addLabel: 'Dosya Oluştur',
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
    addLabel: 'Dosya Oluştur',
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
    addLabel: 'Dosya Oluştur',
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
    addLabel: 'Dosya Oluştur',
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
    addLabel: 'Dosya Oluştur',
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
    addLabel: 'Dosya Oluştur',
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
    addLabel: 'Dosya Oluştur',
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

  const { businessId, staffId, staffName, loading: ctxLoading, permissions } = useBusinessContext()
  const { confirm } = useConfirm()
  const config = TYPE_CONFIG[recordType]
  const supabase = createClient()

  const [records, setRecords] = useState<BusinessRecord[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [showModal, setShowModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<BusinessRecord | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<BusinessRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useViewMode('records', 'list')
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)

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
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())

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
  }, [businessId, recordType, debouncedSearch])

  const fetchCustomers = useCallback(async () => {
    if (!businessId) return
    const { data } = await supabase.from('customers').select('id, name, phone').eq('business_id', businessId).eq('is_active', true).order('name')
    if (data) setCustomers(data as Customer[])
  }, [businessId])

  useEffect(() => {
    if (!ctxLoading) {
      fetchRecords()
      fetchCustomers()
    }
  }, [fetchRecords, fetchCustomers, ctxLoading])

  // ESC tuşu ile detay modalını kapat
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedRecord(null)
    }
    if (selectedRecord) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [selectedRecord])

  // ── File upload helpers ────────────────────────────────────────────────────

  const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.heic,.doc,.docx,.xls,.xlsx,.dcm,.dicom,.tif,.tiff,.bmp,.webp,.gif,.svg'

  async function uploadFilesToStorage(recordId: string): Promise<string[]> {
    const urls: string[] = []
    for (const file of uploadFiles) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('businessId', businessId ?? '')
      fd.append('recordId', recordId)
      const res = await fetch('/api/records/upload', { method: 'POST', body: fd })
      if (res.ok) {
        const json = await res.json()
        if (json.url) urls.push(json.url)
      }
    }
    return urls
  }

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
    setSelectedCustomerId('')
    setUploadFiles([])
    setShowModal(true)
  }

  function openEditModal(record: BusinessRecord) {
    setEditingRecord(record)
    const fd = buildEmptyForm()
    fd['title'] = record.title
    Object.entries(record.data).forEach(([k, v]) => {
      if (k !== 'file_urls') fd[k] = v ?? ''  // array'leri formData'ya kopyalama
    })
    setFormError(null)
    setSelectedCustomerId(record.customer_id || '')
    setUploadFiles([])
    setShowModal(true)
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)

    try {
      const { title, ...rest } = formData
      const dataPayload: Record<string, any> = {}
      Object.entries(rest).forEach(([k, v]) => {
        if (typeof v === 'string' && v.trim()) dataPayload[k] = v.trim()
      })
      // Mevcut dosyaları koru — kullanıcı yeni dosya yüklemese bile
      if (editingRecord?.data?.file_urls && Array.isArray(editingRecord.data.file_urls)) {
        dataPayload.file_urls = editingRecord.data.file_urls
      }

      if (!title.trim()) {
        setFormError('Başlık alanı zorunludur.')
        return
      }

      if (editingRecord) {
        const res = await fetch(`/api/records?id=${editingRecord.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim(), data: dataPayload, customer_id: selectedCustomerId || null }),
        })
        const json = await res.json()
        if (!res.ok) { setFormError(json.error || 'Güncelleme hatası'); return }

        // Upload files if any
        if (uploadFiles.length > 0) {
          setUploading(true)
          const fileUrls = await uploadFilesToStorage(editingRecord.id)
          if (fileUrls.length > 0) {
            await fetch(`/api/records?id=${editingRecord.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ file_urls: fileUrls }),
            })
          }
        }

        if (selectedRecord?.id === editingRecord.id) {
          setSelectedRecord({ ...selectedRecord, title: title.trim(), data: dataPayload })
        }
      } else {
        // Auto-fill title from customer name if not set
        let finalTitle = title.trim()
        if (!finalTitle && selectedCustomerId) {
          const cust = customers.find(c => c.id === selectedCustomerId)
          if (cust) finalTitle = cust.name
        }
        if (!finalTitle) {
          setFormError('Başlık alanı zorunludur.')
          return
        }

        const res = await fetch('/api/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_id: businessId,
            type: recordType,
            title: finalTitle,
            data: dataPayload,
            customer_id: selectedCustomerId || null,
          }),
        })
        const json = await res.json()
        if (!res.ok) { setFormError(json.error || 'Ekleme hatası'); return }

        // Upload files if any
        if (uploadFiles.length > 0 && json.record?.id) {
          setUploading(true)
          const fileUrls = await uploadFilesToStorage(json.record.id)
          if (fileUrls.length > 0) {
            await fetch(`/api/records?id=${json.record.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ file_urls: fileUrls }),
            })
          }
        }
      }

      setShowModal(false)
      fetchRecords()
      logAudit({ businessId: businessId!, staffId, staffName, action: editingRecord ? 'update' : 'create', resource: 'patient_record', resourceId: editingRecord?.id, details: { title: formData.title || '' } })
    } catch (err) {
      setFormError('Bir hata oluştu. Lütfen tekrar deneyin.')
      console.error('Record save error:', err)
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  // ── Delete single file ──────────────────────────────────────────────────

  async function handleDeleteFile(recordId: string, fileUrl: string) {
    const ok = await confirm({ title: 'Onay', message: 'Bu dosyayı silmek istediğinize emin misiniz?' })
    if (!ok) return

    const record = records.find((r) => r.id === recordId)
    if (!record) return

    const currentUrls: string[] = record.data.file_urls || []
    const updatedUrls = currentUrls.filter((u: string) => u !== fileUrl)

    // Update the record via PATCH using data field (not file_urls to avoid merge)
    const res = await fetch(`/api/records?id=${recordId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { ...record.data, file_urls: updatedUrls } }),
    })
    if (!res.ok) { alert('Dosya silme hatası'); return }

    // Try to delete from Supabase storage
    try {
      const supabase = createClient()
      const urlObj = new URL(fileUrl)
      const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/records\/(.+)/)
      if (pathMatch) {
        await supabase.storage.from('records').remove([decodeURIComponent(pathMatch[1])])
      }
    } catch (err) {
      console.error('Storage delete error (non-critical):', err)
    }

    // Update selectedRecord state to reflect removal
    if (selectedRecord?.id === recordId) {
      setSelectedRecord({
        ...selectedRecord,
        data: { ...selectedRecord.data, file_urls: updatedUrls },
      })
    }

    fetchRecords()
    logAudit({ businessId: businessId!, staffId, staffName, action: 'delete', resource: 'patient_record_file', resourceId: recordId, details: { deletedFileUrl: fileUrl } })
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(record: BusinessRecord) {
    const ok = await confirm({ title: 'Onay', message: `"${record.title}" kaydını silmek istediğinize emin misiniz?` })
    if (!ok) return
    const res = await fetch(`/api/records?id=${record.id}`, { method: 'DELETE' })
    if (!res.ok) { alert('Silme hatası'); return }
    if (selectedRecord?.id === record.id) setSelectedRecord(null)
    fetchRecords()
    logAudit({ businessId: businessId!, staffId, staffName, action: 'delete', resource: 'patient_record', resourceId: record.id, details: { title: record.title } })
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  const { Icon } = config

  function getSubtitle(record: BusinessRecord): string {
    const key = config.primarySubtitle
    if (!key) return ''
    return record.data[key] || ''
  }

  if (permissions && !permissions.records) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">İşletme sahibinizle iletişime geçin.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-pulse-500" />
      </div>
    )
  }

  const SORT_OPTIONS = [
    { value: 'title', label: 'İsim' },
    { value: 'created_at', label: 'Tarih' },
  ]

  const sortedRecords = sortField
    ? [...records].sort((a, b) => {
        const va = (a as any)[sortField]
        const vb = (b as any)[sortField]
        if (va == null && vb == null) return 0
        if (va == null) return 1; if (vb == null) return -1
        const cmp = typeof va === 'string' ? va.localeCompare(vb, 'tr') : (va as number) - (vb as number)
        return sortDir === 'asc' ? cmp : -cmp
      })
    : records

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{config.label}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {dbError ? config.label : `${records.length} kayıt`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 shrink-0">
            <ToolbarPopover icon={<ArrowUpDown className="h-4 w-4" />} label="Sırala" active={sortField !== null}>
              <SortPopoverContent options={SORT_OPTIONS} sortField={sortField} sortDir={sortDir} onSortField={setSortField} onSortDir={setSortDir} />
            </ToolbarPopover>
            <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-0.5" />
            <button onClick={() => setViewMode('list')} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', viewMode === 'list' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')} title="Liste"><LayoutList className="h-4 w-4" /></button>
            <button onClick={() => setViewMode('box')} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', viewMode === 'box' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')} title="Kutu"><LayoutGrid className="h-4 w-4" /></button>
          </div>
          <button onClick={openNewModal} className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />{config.addLabel}
          </button>
        </div>
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
        <>
          {viewMode === 'list' && (
            <AnimatedList className="space-y-3">
              {sortedRecords.map((record) => (
                <AnimatedItem
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
                </AnimatedItem>
              ))}
            </AnimatedList>
          )}
          {viewMode === 'box' && (
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-2">
              {sortedRecords.map((record) => (
                <CompactBoxCard
                  key={record.id}
                  initials={record.title?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'D'}
                  title={record.title}
                  onClick={() => setSelectedRecord(record)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Kayıt Detay Modal ── */}
      {selectedRecord && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 dark:bg-black/50"
            onClick={() => setSelectedRecord(null)}
          />
          <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setSelectedRecord(null)}>
            <div
              className="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex-shrink-0">
                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">Kayıt Detayı</h3>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Avatar + title */}
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-pulse-50 dark:bg-pulse-900/20">
                    <Icon className="h-8 w-8 text-pulse-600 dark:text-pulse-400" />
                  </div>
                  <h4 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {selectedRecord.title}
                  </h4>
                  <p className="text-sm text-gray-400 mt-1">{formatDate(selectedRecord.created_at)}</p>
                </div>

                {/* Fields */}
                <div className="space-y-4 text-sm">
                  {config.fields
                    .filter((f) => f.key !== 'title')
                    .map((f) => {
                      const val = selectedRecord.data[f.key]
                      if (!val) return null
                      return (
                        <div key={f.key}>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{f.label}</p>
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

                {/* Dosyalar */}
                {selectedRecord.data.file_urls && Array.isArray(selectedRecord.data.file_urls) && selectedRecord.data.file_urls.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Dosyalar</p>
                    <div className="grid grid-cols-4 gap-3">
                      {selectedRecord.data.file_urls.map((url: string, i: number) => {
                        const isImage = /\.(jpg|jpeg|png|heic|webp)$/i.test(url)
                        return (
                          <div key={i} className="relative group">
                            <button
                              onClick={() => handleDeleteFile(selectedRecord.id, url)}
                              className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600 z-10"
                            >
                              <X className="h-3 w-3" />
                            </button>
                            {isImage ? (
                              <a href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity aspect-square">
                                <img src={url} alt="" className="h-full w-full object-cover" />
                              </a>
                            ) : (
                              <a href={url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors aspect-square">
                                <FileText className="h-8 w-8 text-gray-400 mb-1.5" />
                                <span className="text-xs text-gray-500 truncate w-full text-center">
                                  {decodeURIComponent(url.split('/').pop() || 'Dosya').slice(0, 20)}
                                </span>
                              </a>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex gap-3 flex-shrink-0">
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
        <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="modal-content card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingRecord ? 'Kaydı Düzenle' : config.addLabel}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Danışan / Müşteri Seçimi */}
              {!editingRecord && (
                <div>
                  <label className="label">Danışan Seç (opsiyonel)</label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => {
                      setSelectedCustomerId(e.target.value)
                      if (e.target.value) {
                        const cust = customers.find(c => c.id === e.target.value)
                        if (cust && !formData['title']) {
                          setFormData(prev => ({ ...prev, title: cust.name }))
                        }
                      }
                    }}
                    className="input"
                  >
                    <option value="">— Danışan seçin —</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

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
                      required={f.key === 'title' && !selectedCustomerId}
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
                      required={f.key === 'title' && !selectedCustomerId}
                      autoFocus={f.key === 'title'}
                    />
                  )}
                </div>
              ))}

              {/* Dosya Yükleme */}
              <div>
                <label className="label">Dosya Ekle (opsiyonel)</label>
                <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center hover:border-pulse-300 transition-colors">
                  <input
                    type="file"
                    multiple
                    accept={ACCEPTED_TYPES}
                    onChange={(e) => {
                      if (e.target.files) setUploadFiles(Array.from(e.target.files))
                    }}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Dosya seçmek için tıklayın</p>
                    <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, HEIC, DICOM, TIFF, DOC, DOCX, XLS, XLSX</p>
                  </label>
                </div>
                {uploadFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {uploadFiles.map((file, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-1.5">
                        {file.type.startsWith('image/') ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                        <span className="truncate flex-1">{file.name}</span>
                        <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</span>
                        <button type="button" onClick={() => setUploadFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {formError && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  İptal
                </button>
                <button type="submit" disabled={saving || uploading} className="btn-primary flex-1">
                  {(saving || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {uploading ? 'Yükleniyor...' : editingRecord ? 'Güncelle' : 'Oluştur'}
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
