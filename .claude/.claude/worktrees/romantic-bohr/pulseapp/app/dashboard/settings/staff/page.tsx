'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { Plus, Pencil, Trash2, Loader2, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StaffMember, StaffRole } from '@/types'

const ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'İşletme Sahibi',
  manager: 'Yönetici',
  staff: 'Personel',
}

export default function StaffPage() {
  const { businessId, loading: ctxLoading } = useBusinessContext()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [role, setRole] = useState<StaffRole>('staff')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

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

  useEffect(() => {
    if (!ctxLoading) fetchStaff()
  }, [fetchStaff, ctxLoading])

  function openNewModal() {
    setEditingStaff(null)
    setName('')
    setRole('staff')
    setPhone('')
    setEmail('')
    setError(null)
    setShowModal(true)
  }

  function openEditModal(member: StaffMember) {
    setEditingStaff(member)
    setName(member.name)
    setRole(member.role)
    setPhone(member.phone || '')
    setEmail(member.email || '')
    setError(null)
    setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    if (editingStaff) {
      const { error: err } = await supabase
        .from('staff_members')
        .update({ name, role, phone: phone || null, email: email || null })
        .eq('id', editingStaff.id)

      if (err) {
        setError('Güncelleme hatası: ' + err.message)
        setSaving(false)
        return
      }
    } else {
      const { error: err } = await supabase.from('staff_members').insert({
        business_id: businessId,
        name,
        role,
        phone: phone || null,
        email: email || null,
        user_id: null,
        is_active: true,
      })

      if (err) {
        setError('Ekleme hatası: ' + err.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    setShowModal(false)
    fetchStaff()
  }

  async function handleDeactivate(member: StaffMember) {
    if (!confirm(`"${member.name}" personelini listeden kaldırmak istediğinize emin misiniz? Randevularda artık seçilemez.`)) return
    const { error: err } = await supabase
      .from('staff_members')
      .update({ is_active: false })
      .eq('id', member.id)
    if (err) {
      alert('İşlem hatası: ' + err.message)
      return
    }
    fetchStaff()
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Personeller</h1>
          <p className="mt-1 text-sm text-gray-500">
            Randevu atayabileceğiniz personelleri yönetin.
          </p>
        </div>
        <button onClick={openNewModal} className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Yeni Personel
        </button>
      </div>

      {staff.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16">
          <UserPlus className="mb-4 h-12 w-12 text-gray-300" />
          <p className="text-gray-500 mb-4">Henüz personel eklenmemiş</p>
          <button onClick={openNewModal} className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />
            İlk Personeli Ekle
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map((member) => (
            <div
              key={member.id}
              className={cn(
                'card flex items-center gap-4 p-4 hover:shadow-md transition-shadow'
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pulse-100 text-pulse-700 font-semibold text-sm flex-shrink-0">
                {member.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{member.name}</span>
                  <span className="badge bg-pulse-100 text-pulse-700">
                    {ROLE_LABELS[member.role]}
                  </span>
                </div>
                {(member.phone || member.email) && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {[member.phone, member.email].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(member)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                  title="Düzenle"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeactivate(member)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  title="Listeden kaldır"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingStaff ? 'Personeli Düzenle' : 'Yeni Personel Ekle'}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="staffName" className="label">Ad Soyad</label>
                <input
                  id="staffName"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder="Ahmet Yılmaz"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="staffRole" className="label">Rol</label>
                <select
                  id="staffRole"
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffRole)}
                  className="input"
                >
                  <option value="staff">{ROLE_LABELS.staff}</option>
                  <option value="manager">{ROLE_LABELS.manager}</option>
                  <option value="owner">{ROLE_LABELS.owner}</option>
                </select>
              </div>
              <div>
                <label htmlFor="staffPhone" className="label">Telefon (opsiyonel)</label>
                <input
                  id="staffPhone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input"
                  placeholder="0532 123 45 67"
                />
              </div>
              <div>
                <label htmlFor="staffEmail" className="label">E-posta (opsiyonel)</label>
                <input
                  id="staffEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="ahmet@ornek.com"
                />
              </div>
              {error && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1"
                >
                  İptal
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin inline" /> : null}
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
