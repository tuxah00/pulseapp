'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { Plus, Pencil, Trash2, Loader2, UserPlus, X, Mail, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StaffMember, StaffRole, StaffPermissions } from '@/types'
import { DEFAULT_PERMISSIONS, getEffectivePermissions } from '@/types'

const ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'İşletme Sahibi',
  manager: 'Yönetici',
  staff: 'Personel',
}

const PERMISSION_LABELS: Record<keyof StaffPermissions, string> = {
  dashboard: 'Genel Bakış',
  appointments: 'Randevular',
  customers: 'Müşteriler',
  analytics: 'Analitik',
  messages: 'Mesajlar',
  reviews: 'Yorumlar',
  services: 'Hizmetler',
  staff: 'Personeller',
  shifts: 'Vardiya',
  settings: 'Ayarlar',
  reservations: 'Rezervasyonlar',
  classes: 'Sınıflar',
  memberships: 'Üyelikler',
  records: 'Dosyalar',
  portfolio: 'Portfolyo',
  inventory: 'Stoklar',
  orders: 'Siparişler',
}

export default function StaffPage() {
  const { businessId, loading: ctxLoading, staffRole: currentUserRole, permissions } = useBusinessContext()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [role, setRole] = useState<StaffRole>('staff')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [permsSaving, setPermsSaving] = useState(false)

  const supabase = createClient()

  const fetchStaff = useCallback(async () => {
    if (!businessId) return
    const { data, error: err } = await supabase
      .from('staff_members')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name')
    if (data) setStaff(data)
    if (err) console.error('Personel çekme hatası:', err)
    setLoading(false)
  }, [businessId])

  useEffect(() => { if (!ctxLoading) fetchStaff() }, [fetchStaff, ctxLoading])

  function openNewModal() {
    setEditingStaff(null)
    setName(''); setRole('staff'); setPhone(''); setEmail('')
    setError(null); setShowModal(true)
  }

  function openEditModal(member: StaffMember) {
    setEditingStaff(member)
    setName(member.name); setRole(member.role)
    setPhone(member.phone || ''); setEmail(member.email || '')
    setError(null); setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null)
    if (editingStaff) {
      const { error: err } = await supabase
        .from('staff_members')
        .update({ name, role, phone: phone || null, email: email || null })
        .eq('id', editingStaff.id)
      if (err) { setError('Güncelleme hatası: ' + err.message); setSaving(false); return }
      setSelectedStaff(prev => prev?.id === editingStaff.id
        ? { ...prev, name, role, phone: phone || null, email: email || null } as StaffMember
        : prev)
    } else {
      const { error: err } = await supabase.from('staff_members').insert({
        business_id: businessId, name, role,
        phone: phone || null, email: email || null, user_id: null, is_active: true,
      })
      if (err) { setError('Ekleme hatası: ' + err.message); setSaving(false); return }
    }
    setSaving(false); setShowModal(false); fetchStaff()
  }

  async function handleDeactivate(member: StaffMember) {
    if (!confirm(`"${member.name}" personelini listeden kaldırmak istediğinize emin misiniz? Randevularda artık seçilemez.`)) return
    const { error: err } = await supabase.from('staff_members').update({ is_active: false }).eq('id', member.id)
    if (err) { alert('İşlem hatası: ' + err.message); return }
    if (selectedStaff?.id === member.id) setSelectedStaff(null)
    fetchStaff()
  }

  async function handlePermissionToggle(member: StaffMember, key: keyof StaffPermissions, value: boolean) {
    setPermsSaving(true)
    const currentPerms = getEffectivePermissions(member.role, member.permissions)
    const newPerms: StaffPermissions = { ...currentPerms, [key]: value }
    const { error: err } = await supabase
      .from('staff_members')
      .update({ permissions: newPerms })
      .eq('id', member.id)
    if (err) {
      console.error('Yetki güncelleme hatası:', err)
    } else {
      setSelectedStaff(prev => prev?.id === member.id ? { ...prev, permissions: newPerms } as StaffMember : prev)
      setStaff(prev => prev.map(s => s.id === member.id ? { ...s, permissions: newPerms } : s))
    }
    setPermsSaving(false)
  }

  if (permissions && !permissions.staff) {
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
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-pulse-500" /></div>
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Personeller</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Randevu atayabileceğiniz personelleri yönetin.
          </p>
        </div>
        <button onClick={openNewModal} className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />Yeni Personel
        </button>
      </div>

      {staff.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16">
          <UserPlus className="mb-4 h-12 w-12 text-gray-300" />
          <p className="text-gray-500 mb-4">Henüz personel eklenmemiş</p>
          <button onClick={openNewModal} className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />İlk Personeli Ekle
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map((member) => (
            <div
              key={member.id}
              onClick={() => setSelectedStaff(member)}
              className={cn(
                'card flex items-center gap-4 p-4 hover:shadow-md transition-all cursor-pointer',
                selectedStaff?.id === member.id && 'ring-2 ring-pulse-500'
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pulse-100 text-pulse-700 font-semibold text-sm flex-shrink-0">
                {member.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{member.name}</span>
                  <span className="badge bg-pulse-100 text-pulse-700">{ROLE_LABELS[member.role]}</span>
                </div>
                {(member.phone || member.email) && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {[member.phone, member.email].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => openEditModal(member)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 transition-colors" title="Düzenle">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => handleDeactivate(member)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors" title="Listeden kaldır">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Personel Detay Slide-Over Paneli ── */}
      {selectedStaff && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 dark:bg-black/50" onClick={() => setSelectedStaff(null)} />
          <div className="slide-panel border-l border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Personel Detayı</h3>
              <button onClick={() => setSelectedStaff(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-pulse-100 text-pulse-700 font-bold text-lg">
                  {selectedStaff.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedStaff.name}</h4>
                <span className="badge mt-1 bg-pulse-100 text-pulse-700">{ROLE_LABELS[selectedStaff.role]}</span>
              </div>

              <div className="space-y-3">
                {selectedStaff.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <a href={`tel:${selectedStaff.phone}`} className="text-pulse-600 hover:underline">{selectedStaff.phone}</a>
                  </div>
                )}
                {selectedStaff.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300 truncate">{selectedStaff.email}</span>
                  </div>
                )}
                {!selectedStaff.phone && !selectedStaff.email && (
                  <p className="text-sm text-gray-400 text-center py-4">İletişim bilgisi bulunmuyor</p>
                )}
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex gap-2">
                <button onClick={() => { openEditModal(selectedStaff); setSelectedStaff(null) }} className="btn-secondary flex-1 text-sm">
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />Düzenle
                </button>
                <button onClick={() => handleDeactivate(selectedStaff)} className="btn-danger flex-1 text-sm">
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />Kaldır
                </button>
              </div>

              {/* Erişim Yetkileri — sadece owner, owner olmayan personel için */}
              {currentUserRole === 'owner' && selectedStaff.role !== 'owner' && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Erişim Yetkileri</h4>
                  <div className="space-y-2">
                    {(Object.keys(PERMISSION_LABELS) as (keyof StaffPermissions)[]).map((key) => {
                      const effectivePerms = getEffectivePermissions(selectedStaff.role, selectedStaff.permissions)
                      const checked = effectivePerms[key] === true
                      return (
                        <label key={key} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={permsSaving}
                            onChange={(e) => handlePermissionToggle(selectedStaff, key, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-pulse-600 focus:ring-pulse-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{PERMISSION_LABELS[key]}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {editingStaff ? 'Personeli Düzenle' : 'Yeni Personel Ekle'}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="staffName" className="label">Ad Soyad</label>
                <input id="staffName" type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Ahmet Yılmaz" required autoFocus />
              </div>
              <div>
                <label htmlFor="staffRole" className="label">Rol</label>
                <select id="staffRole" value={role} onChange={(e) => setRole(e.target.value as StaffRole)} className="input">
                  <option value="staff">{ROLE_LABELS.staff}</option>
                  <option value="manager">{ROLE_LABELS.manager}</option>
                  <option value="owner">{ROLE_LABELS.owner}</option>
                </select>
              </div>
              <div>
                <label htmlFor="staffPhone" className="label">Telefon (opsiyonel)</label>
                <input id="staffPhone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="0532 123 45 67" />
              </div>
              <div>
                <label htmlFor="staffEmail" className="label">E-posta (opsiyonel)</label>
                <input id="staffEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="ahmet@ornek.com" />
              </div>
              {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">İptal</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />}
                  {editingStaff ? 'Güncelle' : 'Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
