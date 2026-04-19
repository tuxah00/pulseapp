'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { requirePermission } from '@/lib/hooks/use-require-permission'
import { Plus, Pencil, Trash2, Loader2, Banknote, LayoutList, LayoutGrid, ArrowUpDown, X } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { Portal } from '@/components/ui/portal'
import { useViewMode } from '@/lib/hooks/use-view-mode'
import type { Service } from '@/types'
import { logAudit } from '@/lib/utils/audit'
import { getContraindicationLabel, isMedicalSector } from '@/lib/config/sector-labels'
import { AnimatedList, AnimatedItem } from '@/components/ui/animated-list'
import { ToolbarPopover, SortPopoverContent } from '@/components/ui/toolbar-popover'
import { CustomSelect } from '@/components/ui/custom-select'

export default function ServicesPage() {
  const { businessId, staffId: currentStaffId, staffName: currentStaffName, sector, loading: ctxLoading, permissions } = useBusinessContext()
  const contraindicationLabel = getContraindicationLabel(sector)
  const contraindicationHelp = isMedicalSector(sector)
    ? 'Bu hizmet hangi alerjenlerde risk oluşturur?'
    : 'Bu hizmetten önce müşteriye sorulması gereken durumlar (alerji, özel koşul vb.)'
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [isClosingModal, setIsClosingModal] = useState(false)
  const closeModal = () => setIsClosingModal(true)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useViewMode('services', 'list')
  const { confirm } = useConfirm()
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [contraindications, setContraindications] = useState<any[]>([])
  const [pendingContraindications, setPendingContraindications] = useState<{allergen: string, risk_level: string}[]>([])

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [price, setPrice] = useState('')
  const [recommendedInterval, setRecommendedInterval] = useState('')

  const supabase = createClient()

  const fetchServices = useCallback(async () => {
    if (!businessId) return
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (data) setServices(data)
    if (error) console.error('Hizmet çekme hatası:', error)
    setLoading(false)
  }, [businessId])

  const fetchContraindications = useCallback(async (serviceId: string) => {
    if (!businessId) return
    const { data } = await supabase
      .from('service_contraindications')
      .select('*')
      .eq('business_id', businessId)
      .eq('service_id', serviceId)
      .order('created_at', { ascending: false })
    setContraindications(data || [])
  }, [businessId])

  useEffect(() => {
    if (!ctxLoading) fetchServices()
  }, [fetchServices, ctxLoading])

  function openNewModal() {
    setEditingService(null)
    setName('')
    setDescription('')
    setDurationMinutes(30)
    setPrice('')
    setRecommendedInterval('')
    setError(null)
    setContraindications([])
    setPendingContraindications([])
    setShowModal(true)
  }

  function openEditModal(service: Service) {
    setEditingService(service)
    setName(service.name)
    setDescription(service.description || '')
    setDurationMinutes(service.duration_minutes)
    setPrice(service.price ? String(service.price) : '')
    setRecommendedInterval(service.recommended_interval_days ? String(service.recommended_interval_days) : '')
    setError(null)
    setShowModal(true)
    fetchContraindications(service.id)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const serviceData = {
      name,
      description: description || null,
      duration_minutes: durationMinutes,
      price: price ? parseFloat(price) : null,
      recommended_interval_days: recommendedInterval ? parseInt(recommendedInterval) : null,
      business_id: businessId,
    }

    if (editingService) {
      // Güncelle
      const { error } = await supabase
        .from('services')
        .update({ name, description: description || null, duration_minutes: durationMinutes, price: price ? parseFloat(price) : null, recommended_interval_days: recommendedInterval ? parseInt(recommendedInterval) : null })
        .eq('id', editingService.id)

      if (error) {
        setError('Güncelleme hatası: ' + error.message)
        setSaving(false)
        return
      }
    } else {
      // Yeni ekle
      const { data: newService, error } = await supabase
        .from('services')
        .insert(serviceData)
        .select()
        .single()

      if (error) {
        setError('Ekleme hatası: ' + error.message)
        setSaving(false)
        return
      }

      // Pending kontrendikasyonları kaydet
      if (newService && pendingContraindications.length > 0) {
        await supabase.from('service_contraindications').insert(
          pendingContraindications.map(c => ({
            business_id: businessId,
            service_id: newService.id,
            allergen: c.allergen,
            risk_level: c.risk_level,
          }))
        )
      }
    }

    setSaving(false)
    closeModal()
    fetchServices()
    window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: editingService ? 'Hizmet güncellendi' : 'Hizmet eklendi' } }))
    await logAudit({
      businessId: businessId!,
      staffId: currentStaffId,
      staffName: currentStaffName,
      action: editingService ? 'update' : 'create',
      resource: 'service',
      resourceId: editingService?.id,
      details: {
        service_name: name,
        ...(editingService && editingService.price !== (price ? parseFloat(price) : null) ? {
          old_price: editingService.price,
          new_price: price ? parseFloat(price) : null,
        } : {}),
        ...(editingService && editingService.duration_minutes !== durationMinutes ? {
          old_duration: editingService.duration_minutes,
          new_duration: durationMinutes,
        } : {}),
      },
    })
  }

  async function handleDelete(service: Service) {
    const ok = await confirm({ title: 'Onay', message: `"${service.name}" hizmetini silmek istediğinize emin misiniz?` })
    if (!ok) return

    const { error } = await supabase
      .from('services')
      .update({ is_active: false })
      .eq('id', service.id)

    if (error) {
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: 'Silme hatası: ' + error.message } }))
      return
    }

    fetchServices()
    window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Hizmet silindi' } }))
    await logAudit({
      businessId: businessId!,
      staffId: currentStaffId,
      staffName: currentStaffName,
      action: 'delete',
      resource: 'service',
      resourceId: service.id,
      details: { service_name: service.name, price: service.price },
    })
  }

  requirePermission(permissions, 'services')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-pulse-900" />
      </div>
    )
  }

  const sortedServices = sortField
    ? [...services].sort((a, b) => {
        const va = (a as any)[sortField]
        const vb = (b as any)[sortField]
        if (va == null && vb == null) return 0
        if (va == null) return 1
        if (vb == null) return -1
        const cmp = typeof va === 'string' ? va.localeCompare(vb, 'tr') : (va as number) - (vb as number)
        return sortDir === 'asc' ? cmp : -cmp
      })
    : services

  return (
    <div>
      {/* Başlık */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Hizmetler</h1>
          <p className="mt-1 text-sm text-gray-500">
            İşletmenizin sunduğu hizmetleri tanımlayın.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <ToolbarPopover icon={<ArrowUpDown className="h-4 w-4" />} label="Sırala" active={sortField !== null}>
              <SortPopoverContent options={[{ value: 'name', label: 'İsim' }, { value: 'price', label: 'Fiyat' }, { value: 'duration_minutes', label: 'Süre' }]} sortField={sortField} sortDir={sortDir} onSortField={setSortField} onSortDir={setSortDir} />
            </ToolbarPopover>
            <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-0.5" />
            <button onClick={() => setViewMode('list')} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', viewMode === 'list' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')} title="Liste"><LayoutList className="h-4 w-4" /></button>
            <button onClick={() => setViewMode('box')} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', viewMode === 'box' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')} title="Kutular"><LayoutGrid className="h-4 w-4" /></button>
          </div>
          <button onClick={openNewModal} className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />
            Yeni Hizmet
          </button>
        </div>
      </div>

      {/* Hizmet Listesi / Kutular */}
      {services.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pulse-50">
            <Banknote className="h-8 w-8 text-pulse-400" />
          </div>
          <p className="text-gray-500 mb-4">Henüz hizmet eklenmemiş</p>
          <button onClick={openNewModal} className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />
            İlk Hizmeti Ekle
          </button>
        </div>
      ) : (
        <div key={viewMode} className="view-transition">
        {viewMode === 'list' ? (
        <AnimatedList className="space-y-3">
          {sortedServices.map((service) => (
            <AnimatedItem
              key={service.id}
              className="card flex items-center gap-4 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
                {service.description && (
                  <p className="text-sm text-gray-500 mt-0.5 truncate">{service.description}</p>
                )}
                <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                  <span>{service.duration_minutes} dk</span>
                  {service.price && (
                    <span className="flex items-center gap-1">
                      <Banknote className="h-3.5 w-3.5" />
                      <span className="text-price">{formatCurrency(service.price)}</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEditModal(service)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => handleDelete(service)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 className="h-4 w-4" /></button>
              </div>
            </AnimatedItem>
          ))}
        </AnimatedList>
      ) : (
        <AnimatedList className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {sortedServices.map((service) => (
            <AnimatedItem key={service.id} className="card flex aspect-square flex-col justify-between p-4 hover:shadow-md transition-shadow">
              <div className="flex flex-col items-center gap-1 text-center">
                <h3 className="text-lg font-semibold text-gray-900 truncate w-full">{service.name}</h3>
                {service.description && <p className="text-xs text-gray-500 truncate w-full">{service.description}</p>}
              </div>
              <div className="mt-2 space-y-0.5 text-center text-sm text-gray-600">
                <p>{service.duration_minutes} dk</p>
                {service.price && (
                  <p className="flex items-center justify-center gap-1">
                    <Banknote className="h-3.5 w-3.5" />
                    <span className="text-price">{formatCurrency(service.price)}</span>
                  </p>
                )}
              </div>
              <div className="mt-3 flex items-center justify-center gap-2">
                <button onClick={() => openEditModal(service)} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => handleDelete(service)} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </AnimatedItem>
          ))}
        </AnimatedList>
        )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <Portal>
        <div className={`modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 ${isClosingModal ? 'closing' : ''}`} onAnimationEnd={() => { if (isClosingModal) { setShowModal(false); setIsClosingModal(false) } }}>
          <div className={`modal-content card w-full max-w-md ${isClosingModal ? 'closing' : ''}`}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingService ? 'Hizmeti Düzenle' : 'Yeni Hizmet Ekle'}
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="serviceName" className="label">Hizmet Adı</label>
                <input
                  id="serviceName"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder="Saç Kesimi"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="serviceDesc" className="label">Açıklama (opsiyonel)</label>
                <input
                  id="serviceDesc"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input"
                  placeholder="Yıkama dahil"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="duration" className="label">Süre (dakika)</label>
                  <CustomSelect
                    options={[15, 20, 30, 45, 60, 75, 90, 120, 150, 180].map((d) => ({
                      value: String(d),
                      label: `${d} dk${d >= 60 ? ` (${d / 60} saat)` : ''}`,
                    }))}
                    value={String(durationMinutes)}
                    onChange={v => setDurationMinutes(Number(v))}
                  />
                </div>

                <div>
                  <label htmlFor="price" className="label">Fiyat (TL)</label>
                  <input
                    id="price"
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="input"
                    placeholder="150"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="recommendedInterval" className="label">Önerilen Tekrar Süresi (gün)</label>
                <input
                  id="recommendedInterval"
                  type="number"
                  value={recommendedInterval}
                  onChange={(e) => setRecommendedInterval(e.target.value)}
                  className="input"
                  placeholder="ör. 180 (6 ay)"
                  min="0"
                />
                <p className="text-xs text-gray-400 mt-1">Periyodik hatırlatma için. Boş bırakılırsa hatırlatma gönderilmez.</p>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{contraindicationLabel}</h4>
                <p className="text-xs text-gray-400 mb-3">{contraindicationHelp}</p>

                {/* Mevcut kontrendikasyonlar (düzenleme modu) */}
                {editingService && contraindications.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-2 mb-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{c.allergen}</span>
                    <button type="button" onClick={async () => {
                      await supabase.from('service_contraindications').delete().eq('id', c.id)
                      fetchContraindications(editingService.id)
                    }} className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                {/* Bekleyen kontrendikasyonlar (yeni hizmet modu) */}
                {!editingService && pendingContraindications.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-2 mb-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{c.allergen}</span>
                    <button type="button" onClick={() => setPendingContraindications(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                {/* Yeni ekle */}
                <div className="flex items-center gap-2 mt-2">
                  <input placeholder="Alerjen" id="ci-allergen" className="input text-sm flex-1 min-w-0" />
                  <button type="button" onClick={async () => {
                    const allergen = (document.getElementById('ci-allergen') as HTMLInputElement).value.trim()
                    if (!allergen) return
                    if (editingService) {
                      await supabase.from('service_contraindications').insert({
                        business_id: businessId,
                        service_id: editingService.id,
                        allergen,
                        risk_level: 'high',
                      })
                      fetchContraindications(editingService.id)
                    } else {
                      setPendingContraindications(prev => [...prev, { allergen, risk_level: 'high' }])
                    }
                    ;(document.getElementById('ci-allergen') as HTMLInputElement).value = ''
                  }} className="btn-secondary text-sm px-3 flex-shrink-0">
                    Ekle
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-secondary flex-1"
                >
                  İptal
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {editingService ? 'Güncelle' : 'Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}
    </div>
  )
}
