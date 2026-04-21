'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { requirePermission } from '@/lib/hooks/use-require-permission'
import { Shield, ShieldX, Loader2, Search, Filter, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CustomSelect } from '@/components/ui/custom-select'
import { getCustomerLabelSingular } from '@/lib/config/sector-modules'

interface AuditLog {
  id: string
  staff_name: string | null
  action: string
  resource: string
  details: Record<string, string | number | boolean | null> | null
  ip_address: string | null
  created_at: string
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Oluşturdu',
  update: 'Güncelledi',
  delete: 'Sildi',
  login: 'Giriş Yaptı',
  status_change: 'Durum Değiştirdi',
  send: 'Gönderdi',
  pay: 'Ödeme Aldı',
  cancel: 'İptal Etti',
  restore: 'Geri Yükledi',
  assign: 'Atadı',
  revoke: 'İptal Etti',
  request: 'Talep Etti',
}

const RESOURCE_LABELS: Record<string, string> = {
  appointment: 'Randevu',
  customer: 'Müşteri',
  staff: 'Personel',
  service: 'Hizmet',
  settings: 'Ayarlar',
  permissions: 'Yetki',
  inventory: 'Stok',
  shift: 'Vardiya',
  expense: 'Gider',
  invoice: 'Fatura',
  stock_movement: 'Stok Hareketi',
  patient_record: 'Hasta Dosyası',
  patient_record_file: 'Hasta Dosyası',
  message: 'Mesaj',
  portfolio: 'Çalışma Galerisi',
  membership: 'Üyelik',
  service_packages: 'Paket Şablonu',
  customer_packages: 'Müşteri Paketi',
  pos_transaction: 'Kasa İşlemi',
  pos_session: 'Kasa Oturumu',
  income: 'Gelir',
  class: 'Sınıf',
  class_session: 'Sınıf Seansı',
  attendance: 'Devam Kaydı',
  reservation: 'Rezervasyon',
  review: 'Yorum',
  notification: 'Bildirim',
  order: 'Sipariş',
  reward: 'Ödül Şablonu',
  customer_reward: 'Müşteri Ödülü',
  referral: 'Referans',
  consent: 'KVKK Rızası',
  data_deletion_request: 'Veri Silme Talebi',
  staff_invitation: 'Personel Daveti',
  follow_up: 'Takip',
  protocol: 'Tedavi Protokolü',
  allergy: 'Alerji',
  campaign: 'Kampanya',
  waitlist: 'Bekleme Listesi',
  tooth_record: 'Diş Kaydı',
  contraindication: 'Kontrendikasyon',
  blocked_slot: 'Bloklanmış Zaman',
  room: 'Oda',
  photo: 'Fotoğraf',
  payment: 'Ödeme',
}

const STATUS_LABELS_TR: Record<string, string> = {
  confirmed: 'Onaylandı',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
  no_show: 'Gelmedi',
  pending: 'Bekliyor',
}

function formatAuditDetail(log: AuditLog): string {
  const d = log.details
  if (!d) return ''

  // Yetki değişikliği
  if (log.resource === 'permissions') {
    const label = d.permission_label || d.permission_key || ''
    const enabled = d.enabled === true || d.enabled === 'true'
    const target = d.target_name || ''
    return `${target}: "${label}" yetkisi ${enabled ? 'açıldı' : 'kapatıldı'}`
  }

  // Randevu durum değişikliği
  if (log.action === 'status_change' && log.resource === 'appointment') {
    const from = STATUS_LABELS_TR[String(d.from || '')] || d.from || ''
    const to = STATUS_LABELS_TR[String(d.to || '')] || d.to || ''
    const name = d.customer_name || ''
    return `${name ? name + ' — ' : ''}${from} → ${to}`
  }

  // Randevu oluşturma/silme
  if (log.resource === 'appointment') {
    const parts: string[] = []
    if (d.customer_name) parts.push(String(d.customer_name))
    if (d.service_name) parts.push(String(d.service_name))
    if (d.date) parts.push(String(d.date))
    if (d.time) parts.push(String(d.time))
    return parts.join(' · ')
  }

  // Hizmet fiyat değişikliği
  if (log.resource === 'service' && (d.old_price !== undefined || d.new_price !== undefined)) {
    const svcName = d.service_name || d.name || ''
    if (d.old_price !== undefined && d.new_price !== undefined) {
      return `${svcName}${svcName ? ': ' : ''}₺${d.old_price} → ₺${d.new_price}`
    }
    return svcName ? `${svcName}${d.new_price != null ? ` · ₺${d.new_price}` : ''}` : ''
  }

  // Hizmet oluşturma/silme
  if (log.resource === 'service') {
    const svcName = d.service_name || d.name
    const parts: string[] = []
    if (svcName) parts.push(String(svcName))
    if (d.duration_minutes) parts.push(`${d.duration_minutes} dk`)
    if (d.new_price != null) parts.push(`₺${d.new_price}`)
    return parts.join(' · ')
  }

  // Fatura
  if (log.resource === 'invoice') {
    const parts: string[] = []
    if (d.invoice_number) parts.push(String(d.invoice_number))
    if (d.customer_name) parts.push(String(d.customer_name))
    if (d.total !== undefined) parts.push(`₺${d.total}`)
    return parts.join(' · ')
  }

  // Gider
  if (log.resource === 'expense') {
    const parts: string[] = []
    if (d.category) parts.push(String(d.category))
    if (d.amount !== undefined) parts.push(`₺${d.amount}`)
    if (d.description) parts.push(String(d.description))
    return parts.join(' · ')
  }

  // Stok hareketi
  if (log.resource === 'stock_movement') {
    const parts: string[] = []
    if (d.product_name) parts.push(String(d.product_name))
    if (d.quantity !== undefined && d.quantity !== null) parts.push(`${Number(d.quantity) > 0 ? '+' : ''}${d.quantity}`)
    if (d.type) parts.push(String(d.type))
    return parts.join(' · ')
  }

  // Hasta / müşteri dosyası
  if (log.resource === 'patient_record') {
    return d.customer_name ? String(d.customer_name) : (d.title ? String(d.title) : '')
  }

  // Mesaj
  if (log.resource === 'message') {
    const parts: string[] = []
    if (d.customer_name) parts.push(String(d.customer_name))
    if (d.channel) parts.push(String(d.channel))
    return parts.join(' · ')
  }

  // Portfolyo
  if (log.resource === 'portfolio') {
    return d.title ? String(d.title) : ''
  }

  // Üyelik
  if (log.resource === 'membership') {
    return d.customer_name ? String(d.customer_name) : (d.name ? String(d.name) : '')
  }

  // Paket şablonu
  if (log.resource === 'service_packages') {
    const parts: string[] = []
    if (d.name) parts.push(String(d.name))
    if (d.sessions_total !== undefined) parts.push(`${d.sessions_total} seans`)
    return parts.join(' · ')
  }

  // Müşteri paketi
  if (log.resource === 'customer_packages') {
    const parts: string[] = []
    if (d.customer_name) parts.push(String(d.customer_name))
    if (d.package_name) parts.push(String(d.package_name))
    if (d.action) parts.push(String(d.action) === 'use_session' ? 'seans düşüldü' : String(d.action))
    return parts.join(' · ')
  }

  // Ayarlar
  if (log.resource === 'settings') {
    const parts: string[] = []
    if (d.section) parts.push(String(d.section))
    if (d.fields) parts.push(String(d.fields))
    if (d.field) parts.push(String(d.field))
    if (d.old_value !== undefined && d.new_value !== undefined) {
      parts.push(`${d.old_value} → ${d.new_value}`)
    }
    return parts.join(' · ') || 'Ayarlar güncellendi'
  }

  // Müşteri
  if (d.name) return String(d.name)

  // Personel
  if (log.resource === 'staff') {
    const parts: string[] = []
    if (d.name) parts.push(String(d.name))
    if (d.role) parts.push(`(${d.role})`)
    return parts.join(' ')
  }

  // Ödül şablonu
  if (log.resource === 'reward') {
    const parts: string[] = []
    if (d.name) parts.push(String(d.name))
    if (d.type) parts.push(String(d.type))
    if (d.value !== undefined && d.value !== null) parts.push(`₺${d.value}`)
    return parts.join(' · ')
  }

  // Müşteri ödülü
  if (log.resource === 'customer_reward') {
    const parts: string[] = []
    if (d.customer_name) parts.push(String(d.customer_name))
    if (d.reward_name) parts.push(String(d.reward_name))
    if (d.status) {
      const statusLabel = d.status === 'used' ? 'kullanıldı' : d.status === 'pending' ? 'bekliyor' : String(d.status)
      parts.push(statusLabel)
    }
    return parts.join(' · ')
  }

  // Referans
  if (log.resource === 'referral') {
    const parts: string[] = []
    if (d.referrer_name) parts.push(`Referans: ${d.referrer_name}`)
    if (d.referred_name) parts.push(`→ ${d.referred_name}`)
    if (d.status) parts.push(d.status === 'rewarded' ? 'Ödül Verildi' : 'Bekliyor')
    return parts.join(' · ')
  }

  // KVKK Rızası
  if (log.resource === 'consent') {
    const typeLabels: Record<string, string> = { kvkk: 'KVKK', marketing: 'Pazarlama', health_data: 'Sağlık Verisi', whatsapp: 'WhatsApp' }
    const parts: string[] = []
    if (d.consent_type) parts.push(typeLabels[String(d.consent_type)] || String(d.consent_type))
    if (d.method) parts.push(String(d.method))
    if (d.customer_phone) parts.push(String(d.customer_phone))
    return parts.join(' · ')
  }

  // Veri Silme Talebi
  if (log.resource === 'data_deletion_request') {
    const parts: string[] = []
    if (d.customer_name) parts.push(String(d.customer_name))
    if (d.customer_phone) parts.push(String(d.customer_phone))
    return parts.join(' · ')
  }

  // Personel Daveti
  if (log.resource === 'staff_invitation') {
    const parts: string[] = []
    if (d.email) parts.push(String(d.email))
    if (d.role) parts.push(`(${d.role})`)
    return parts.join(' ')
  }

  // Takip
  if (log.resource === 'follow_up') {
    const parts: string[] = []
    if (d.customer_name) parts.push(String(d.customer_name))
    if (d.type) parts.push(String(d.type))
    if (d.scheduled_for) parts.push(String(d.scheduled_for))
    return parts.join(' · ')
  }

  // Tedavi Protokolü
  if (log.resource === 'protocol') {
    const parts: string[] = []
    if (d.customer_name) parts.push(String(d.customer_name))
    if (d.name) parts.push(String(d.name))
    if (d.total_sessions !== undefined) parts.push(`${d.total_sessions} seans`)
    return parts.join(' · ')
  }

  // Alerji
  if (log.resource === 'allergy') {
    const parts: string[] = []
    if (d.customer_name) parts.push(String(d.customer_name))
    if (d.allergen) parts.push(String(d.allergen))
    if (d.severity) parts.push(String(d.severity))
    return parts.join(' · ')
  }

  return ''
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  delete: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  login: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  status_change: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  send: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  pay: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancel: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  restore: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  assign: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  revoke: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  request: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
}

export default function AuditPage() {
  const { staffRole, businessId, sector, loading: ctxLoading, permissions } = useBusinessContext()
  const customerLabel = getCustomerLabelSingular(sector ?? undefined)

  // RESOURCE_LABELS'ı dinamik hale getir (sector'e bağlı)
  const resourceLabels: Record<string, string> = {
    ...RESOURCE_LABELS,
    customer: customerLabel,
    customer_packages: `${customerLabel} Paketi`,
  }
  const supabase = createClient()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [resourceFilter, setResourceFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [staffFilter, setStaffFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [searchText, setSearchText] = useState('')
  const [staffList, setStaffList] = useState<{id: string; name: string}[]>([])
  const limit = 20

  // Personel listesi yükle
  useEffect(() => {
    if (!businessId) return
    supabase.from('staff_members').select('id, name').eq('business_id', businessId).eq('is_active', true).order('name')
      .then(({ data }) => setStaffList(data || []))
  }, [businessId, supabase])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) })
    if (resourceFilter) params.set('resource', resourceFilter)
    if (actionFilter) params.set('action', actionFilter)
    if (staffFilter) params.set('staff_id', staffFilter)
    if (fromDate) params.set('from_date', fromDate)
    if (toDate) params.set('to_date', toDate)
    if (searchText.trim()) params.set('search', searchText.trim())
    const res = await fetch(`/api/audit?${params}`)
    if (res.ok) {
      const data = await res.json()
      setLogs(data.logs)
      setTotal(data.total)
    }
    setLoading(false)
  }, [page, resourceFilter, actionFilter, staffFilter, fromDate, toDate, searchText])

  useEffect(() => {
    if (!ctxLoading) fetchLogs()
  }, [fetchLogs, ctxLoading])

  requirePermission(permissions, 'audit')

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Denetim Kaydı</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">İşletmenizdeki tüm eylemler kayıt altında</p>
        </div>
      </div>

      {/* Filtreler */}
      <div className="card mb-4 space-y-3 p-3">
        <div className="flex flex-wrap gap-3 items-center">
          <Filter className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <CustomSelect
            options={Object.entries(resourceLabels).map(([k, v]) => ({ value: k, label: v }))}
            value={resourceFilter}
            onChange={v => { setResourceFilter(v); setPage(0) }}
            placeholder="Tüm Kaynaklar"
          />
          <CustomSelect
            options={Object.entries(ACTION_LABELS).map(([k, v]) => ({ value: k, label: v }))}
            value={actionFilter}
            onChange={v => { setActionFilter(v); setPage(0) }}
            placeholder="Tüm Eylemler"
          />
          <CustomSelect
            options={staffList.map(s => ({ value: s.id, label: s.name }))}
            value={staffFilter}
            onChange={v => { setStaffFilter(v); setPage(0) }}
            placeholder="Tüm Personel"
          />
          <span className="text-sm text-gray-500 ml-auto">Toplam {total} kayıt</span>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Tarih:</span>
            <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(0) }} className="input py-1 text-sm w-auto" />
            <span>—</span>
            <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(0) }} className="input py-1 text-sm w-auto" />
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={searchText}
              onChange={e => { setSearchText(e.target.value); setPage(0) }}
              placeholder="Personel, hasta, eylem, kaynak ara..."
              className="input py-1.5 pl-8 text-sm w-full"
            />
          </div>
          {(resourceFilter || actionFilter || staffFilter || fromDate || toDate || searchText) && (
            <button
              onClick={() => { setResourceFilter(''); setActionFilter(''); setStaffFilter(''); setFromDate(''); setToDate(''); setSearchText(''); setPage(0) }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <X className="h-3.5 w-3.5" /> Temizle
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-pulse-900" />
        </div>
      ) : logs.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16">
          <Shield className="mb-4 h-12 w-12 text-gray-300" />
          <p className="text-gray-500">Henüz kayıt yok</p>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="table-base">
              <thead className="table-head-row">
                <tr>
                  <th className="table-head-cell">Zaman</th>
                  <th className="table-head-cell">Personel</th>
                  <th className="table-head-cell">Eylem</th>
                  <th className="table-head-cell">Kaynak</th>
                  <th className="table-head-cell hidden md:table-cell">Detay</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="table-row">
                    <td className="table-cell text-gray-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('tr-TR')}
                    </td>
                    <td className="table-cell font-medium text-gray-900 dark:text-gray-100">
                      <div className="flex items-center gap-2">
                        <span>{log.staff_name ?? 'Sistem'}</span>
                        {log.details?.via === 'ai_assistant' && (
                          <span className="rounded-full bg-pulse-900/10 text-pulse-900 dark:bg-pulse-300/20 dark:text-pulse-300 px-2 py-0.5 text-[10px] font-medium whitespace-nowrap">
                            PulseApp Asistan
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className={cn('badge text-xs', ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-700')}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="table-cell text-gray-600 dark:text-gray-400">
                      {resourceLabels[log.resource] ?? log.resource}
                    </td>
                    <td className="table-cell text-gray-500 dark:text-gray-400 text-xs hidden md:table-cell max-w-xs truncate" title={formatAuditDetail(log)}>
                      {formatAuditDetail(log) || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sayfalama */}
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="btn-secondary py-1.5 px-3 flex items-center gap-1 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" /> Önceki
            </button>
            <span className="text-sm text-gray-500">{page + 1} / {Math.ceil(total / limit) || 1}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * limit >= total}
              className="btn-secondary py-1.5 px-3 flex items-center gap-1 disabled:opacity-50"
            >
              Sonraki <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
