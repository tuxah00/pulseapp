'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { useViewMode } from '@/lib/hooks/use-view-mode'
import { Plus, Pencil, Trash2, Loader2, UserPlus, X, Mail, Phone, Settings, LayoutList, LayoutGrid, Check, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import CompactBoxCard from '@/components/ui/compact-box-card'
import { ToolbarPopover, SortPopoverContent } from '@/components/ui/toolbar-popover'
import type { StaffMember, StaffRole, StaffPermissions } from '@/types'
import { logAudit } from '@/lib/utils/audit'
import { DEFAULT_PERMISSIONS, getEffectivePermissions } from '@/types'
import { CustomSelect } from '@/components/ui/custom-select'
import { AnimatedList, AnimatedItem } from '@/components/ui/animated-list'

const ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'İşletme Sahibi',
  manager: 'Yönetici',
  staff: 'Personel',
}

const ROLE_ORDER: Record<StaffRole, number> = {
  owner: 0,
  manager: 1,
  staff: 2,
}

const ROLE_COLORS: Record<StaffRole, string> = {
  owner: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  manager: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  staff: 'bg-pulse-100 text-pulse-700 dark:bg-pulse-900/30 dark:text-pulse-300',
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
  packages: 'Paket & Seans',
  records: 'Dosyalar',
  portfolio: 'Portfolyo',
  inventory: 'Stoklar',
  orders: 'Siparişler',
  invoices: 'Faturalar',
  pos: 'Kasa',
  protocols: 'Tedavi Protokolleri',
  referrals: 'Referanslar',
}

const PERMISSION_CATEGORIES: { label: string; keys: (keyof StaffPermissions)[] }[] = [
  { label: 'Ana', keys: ['dashboard', 'appointments', 'customers'] },
  { label: 'İçerik', keys: ['records', 'portfolio', 'classes', 'memberships', 'packages', 'reservations', 'orders'] },
  { label: 'Yönetim', keys: ['services', 'staff', 'shifts', 'messages', 'analytics', 'reviews', 'inventory', 'invoices', 'settings'] },
]

function canEditMember(myRole: StaffRole, targetRole: StaffRole): boolean {
  if (myRole === 'owner') return targetRole !== 'owner'
  if (myRole === 'manager') return targetRole === 'staff'
  return false
}

function canEditPermissions(myRole: StaffRole, targetRole: StaffRole): boolean {
  return canEditMember(myRole, targetRole)
}

export default function StaffPage() {
  const { businessId, staffId: currentStaffId, staffName: currentStaffName, loading: ctxLoading, staffRole: currentUserRole, permissions } = useBusinessContext()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useViewMode('staff', 'list')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const { confirm } = useConfirm()

  const [name, setName] = useState('')
  const [role, setRole] = useState<StaffRole>('staff')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [permsSaving, setPermsSaving] = useState(false)
  const [permsSaved, setPermsSaved] = useState(false)
  const [permPopupStaff, setPermPopupStaff] = useState<StaffMember | null>(null)
  const [localPerms, setLocalPerms] = useState<StaffPermissions | null>(null)

  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteRole, setInviteRole] = useState<'manager' | 'staff'>('staff')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)

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

  // Sort by role hierarchy, then name (respecting sortDir)
  const sortedStaff = [...staff].sort((a, b) => {
    const roleA = ROLE_ORDER[a.role] ?? 3
    const roleB = ROLE_ORDER[b.role] ?? 3
    if (roleA !== roleB) return roleA - roleB
    const cmp = a.name.localeCompare(b.name, 'tr')
    return sortDir === 'asc' ? cmp : -cmp
  })

  const staffGroups = [
    { role: 'owner' as StaffRole, label: 'İşletme Sahibi', members: sortedStaff.filter(s => s.role === 'owner') },
    { role: 'manager' as StaffRole, label: 'Yöneticiler', members: sortedStaff.filter(s => s.role === 'manager') },
    { role: 'staff' as StaffRole, label: 'Personeller', members: sortedStaff.filter(s => s.role === 'staff') },
  ].filter(g => g.members.length > 0)

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

    // Manager can't set role to owner or manager
    if (currentUserRole === 'manager' && (role === 'owner' || role === 'manager')) {
      setError('Yönetici olarak sadece Personel rolü atayabilirsiniz.')
      setSaving(false)
      return
    }

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
    setSaving(false); setShowModal(false)
    await fetchStaff()
    await logAudit({
      businessId: businessId!,
      staffId: currentStaffId,
      staffName: currentStaffName,
      action: editingStaff ? 'update' : 'create',
      resource: 'staff',
      resourceId: editingStaff?.id,
      details: { name, role },
    })
  }

  async function handleDeactivate(member: StaffMember) {
    const ok = await confirm({ title: 'Onay', message: `"${member.name}" personelini listeden kaldırmak istediğinize emin misiniz? Randevularda artık seçilemez.` })
    if (!ok) return
    const { error: err } = await supabase.from('staff_members').update({ is_active: false }).eq('id', member.id)
    if (err) { alert('İşlem hatası: ' + err.message); return }
    if (selectedStaff?.id === member.id) setSelectedStaff(null)
    await fetchStaff()
    await logAudit({
      businessId: businessId!,
      staffId: currentStaffId,
      staffName: currentStaffName,
      action: 'delete',
      resource: 'staff',
      resourceId: member.id,
      details: { name: member.name },
    })
  }

  async function handlePermissionToggle(member: StaffMember, key: keyof StaffPermissions, value: boolean) {
    setPermsSaving(true)
    setPermsSaved(false)
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
      setPermsSaved(true)
      setTimeout(() => setPermsSaved(false), 2000)
      await logAudit({
        businessId: businessId!,
        staffId: currentStaffId,
        staffName: currentStaffName,
        action: 'update',
        resource: 'permissions',
        resourceId: member.id,
        details: {
          target_name: member.name,
          target_role: ROLE_LABELS[member.role],
          permission_label: PERMISSION_LABELS[key],
          permission_key: key,
          enabled: value,
        },
      })
    }
    setPermsSaving(false)
  }

  async function handleToggleAll(member: StaffMember, value: boolean) {
    setPermsSaving(true)
    setPermsSaved(false)
    const newPerms: StaffPermissions = {} as StaffPermissions
    for (const key of Object.keys(PERMISSION_LABELS) as (keyof StaffPermissions)[]) {
      newPerms[key] = value
    }
    const { error: err } = await supabase
      .from('staff_members')
      .update({ permissions: newPerms })
      .eq('id', member.id)
    if (err) {
      console.error('Yetki güncelleme hatası:', err)
    } else {
      setSelectedStaff(prev => prev?.id === member.id ? { ...prev, permissions: newPerms } as StaffMember : prev)
      setStaff(prev => prev.map(s => s.id === member.id ? { ...s, permissions: newPerms } : s))
      setPermPopupStaff(prev => prev?.id === member.id ? { ...prev, permissions: newPerms } as StaffMember : prev)
      setPermsSaved(true)
      setTimeout(() => setPermsSaved(false), 2000)
      await logAudit({
        businessId: businessId!,
        staffId: currentStaffId,
        staffName: currentStaffName,
        action: 'update',
        resource: 'permissions',
        resourceId: member.id,
        details: {
          target_name: member.name,
          action_desc: value ? 'Tüm yetkiler açıldı' : 'Tüm yetkiler kapatıldı',
        },
      })
    }
    setPermsSaving(false)
  }

  async function handleBatchSavePermissions() {
    if (!selectedStaff || !localPerms) return
    setPermsSaving(true)
    setPermsSaved(false)
    const { error: err } = await supabase
      .from('staff_members')
      .update({ permissions: localPerms })
      .eq('id', selectedStaff.id)
    if (err) {
      console.error('Yetki güncelleme hatası:', err)
    } else {
      setSelectedStaff(prev => prev ? { ...prev, permissions: localPerms } as StaffMember : null)
      setStaff(prev => prev.map(s => s.id === selectedStaff.id ? { ...s, permissions: localPerms } : s))
      setPermsSaved(true)
      setTimeout(() => setPermsSaved(false), 2000)
      await logAudit({
        businessId: businessId!,
        staffId: currentStaffId,
        staffName: currentStaffName,
        action: 'update',
        resource: 'permissions',
        resourceId: selectedStaff.id,
        details: {
          target_name: selectedStaff.name,
          action_desc: 'Yetkiler toplu güncellendi',
        },
      })
    }
    setPermsSaving(false)
  }

  async function handleCreateInvite() {
    setInviteLoading(true)
    setInviteLink(null)
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail || undefined, role: inviteRole }),
    })
    const data = await res.json()
    if (res.ok) {
      setInviteLink(data.link)
    } else {
      alert('Hata: ' + data.error)
    }
    setInviteLoading(false)
  }

  function getPermissionCount(member: StaffMember): number {
    const perms = getEffectivePermissions(member.role, member.permissions)
    return (Object.values(perms) as boolean[]).filter(Boolean).length
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

  const availableRoles: StaffRole[] = currentUserRole === 'owner'
    ? ['staff', 'manager', 'owner']
    : currentUserRole === 'manager'
      ? ['staff']
      : ['staff']

  const renderStaffCard = (member: StaffMember) => {
    const isMe = currentStaffId === member.id
    const canEdit = canEditMember(currentUserRole as StaffRole, member.role)
    const canPerms = canEditPermissions(currentUserRole as StaffRole, member.role)
    const permCount = getPermissionCount(member)
    const totalPerms = Object.keys(PERMISSION_LABELS).length

    if (viewMode === 'box') {
      return (
        <CompactBoxCard
          key={member.id}
          initials={member.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
          title={member.name}
          colorClass={member.role === 'owner' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-pulse-100 text-pulse-700'}
          selected={selectedStaff?.id === member.id}
          onClick={() => { setSelectedStaff(member); setLocalPerms(getEffectivePermissions(member.role, member.permissions)); setPermsSaved(false) }}
          className={cn(
            isMe && 'bg-blue-50/50 dark:bg-blue-900/10',
            member.role === 'owner' && 'border-amber-200 dark:border-amber-800/50',
          )}
        />
      )
    }

    return (
      <AnimatedItem
        key={member.id}
        onClick={() => setSelectedStaff(member)}
        className={cn(
          'card p-4 hover:shadow-md transition-all cursor-pointer',
          selectedStaff?.id === member.id && 'ring-2 ring-pulse-500',
          isMe && 'bg-blue-50/50 dark:bg-blue-900/10',
          member.role === 'owner' && 'border-amber-200 dark:border-amber-800/50',
        )}
      >
        {/* List card layout */}
        <div className="flex items-center gap-4">
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full font-semibold text-sm flex-shrink-0',
              member.role === 'owner' ? 'bg-amber-100 text-amber-700' : 'bg-pulse-100 text-pulse-700'
            )}>
              {member.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900 dark:text-gray-100">{member.name}</span>
                <span className={cn('badge', ROLE_COLORS[member.role])}>{ROLE_LABELS[member.role]}</span>
                {isMe && <span className="badge bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Siz</span>}
                {member.role !== 'owner' && (
                  <span className="text-xs text-gray-400">{permCount}/{totalPerms} yetki</span>
                )}
              </div>
              {(member.phone || member.email) && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {[member.phone, member.email].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            {canEdit && (
              <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                {canPerms && (
                  <button onClick={() => setPermPopupStaff(member)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600 transition-colors" title="Yetkiler">
                    <Settings className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => openEditModal(member)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 transition-colors" title="Düzenle">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => handleDeactivate(member)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors" title="Listeden kaldır">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
      </AnimatedItem>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Personeller</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Randevu atayabileceğiniz personelleri yönetin.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 shrink-0">
            <ToolbarPopover icon={<ArrowUpDown className="h-4 w-4" />} label="Sırala" active={sortDir !== 'asc'}>
              <SortPopoverContent
                options={[{ value: 'name', label: 'İsim' }]}
                sortField="name"
                sortDir={sortDir}
                onSortField={() => {}}
                onSortDir={setSortDir}
              />
            </ToolbarPopover>
            <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-0.5" />
            <button onClick={() => setViewMode('list')} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', viewMode === 'list' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')} title="Liste"><LayoutList className="h-4 w-4" /></button>
            <button onClick={() => setViewMode('box')} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', viewMode === 'box' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')} title="Kutular"><LayoutGrid className="h-4 w-4" /></button>
          </div>
          {(currentUserRole === 'owner' || currentUserRole === 'manager') && (
            <button onClick={() => { setShowInviteModal(true); setInviteLink(null); setInviteEmail('') }} className="btn-secondary">
              <UserPlus className="mr-2 h-4 w-4" />Davet Et
            </button>
          )}
          <button onClick={openNewModal} className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />Yeni Personel
          </button>
        </div>
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
        <div className="space-y-6">
          {staffGroups.map((group) => (
            <div key={group.role}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">{group.label}</h2>
                <span className="text-xs text-gray-400">({group.members.length})</span>
              </div>
              {viewMode === 'box' ? (
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-2">
                  {group.members.map(renderStaffCard)}
                </div>
              ) : (
                <AnimatedList className="space-y-3">
                  {group.members.map(renderStaffCard)}
                </AnimatedList>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Personel Detay Popup (Ortada) ── */}
      {selectedStaff && (
        <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedStaff(null)}>
          <div className="modal-content card w-full max-w-xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Başlık */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Personel Detayı</h3>
              <button onClick={() => setSelectedStaff(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Profil */}
              <div className="text-center">
                <div className={cn(
                  'mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full font-bold text-lg',
                  selectedStaff.role === 'owner' ? 'bg-amber-100 text-amber-700' : 'bg-pulse-100 text-pulse-700'
                )}>
                  {selectedStaff.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedStaff.name}</h4>
                <span className={cn('badge mt-1', ROLE_COLORS[selectedStaff.role])}>{ROLE_LABELS[selectedStaff.role]}</span>
              </div>

              {/* İletişim */}
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
                  <p className="text-sm text-gray-400 text-center py-2">İletişim bilgisi bulunmuyor</p>
                )}
              </div>

              {/* Düzenle / Kaldır */}
              {canEditMember(currentUserRole as StaffRole, selectedStaff.role) && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex gap-2">
                  <button onClick={() => { openEditModal(selectedStaff); setSelectedStaff(null) }} className="btn-secondary flex-1 text-sm">
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />Düzenle
                  </button>
                  <button onClick={() => handleDeactivate(selectedStaff)} className="btn-danger flex-1 text-sm">
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />Kaldır
                  </button>
                </div>
              )}

              {/* Erişim Yetkileri — batch save */}
              {canEditPermissions(currentUserRole as StaffRole, selectedStaff.role) && localPerms && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Erişim Yetkileri</h4>
                    {permsSaved && (
                      <span className="flex items-center gap-1 text-xs text-green-600"><Check className="h-3 w-3" /> Kaydedildi</span>
                    )}
                  </div>
                  {PERMISSION_CATEGORIES.map(cat => (
                    <div key={cat.label} className="mb-3">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">{cat.label}</p>
                      <div className="space-y-1">
                        {cat.keys.map((key) => {
                          const checked = localPerms[key] === true
                          return (
                            <label key={key} className="flex items-center justify-between py-1.5 cursor-pointer group">
                              <span className="text-sm text-gray-700 dark:text-gray-300">{PERMISSION_LABELS[key]}</span>
                              <div className="relative">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={permsSaving}
                                  onChange={(e) => setLocalPerms(prev => prev ? { ...prev, [key]: e.target.checked } : prev)}
                                  className="peer sr-only"
                                />
                                <div className="h-5 w-9 rounded-full bg-gray-300 dark:bg-gray-600 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-pulse-500 peer-checked:after:translate-x-4 peer-disabled:opacity-50" />
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Alt butonlar */}
            {canEditPermissions(currentUserRole as StaffRole, selectedStaff.role) && localPerms && (
              <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-3 flex gap-3 flex-shrink-0">
                <button onClick={() => setSelectedStaff(null)} className="btn-secondary flex-1 text-sm">İptal</button>
                <button onClick={handleBatchSavePermissions} disabled={permsSaving} className="btn-primary flex-1 text-sm">
                  {permsSaving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin inline" />}
                  Kaydet
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="modal-content card w-full max-w-md">
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
                <CustomSelect
                  value={role}
                  onChange={v => setRole(v as StaffRole)}
                  options={availableRoles.map(r => ({ value: r, label: ROLE_LABELS[r] }))}
                />
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

      {/* Yetki Popup Modal — Yeniden tasarlanmış */}
      {permPopupStaff && (
        <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setPermPopupStaff(null)}>
          <div className="modal-content card w-full max-w-md max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{permPopupStaff.name}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  <span className={cn('badge text-xs mr-2', ROLE_COLORS[permPopupStaff.role])}>{ROLE_LABELS[permPopupStaff.role]}</span>
                  Erişim Yetkileri
                </p>
              </div>
              <button onClick={() => setPermPopupStaff(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {/* Tümünü Aç/Kapat */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => handleToggleAll(permPopupStaff, true)}
                  disabled={permsSaving}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium border border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50"
                >
                  Tümünü Aç
                </button>
                <button
                  onClick={() => handleToggleAll(permPopupStaff, false)}
                  disabled={permsSaving}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                >
                  Tümünü Kapat
                </button>
              </div>

              {PERMISSION_CATEGORIES.map(cat => (
                <div key={cat.label} className="mb-5 last:mb-0">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    {cat.label}
                  </p>
                  <div className="space-y-0.5">
                    {cat.keys.map((key) => {
                      const perms = getEffectivePermissions(permPopupStaff.role, permPopupStaff.permissions)
                      const checked = perms[key] ?? false
                      return (
                        <label key={key} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors">
                          <span className="text-sm text-gray-700 dark:text-gray-300">{PERMISSION_LABELS[key]}</span>
                          <div className="relative">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={permsSaving}
                              onChange={(e) => {
                                handlePermissionToggle(permPopupStaff, key, e.target.checked)
                                setPermPopupStaff(prev => prev ? { ...prev, permissions: { ...getEffectivePermissions(prev.role, prev.permissions), [key]: e.target.checked } } as StaffMember : null)
                              }}
                              className="peer sr-only"
                            />
                            <div className="h-5 w-9 rounded-full bg-gray-300 dark:bg-gray-600 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-pulse-500 peer-checked:after:translate-x-4 peer-disabled:opacity-50" />
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Alt bar */}
            <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-3 flex items-center justify-between">
              {permsSaving ? (
                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Loader2 className="h-3 w-3 animate-spin" /> Kaydediliyor...
                </span>
              ) : permsSaved ? (
                <span className="flex items-center gap-1.5 text-xs text-green-600">
                  <Check className="h-3.5 w-3.5" /> Kaydedildi
                </span>
              ) : (
                <span className="text-xs text-gray-400">{getPermissionCount(permPopupStaff)}/{Object.keys(PERMISSION_LABELS).length} yetki açık</span>
              )}
              <button onClick={() => setPermPopupStaff(null)} className="btn-secondary text-sm py-1.5 px-4">Kapat</button>
            </div>
          </div>
        </div>
      )}

      {/* Davet Modal */}
      {showInviteModal && (
        <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowInviteModal(false)}>
          <div className="modal-content card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Personel Davet Et</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Link paylaşarak sisteme katmak için</p>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>

            {!inviteLink ? (
              <div className="space-y-4">
                <div>
                  <label className="label">Rol</label>
                  <CustomSelect
                    value={inviteRole}
                    onChange={v => setInviteRole(v as 'manager' | 'staff')}
                    options={[
                      { value: 'staff', label: 'Personel' },
                      ...(currentUserRole === 'owner' ? [{ value: 'manager', label: 'Yönetici' }] : []),
                    ]}
                  />
                </div>
                <div>
                  <label className="label">E-posta (opsiyonel)</label>
                  <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="input" placeholder="personel@ornek.com" />
                </div>
                <button onClick={handleCreateInvite} disabled={inviteLoading} className="btn-primary w-full">
                  {inviteLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  Davet Linki Oluştur
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">Davet linki oluşturuldu (7 gün geçerli):</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300 break-all font-mono">{inviteLink}</p>
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(inviteLink); alert('Link kopyalandı!') }}
                  className="btn-secondary w-full text-sm"
                >
                  Linki Kopyala
                </button>
                <button onClick={() => { setInviteLink(null) }} className="text-sm text-gray-500 w-full text-center hover:text-gray-700">
                  Yeni link oluştur
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
