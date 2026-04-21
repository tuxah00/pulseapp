'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { requirePermission } from '@/lib/hooks/use-require-permission'
import {
  Shield, FileText, Trash2, CheckCircle, Clock,
  AlertTriangle, Loader2, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CustomSelect } from '@/components/ui/custom-select'

interface ConsentRecord {
  id: string
  business_id: string
  customer_id: string | null
  customer_phone: string
  consent_type: 'kvkk' | 'marketing' | 'health_data' | 'whatsapp'
  given_at: string
  revoked_at: string | null
  ip_address: string | null
  method: 'online_form' | 'in_person' | 'phone' | 'whatsapp'
  notes: string | null
  created_at: string
}

interface DeletionRequest {
  id: string
  business_id: string
  customer_id: string | null
  customer_name: string
  customer_phone: string
  requested_at: string
  processed_at: string | null
  status: 'pending' | 'processing' | 'completed' | 'rejected'
  notes: string | null
  processed_by: string | null
  created_at: string
}

const CONSENT_TYPE_LABELS: Record<string, string> = {
  kvkk: 'KVKK Aydınlatma',
  marketing: 'Pazarlama',
  health_data: 'Sağlık Verisi',
  whatsapp: 'WhatsApp',
}

const METHOD_LABELS: Record<string, string> = {
  online_form: 'Online Form',
  in_person: 'Yüz Yüze',
  phone: 'Telefon',
  whatsapp: 'WhatsApp',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Bekliyor',
  processing: 'İşleniyor',
  completed: 'Tamamlandı',
  rejected: 'Reddedildi',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'badge-warning',
  processing: 'badge-info',
  completed: 'badge-success',
  rejected: 'badge-danger',
}

export default function KvkkPage() {
  const { businessId, staffId, loading: ctxLoading, permissions } = useBusinessContext()
  requirePermission(permissions, 'kvkk')
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<'consents' | 'deletions'>('consents')

  // Consent records state
  const [consents, setConsents] = useState<ConsentRecord[]>([])
  const [consentsLoading, setConsentsLoading] = useState(true)
  const [consentTypeFilter, setConsentTypeFilter] = useState<string>('')
  const [revokingId, setRevokingId] = useState<string | null>(null)

  // Deletion requests state
  const [deletions, setDeletions] = useState<DeletionRequest[]>([])
  const [deletionsLoading, setDeletionsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchConsents = useCallback(async () => {
    if (!businessId) return
    setConsentsLoading(true)

    let query = supabase
      .from('consent_records')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })

    if (consentTypeFilter) {
      query = query.eq('consent_type', consentTypeFilter)
    }

    const { data } = await query
    if (data) setConsents(data)
    setConsentsLoading(false)
  }, [businessId, consentTypeFilter, supabase])

  const fetchDeletions = useCallback(async () => {
    if (!businessId) return
    setDeletionsLoading(true)

    const { data } = await supabase
      .from('data_deletion_requests')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })

    if (data) setDeletions(data)
    setDeletionsLoading(false)
  }, [businessId, supabase])

  useEffect(() => {
    if (!ctxLoading) {
      fetchConsents()
      fetchDeletions()
    }
  }, [fetchConsents, fetchDeletions, ctxLoading])

  async function handleRevokeConsent(consentId: string) {
    setRevokingId(consentId)
    await supabase
      .from('consent_records')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', consentId)
    setRevokingId(null)
    fetchConsents()
  }

  async function handleUpdateDeletionStatus(requestId: string, newStatus: string) {
    setUpdatingId(requestId)
    const updateData: Record<string, string | null> = { status: newStatus }

    if (newStatus === 'completed' || newStatus === 'rejected') {
      updateData.processed_at = new Date().toISOString()
      updateData.processed_by = staffId || null
    }
    if (newStatus === 'processing') {
      updateData.processed_at = null
      updateData.processed_by = null
    }

    await supabase
      .from('data_deletion_requests')
      .update(updateData)
      .eq('id', requestId)

    setUpdatingId(null)
    fetchDeletions()
  }

  // Stats
  const totalConsents = consents.length
  const activeConsents = consents.filter(c => !c.revoked_at).length
  const revokedConsents = consents.filter(c => c.revoked_at).length
  const pendingDeletions = deletions.filter(d => d.status === 'pending').length

  if (consentsLoading && deletionsLoading && ctxLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-pulse-900" />
      </div>
    )
  }

  return (
    <div>
      {/* Başlık */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">KVKK Yönetimi</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Kişisel veri izinleri ve silme talepleri
          </p>
        </div>
      </div>

      {/* İstatistik Kartları */}
      <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{totalConsents}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Toplam Onay</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{activeConsents}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Aktif Onay</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-red-600">{revokedConsents}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">İptal Edilen</p>
        </div>
        <div className="card p-4 text-center">
          <p className={cn('text-3xl font-bold', pendingDeletions > 0 ? 'text-amber-600' : 'text-green-600')}>
            {pendingDeletions}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Bekleyen Silme Talebi</p>
        </div>
      </div>

      {/* Sekmeler */}
      <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('consents')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            activeTab === 'consents'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          )}
        >
          <Shield className="h-4 w-4" />
          Onay Kayıtları
        </button>
        <button
          onClick={() => setActiveTab('deletions')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            activeTab === 'deletions'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          )}
        >
          <Trash2 className="h-4 w-4" />
          Veri Silme Talepleri
          {pendingDeletions > 0 && (
            <span className="badge-warning">
              {pendingDeletions}
            </span>
          )}
        </button>
      </div>

      {/* Onay Kayıtları Sekmesi */}
      {activeTab === 'consents' && (
        <div>
          {/* Filtre */}
          <div className="card mb-4 p-3 flex items-center gap-3">
            <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <CustomSelect
              options={Object.entries(CONSENT_TYPE_LABELS).map(([key, label]) => ({ value: key, label }))}
              value={consentTypeFilter}
              onChange={(v) => setConsentTypeFilter(v)}
              placeholder="Tüm Onay Türleri"
              className="w-48"
            />
            {consentTypeFilter && (
              <button
                onClick={() => setConsentTypeFilter('')}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-3.5 w-3.5" /> Temizle
              </button>
            )}
          </div>

          {consentsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-pulse-900" />
            </div>
          ) : consents.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-16">
              <Shield className="mb-4 h-12 w-12 text-gray-300" />
              <p className="text-gray-500">
                {consentTypeFilter ? 'Bu türde onay kaydı bulunamadı' : 'Henüz onay kaydı yok'}
              </p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table-base">
                <thead className="table-head-row">
                  <tr>
                    <th className="table-head-cell">Telefon</th>
                    <th className="table-head-cell">Onay Türü</th>
                    <th className="table-head-cell">Yöntem</th>
                    <th className="table-head-cell">Verilme Tarihi</th>
                    <th className="table-head-cell">Durum</th>
                    <th className="table-head-cell">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {consents.map((consent) => (
                    <tr key={consent.id} className="table-row">
                      <td className="table-cell font-medium text-gray-900 dark:text-gray-100">
                        {consent.customer_phone}
                      </td>
                      <td className="table-cell">
                        <span className="badge-info">
                          {CONSENT_TYPE_LABELS[consent.consent_type] ?? consent.consent_type}
                        </span>
                      </td>
                      <td className="table-cell text-gray-600 dark:text-gray-400">
                        {METHOD_LABELS[consent.method] ?? consent.method}
                      </td>
                      <td className="table-cell text-gray-500 whitespace-nowrap">
                        {new Date(consent.given_at).toLocaleString('tr-TR')}
                      </td>
                      <td className="table-cell">
                        {consent.revoked_at ? (
                          <span className="badge-danger">
                            <X className="h-3 w-3 mr-1" />
                            İptal Edildi
                          </span>
                        ) : (
                          <span className="badge-success">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Aktif
                          </span>
                        )}
                      </td>
                      <td className="table-cell">
                        {!consent.revoked_at && (
                          <button
                            onClick={() => handleRevokeConsent(consent.id)}
                            disabled={revokingId === consent.id}
                            className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium flex items-center gap-1 disabled:opacity-50"
                          >
                            {revokingId === consent.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            İptal Et
                          </button>
                        )}
                        {consent.revoked_at && (
                          <span className="text-xs text-gray-400">
                            {new Date(consent.revoked_at).toLocaleDateString('tr-TR')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Veri Silme Talepleri Sekmesi */}
      {activeTab === 'deletions' && (
        <div>
          {deletionsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-pulse-900" />
            </div>
          ) : deletions.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-16">
              <Trash2 className="mb-4 h-12 w-12 text-gray-300" />
              <p className="text-gray-500">Henüz veri silme talebi yok</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table-base">
                <thead className="table-head-row">
                  <tr>
                    <th className="table-head-cell">Müşteri</th>
                    <th className="table-head-cell">Telefon</th>
                    <th className="table-head-cell">Talep Tarihi</th>
                    <th className="table-head-cell">Durum</th>
                    <th className="table-head-cell hidden md:table-cell">İşlenme Tarihi</th>
                    <th className="table-head-cell">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {deletions.map((request) => (
                    <tr key={request.id} className={cn(
                      'table-row',
                      request.status === 'pending' && 'bg-amber-50/30 dark:bg-amber-900/10'
                    )}>
                      <td className="table-cell font-medium text-gray-900 dark:text-gray-100">
                        {request.customer_name}
                      </td>
                      <td className="table-cell text-gray-600 dark:text-gray-400">
                        {request.customer_phone}
                      </td>
                      <td className="table-cell text-gray-500 whitespace-nowrap">
                        {new Date(request.requested_at).toLocaleString('tr-TR')}
                      </td>
                      <td className="table-cell">
                        <span className={STATUS_COLORS[request.status]}>
                          {request.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                          {request.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                          {request.status === 'rejected' && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {request.status === 'processing' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          {STATUS_LABELS[request.status]}
                        </span>
                      </td>
                      <td className="table-cell text-gray-500 text-xs hidden md:table-cell">
                        {request.processed_at
                          ? new Date(request.processed_at).toLocaleString('tr-TR')
                          : '—'}
                      </td>
                      <td className="table-cell">
                        {(request.status === 'pending' || request.status === 'processing') && (
                          <div className="relative">
                            <CustomSelect
                              options={[
                                ...(request.status === 'pending' ? [{ value: 'processing', label: 'İşleniyor' }] : []),
                                { value: 'completed', label: 'Tamamlandı' },
                                { value: 'rejected', label: 'Reddedildi' },
                              ]}
                              value=""
                              onChange={(v) => {
                                if (v) handleUpdateDeletionStatus(request.id, v)
                              }}
                              placeholder="Durum Değiştir"
                              disabled={updatingId === request.id}
                              className="min-w-[130px]"
                            />
                            {updatingId === request.id && (
                              <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-gray-400" />
                            )}
                          </div>
                        )}
                        {request.status === 'completed' && (
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> İşlendi
                          </span>
                        )}
                        {request.status === 'rejected' && (
                          <span className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Reddedildi
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
