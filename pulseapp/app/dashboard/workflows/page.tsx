'use client'

import { useState, useEffect, useCallback } from 'react'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useConfirm } from '@/lib/hooks/use-confirm'
import {
  GitBranch, Plus, Trash2, Loader2, X, ToggleLeft, ToggleRight,
  Pencil, Clock, MessageSquare, Zap, TrendingUp
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Portal } from '@/components/ui/portal'
import { CustomSelect } from '@/components/ui/custom-select'
import EmptyState from '@/components/ui/empty-state'

interface WorkflowStep {
  delay_hours: number
  message: string
}

interface Workflow {
  id: string
  name: string
  trigger_type: string
  is_active: boolean
  steps: WorkflowStep[]
  created_at: string
  runs_this_month: number
}

const TRIGGER_LABELS: Record<string, string> = {
  appointment_completed: 'Randevu Tamamlandı',
  appointment_cancelled: 'Randevu İptal Edildi',
  customer_created: 'Yeni Müşteri Oluşturuldu',
  no_show: 'Müşteri Gelmedi',
  birthday: 'Müşteri Doğum Günü',
}

const TRIGGER_OPTIONS = Object.entries(TRIGGER_LABELS).map(([value, label]) => ({ value, label }))

const TRIGGER_COLORS: Record<string, string> = {
  appointment_completed: 'badge-success',
  appointment_cancelled: 'badge-danger',
  customer_created: 'badge-info',
  no_show: 'badge-warning',
  birthday: 'badge bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
}

function formatDelay(hours: number): string {
  if (hours === 0) return 'Hemen'
  if (hours < 24) return `${hours} saat sonra`
  const days = Math.round(hours / 24)
  return `${days} gün sonra`
}

export default function WorkflowsPage() {
  const { businessId } = useBusinessContext()
  const { confirm } = useConfirm()

  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [totalRunsThisMonth, setTotalRunsThisMonth] = useState(0)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [isClosingModal, setIsClosingModal] = useState(false)
  const closeModal = () => setIsClosingModal(true)
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null)
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formTrigger, setFormTrigger] = useState('appointment_completed')
  const [formSteps, setFormSteps] = useState<WorkflowStep[]>([{ delay_hours: 1, message: '' }])

  const toast = (type: string, title: string, body?: string) => {
    window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type, title, body } }))
  }

  const fetchWorkflows = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const res = await fetch('/api/workflows')
      if (!res.ok) throw new Error('Akışlar yüklenemedi')
      const data = await res.json()
      setWorkflows(data.workflows || [])
      setTotalRunsThisMonth(data.totalRunsThisMonth || 0)
    } catch (e: any) {
      toast('error', 'Hata', e.message)
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => { fetchWorkflows() }, [fetchWorkflows])

  // Toggle active
  const handleToggleActive = async (workflow: Workflow) => {
    const newState = !workflow.is_active
    try {
      const res = await fetch(`/api/workflows?id=${workflow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newState }),
      })
      if (!res.ok) throw new Error('Güncelleme başarısız')
      setWorkflows(prev => prev.map(w => w.id === workflow.id ? { ...w, is_active: newState } : w))
      toast('system', newState ? 'Akış Aktif Edildi' : 'Akış Durduruldu')
    } catch (e: any) {
      toast('error', 'Hata', e.message)
    }
  }

  // Delete
  const handleDelete = async (workflow: Workflow) => {
    const ok = await confirm({
      title: 'Otomatik mesaj silinsin mi?',
      message: `"${workflow.name}" ve tüm çalışma geçmişi kalıcı olarak silinecek.`,
      confirmText: 'Sil',
      variant: 'danger',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/workflows?id=${workflow.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Silinemedi')
      setWorkflows(prev => prev.filter(w => w.id !== workflow.id))
      toast('system', 'Silindi')
    } catch (e: any) {
      toast('error', 'Hata', e.message)
    }
  }

  // Open create modal
  const openCreateModal = () => {
    setEditingWorkflow(null)
    setFormName('')
    setFormTrigger('appointment_completed')
    setFormSteps([{ delay_hours: 1, message: '' }])
    setModalError(null)
    setShowModal(true)
    setIsClosingModal(false)
  }

  // Open edit modal
  const openEditModal = (workflow: Workflow) => {
    setEditingWorkflow(workflow)
    setFormName(workflow.name)
    setFormTrigger(workflow.trigger_type)
    setFormSteps([...workflow.steps])
    setModalError(null)
    setShowModal(true)
    setIsClosingModal(false)
  }

  // Add step
  const addStep = () => {
    setFormSteps(prev => [...prev, { delay_hours: 24, message: '' }])
  }

  // Remove step
  const removeStep = (index: number) => {
    setFormSteps(prev => prev.filter((_, i) => i !== index))
  }

  // Update step
  const updateStep = (index: number, field: keyof WorkflowStep, value: string | number) => {
    setFormSteps(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  // Save workflow
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setModalError(null)

    if (!formName.trim()) { setModalError('Akış adı zorunludur'); return }
    for (const step of formSteps) {
      if (!step.message.trim()) { setModalError('Tüm adımlara mesaj giriniz'); return }
    }

    setSaving(true)
    try {
      const payload = {
        name: formName.trim(),
        triggerType: formTrigger,
        steps: formSteps,
      }

      let res: Response
      if (editingWorkflow) {
        res = await fetch(`/api/workflows?id=${editingWorkflow.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/workflows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Kaydedilemedi')
      }

      toast('system', editingWorkflow ? 'Güncellendi' : 'Oluşturuldu')
      closeModal()
      await fetchWorkflows()
    } catch (e: any) {
      setModalError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="h-page">Otomatik Mesajlar</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Belirli bir olay sonrası (örn. randevu bitti) otomatik SMS gönderin.
          </p>
        </div>
        <button onClick={openCreateModal} className="btn-primary shrink-0">
          <Plus className="mr-2 h-4 w-4" />Yeni Otomatik Mesaj
        </button>
      </div>

      {/* İstatistik */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pulse-100 dark:bg-pulse-900/30">
              <GitBranch className="h-5 w-5 text-pulse-900 dark:text-pulse-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{workflows.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Toplam</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
              <Zap className="h-5 w-5 text-green-700 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {workflows.filter(w => w.is_active).length}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Aktif Akış</p>
            </div>
          </div>
        </div>
        <div className="card p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <TrendingUp className="h-5 w-5 text-blue-700 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalRunsThisMonth}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Bu Ay Çalışma</p>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : workflows.length === 0 ? (
        <EmptyState
          icon={<GitBranch className="h-7 w-7" />}
          title="Henüz akış oluşturulmadı"
          description="Randevu tamamlandığında, iptal edildiğinde veya müşteri doğum gününde otomatik mesajlar gönderin."
          action={{ label: 'İlk Akışı Oluştur', onClick: openCreateModal, icon: <Plus className="h-4 w-4 mr-1.5" /> }}
        />
      ) : (
        <div className="space-y-3">
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              className={cn(
                'card p-4 transition-all',
                !workflow.is_active && 'opacity-60'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{workflow.name}</h3>
                    <span className={cn('text-xs', TRIGGER_COLORS[workflow.trigger_type])}>
                      {TRIGGER_LABELS[workflow.trigger_type] || workflow.trigger_type}
                    </span>
                    {workflow.runs_this_month > 0 && (
                      <span className="badge-neutral text-xs">
                        {workflow.runs_this_month} bu ay
                      </span>
                    )}
                  </div>

                  {/* Steps preview */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {workflow.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {i > 0 && <span className="text-gray-300 dark:text-gray-600">→</span>}
                        <Clock className="h-3 w-3" />
                        <span>{formatDelay(step.delay_hours)}</span>
                        <MessageSquare className="h-3 w-3 ml-0.5" />
                      </div>
                    ))}
                    <span className="text-xs text-gray-400">({workflow.steps.length} adım)</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Active toggle */}
                  <button
                    onClick={() => handleToggleActive(workflow)}
                    className={cn(
                      'flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors',
                      workflow.is_active
                        ? 'text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    )}
                  >
                    {workflow.is_active
                      ? <ToggleRight className="h-4 w-4" />
                      : <ToggleLeft className="h-4 w-4" />
                    }
                    {workflow.is_active ? 'Aktif' : 'Pasif'}
                  </button>

                  <button
                    onClick={() => openEditModal(workflow)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(workflow)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <Portal>
          <div
            className={`modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 ${isClosingModal ? 'closing' : ''}`}
            onClick={closeModal}
            onAnimationEnd={() => {
              if (isClosingModal) { setShowModal(false); setIsClosingModal(false) }
            }}
          >
            <div
              className={`modal-content card w-full max-w-xl max-h-[90vh] flex flex-col ${isClosingModal ? 'closing' : ''}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <h2 className="h-section">
                  {editingWorkflow ? 'Düzenle' : 'Yeni Otomatik Mesaj'}
                </h2>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                <form id="workflow-form" onSubmit={handleSave} className="space-y-5">
                  {/* Name */}
                  <div>
                    <label className="label">Ad</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="input"
                      placeholder="Örnek: Randevu Sonrası Teşekkür"
                      required
                      autoFocus
                    />
                  </div>

                  {/* Trigger */}
                  <div>
                    <label className="label">Tetikleyici Olay</label>
                    <CustomSelect
                      value={formTrigger}
                      onChange={setFormTrigger}
                      options={TRIGGER_OPTIONS}
                    />
                  </div>

                  {/* Steps */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="label mb-0">Mesaj Adımları</label>
                      <button
                        type="button"
                        onClick={addStep}
                        className="text-sm text-pulse-900 dark:text-pulse-300 hover:underline flex items-center gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" />Adım Ekle
                      </button>
                    </div>

                    <div className="space-y-4">
                      {formSteps.map((step, index) => (
                        <div key={index} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Adım {index + 1}
                            </span>
                            {formSteps.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeStep(index)}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                              Bekleme Süresi (tetikleyiciden sonra)
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={step.delay_hours}
                                onChange={(e) => updateStep(index, 'delay_hours', parseInt(e.target.value) || 0)}
                                className="input w-24"
                              />
                              <span className="flex items-center text-sm text-gray-500 dark:text-gray-400">saat</span>
                              {step.delay_hours > 0 && (
                                <span className="flex items-center text-xs text-gray-400">
                                  ({formatDelay(step.delay_hours)})
                                </span>
                              )}
                            </div>
                          </div>

                          <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                              Mesaj{' '}
                              <span className="text-gray-400">— Değişkenler: {'{name}'} (müşteri adı), {'{service}'} (hizmet)</span>
                            </label>
                            <textarea
                              value={step.message}
                              onChange={(e) => updateStep(index, 'message', e.target.value)}
                              className="input min-h-[80px] resize-none"
                              placeholder={`Merhaba {name}! ${index === 0 ? 'Randevunuz için teşekkür ederiz. Tekrar görüşmek üzere!' : 'Sizi tekrar görmeyi bekliyoruz!'}`}
                              required
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {modalError && (
                    <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                      {modalError}
                    </div>
                  )}
                </form>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-3 flex gap-3 flex-shrink-0">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">İptal</button>
                <button
                  type="submit"
                  form="workflow-form"
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />}
                  {editingWorkflow ? 'Güncelle' : 'Oluştur'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
