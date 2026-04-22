'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { useViewMode } from '@/lib/hooks/use-view-mode'
import { requirePermission } from '@/lib/hooks/use-require-permission'
import { Plus, Pencil, Trash2, Loader2, UserPlus, X, Mail, Phone, LayoutList, LayoutGrid, Check, ArrowUpDown, BadgePercent } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Portal } from '@/components/ui/portal'
import CompactBoxCard from '@/components/ui/compact-box-card'
import { ToolbarPopover, SortPopoverContent } from '@/components/ui/toolbar-popover'
import type { StaffMember, StaffRole, StaffPermissions, StaffWritePermissions } from '@/types'
import { logAudit } from '@/lib/utils/audit'
import { formatCurrency } from '@/lib/utils'
import {
  DEFAULT_PERMISSIONS,
  DEFAULT_WRITE_PERMISSIONS,
  getEffectivePermissions,
  getEffectiveWritePermissions,
  READ_ONLY_PERMISSION_KEYS,
} from '@/types'
import { CustomSelect } from '@/components/ui/custom-select'
import { getCustomerLabel, getSectorPermissionKeys } from '@/lib/config/sector-modules'
import { AnimatedList, AnimatedItem } from '@/components/ui/animated-list'
import EmptyState from '@/components/ui/empty-state'

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
  owner: 'badge-warning',
  manager: 'badge bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  staff: 'badge-brand',
}

const PERMISSION_LABELS: Record<keyof StaffPermissions, string> = {
  dashboard: 'Genel Bakış',
  appointments: 'Randevular',
  customers: 'Müşteriler',
  waitlist: 'Bekleme Listesi',
  analytics: 'Gelir-Gider',
  insights: 'İş Zekası',
  assistant_actions: 'Asistan Aksiyonları',
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
  portfolio: 'Çalışma Galerisi',
  inventory: 'Stoklar',
  orders: 'Siparişler',
  invoices: 'Faturalar',
  pos: 'Kasa',
  protocols: 'Tedavi Protokolleri',
  follow_ups: 'Takipler',
  rewards: 'Ödüller',
  campaigns: 'Kampanyalar',
  workflows: 'Otomatik Mesajlar',
  commissions: 'Prim & Komisyon',
  audit: 'Denetim',
  kvkk: 'KVKK',
}

const PERMISSION_CATEGORIES: { label: string; keys: (keyof StaffPermissions)[] }[] = [
  { label: 'Ana', keys: ['dashboard', 'appointments', 'customers', 'waitlist'] },
  { label: 'İçerik', keys: ['records', 'protocols', 'follow_ups', 'portfolio', 'classes', 'memberships', 'packages', 'reservations', 'orders', 'rewards'] },
  { label: 'Yönetim', keys: ['services', 'staff', 'shifts', 'messages', 'analytics', 'insights', 'assistant_actions', 'reviews', 'inventory', 'pos', 'invoices', 'commissions', 'campaigns', 'workflows', 'audit', 'kvkk', 'settings'] },
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
  const { businessId, staffId: currentStaffId, staffName: currentStaffName, sector, loading: ctxLoading, staffRole: currentUserRole, permissions } = useBusinessContext()
  const permissionLabels = useMemo(
    () => ({ ...PERMISSION_LABELS, customers: sector ? getCustomerLabel(sector) : 'Müşteriler' }),
    [sector],
  )

  // Sektöre göre filtrelenmiş yetki kategorileri — bu sektörde bulunmayan
  // modüller (örn. estetik klinikte "Sınıflar") yetki editöründe gösterilmez.
  const sectorPermKeys = useMemo(
    () => new Set(sector ? getSectorPermissionKeys(sector) : []),
    [sector],
  )
  const filteredPermCategories = useMemo(
    () => PERMISSION_CATEGORIES
      .map(cat => ({ ...cat, keys: cat.keys.filter(k => sectorPermKeys.has(k)) }))
      .filter(cat => cat.keys.length > 0),
    [sectorPermKeys],
  )
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [isClosingModal, setIsClosingModal] = useState(false)
  const closeModal = () => setIsClosingModal(true)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [isClosingSelectedStaff, setIsClosingSelectedStaff] = useState(false)
  const closeSelectedStaff = () => setIsClosingSelectedStaff(true)
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
  const [localPerms, setLocalPerms] = useState<StaffPermissions | null>(null)
  const [localWritePerms, setLocalWritePerms] = useState<StaffWritePermissions | null>(null)

  const [showInviteModal, setShowInviteModal] = useState(false)
  const [isClosingInviteModal, setIsClosingInviteModal] = useState(false)
  const closeInviteModal = () => setIsClosingInviteModal(true)
  const [inviteRole, setInviteRole] = useState<'manager' | 'staff'>('staff')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)

  // Commission earnings widget
  const [staffCommission, setStaffCommission] = useState<{
    appointment_count: number
    total_revenue: number
    commission_total: number
    status: 'pending' | 'paid'
    period: string
  } | null>(null)
  const [commissionLoading, setCommissionLoading] = useState(false)

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
  }, [businessId, supabase])

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
    setSaving(false); closeModal()
    await fetchStaff()
    window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Kaydedildi' } }))
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
    if (err) { window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: 'İşlem hatası: ' + err.message } })); return }
    if (selectedStaff?.id === member.id) setSelectedStaff(null)
    await fetchStaff()
    window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Personel listeden kaldırıldı' } }))
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

  async function handleBatchSavePermissions() {
    if (!selectedStaff || !localPerms) return
    setPermsSaving(true)
    setPermsSaved(false)
    const writePermsToSave = localWritePerms ?? {}
    const { error: err } = await supabase
      .from('staff_members')
      .update({ permissions: localPerms, write_permissions: writePermsToSave })
      .eq('id', selectedStaff.id)
    if (err) {
      console.error('Yetki güncelleme hatası:', err)
    } else {
      setSelectedStaff(prev => prev ? { ...prev, permissions: localPerms, write_permissions: writePermsToSave } as StaffMember : null)
      setStaff(prev => prev.map(s => s.id === selectedStaff.id ? { ...s, permissions: localPerms, write_permissions: writePermsToSave } as StaffMember : s))
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
          action_desc: 'Yetkiler toplu güncellendi (görüntüle + düzenle)',
        },
      })
    }
    setPermsSaving(false)
  }

  async function fetchStaffCommission(staffMemberId: string) {
    const now = new Date()
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setCommissionLoading(true)
    setStaffCommission(null)
    try {
      const res = await fetch(`/api/commissions/earnings?staffId=${staffMemberId}&period=${period}`)
      if (!res.ok) return
      const data = await res.json()
      const earning = (data.earnings || []).find((e: any) => e.staff_id === staffMemberId)
      if (earning) {
        setStaffCommission({
          appointment_count: earning.appointment_count,
          total_revenue: earning.total_revenue,
          commission_total: earning.commission_total,
          status: earning.status,
          period,
        })
      }
    } catch {
      // Prim verisi kritik değil, sessizce fail et
    } finally {
      setCommissionLoading(false)
    }
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
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: data.error } }))
    }
    setInviteLoading(false)
  }

  function getPermissionCount(member: StaffMember): number {
    const perms = getEffectivePermissions(member.role, member.permissions)
    return (Object.values(perms) as boolean[]).filter(Boolean).length
  }

  requirePermission(permissions, 'staff')

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-pulse-900" /></div>
  }

  const availableRoles: StaffRole[] = currentUserRole === 'owner'
    ? ['staff', 'manager', 'owner']
    : currentUserRole === 'manager'
      ? ['staff']
      : ['staff']

  const renderStaffCard = (member: StaffMember) => {
    const isMe = currentStaffId === member.id
    const canManageMember = canEditMember(currentUserRole as StaffRole, member.role)
    const permCount = getPermissionCount(member)
    const totalPerms = Object.keys(permissionLabels).length

    if (viewMode === 'box') {
      return (
        <CompactBoxCard
          key={member.id}
          initials={member.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
          title={member.name}
          colorClass={member.role === 'owner' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-pulse-100 text-pulse-900'}
          selected={selectedStaff?.id === member.id}
          onClick={() => { setSelectedStaff(member); setLocalPerms(getEffectivePermissions(member.role, member.permissions)); setLocalWritePerms(getEffectiveWritePermissions(member.role, (member as any).write_permissions ?? null)); setPermsSaved(false); fetchStaffCommission(member.id) }}
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
        onClick={() => { setSelectedStaff(member); setLocalPerms(getEffectivePermissions(member.role, member.permissions)); setLocalWritePerms(getEffectiveWritePermissions(member.role, (member as any).write_permissions ?? null)); setPermsSaved(false); fetchStaffCommission(member.id) }}
        className={cn(
          'card p-4 hover:shadow-md transition-all cursor-pointer',
          selectedStaff?.id === member.id && 'ring-2 ring-pulse-900',
          isMe && 'bg-blue-50/50 dark:bg-blue-900/10',
          member.role === 'owner' && 'border-amber-200 dark:border-amber-800/50',
        )}
      >
        {/* List card layout */}
        <div className="flex items-center gap-4">
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full font-semibold text-sm flex-shrink-0',
              'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            )}>
              {member.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900 dark:text-gray-100">{member.name}</span>
                <span className={ROLE_COLORS[member.role]}>{ROLE_LABELS[member.role]}</span>
                {isMe && <span className="badge-info">Siz</span>}
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
            {canManageMember && (
              <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
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
          <h1 className="h-page">Personeller</h1>
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
        <EmptyState
          icon={<UserPlus className="h-8 w-8" />}
          title="Henüz personel eklenmemiş"
          action={{ label: 'İlk Personeli Ekle', onClick: openNewModal, icon: <Plus className="h-4 w-4" /> }}
        />
      ) : (
        <div className="space-y-6">
          {staffGroups.map((group) => (
            <div key={group.role}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">{group.label}</h2>
                <span className="text-xs text-gray-400">({group.members.length})</span>
              </div>
              <div key={viewMode} className="view-transition">
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
            </div>
          ))}
        </div>
      )}

      {/* ── Personel Detay Popup (Ortada) ── */}
      {selectedStaff && (
        <Portal>
        <div className={`modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/50 dark:bg-black/70 p-4 ${isClosingSelectedStaff ? 'closing' : ''}`} onClick={closeSelectedStaff} onAnimationEnd={() => { if (isClosingSelectedStaff) { setSelectedStaff(null); setIsClosingSelectedStaff(false) } }}>
          <div className={`modal-content card w-full max-w-xl max-h-[85vh] flex flex-col ${isClosingSelectedStaff ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
            {/* Başlık */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Personel Detayı</h3>
              <button onClick={closeSelectedStaff} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Profil */}
              <div className="text-center">
                <div className={cn(
                  'mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full font-bold text-lg',
                  'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                )}>
                  {selectedStaff.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <h4 className="h-section">{selectedStaff.name}</h4>
                <span className={cn('mt-1', ROLE_COLORS[selectedStaff.role])}>{ROLE_LABELS[selectedStaff.role]}</span>
              </div>

              {/* İletişim */}
              <div className="space-y-3">
                {selectedStaff.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <a href={`tel:${selectedStaff.phone}`} className="text-pulse-900 hover:underline">{selectedStaff.phone}</a>
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

              {/* Bu Ay Primleri */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <BadgePercent className="h-4 w-4 text-pulse-900 dark:text-pulse-300" />
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Bu Ay Primleri</h4>
                </div>
                {commissionLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Yükleniyor...
                  </div>
                ) : staffCommission ? (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2.5 text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Randevu</p>
                      <p className="text-base font-bold text-gray-900 dark:text-gray-100">{staffCommission.appointment_count}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2.5 text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Ciro</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatCurrency(staffCommission.total_revenue)}</p>
                    </div>
                    <div className={cn(
                      'rounded-lg p-2.5 text-center',
                      staffCommission.status === 'paid'
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : 'bg-pulse-50 dark:bg-pulse-900/20'
                    )}>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Prim</p>
                      <p className={cn(
                        'text-sm font-bold',
                        staffCommission.status === 'paid'
                          ? 'text-green-700 dark:text-green-400'
                          : 'text-pulse-900 dark:text-pulse-300'
                      )}>
                        {formatCurrency(staffCommission.commission_total)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Bu ay için hesaplanmış prim verisi yok.
                  </p>
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

              {/* Erişim Yetkileri — iki sütunlu (Görüntüle / Düzenle) */}
              {canEditPermissions(currentUserRole as StaffRole, selectedStaff.role) && localPerms && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Erişim Yetkileri</h4>
                    {permsSaved && (
                      <span className="flex items-center gap-1 text-xs text-green-600"><Check className="h-3 w-3" /> Kaydedildi</span>
                    )}
                  </div>

                  {/* Şablon ve hızlı eylemler */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <div className="min-w-[160px]">
                      <CustomSelect
                        placeholder="Şablon uygula..."
                        value=""
                        onChange={(v) => {
                          if (!v) return
                          const roleKey = v as StaffRole
                          setLocalPerms({ ...DEFAULT_PERMISSIONS[roleKey] })
                          setLocalWritePerms({ ...DEFAULT_WRITE_PERMISSIONS[roleKey] })
                        }}
                        options={[
                          { value: 'manager', label: 'Yönetici Şablonu' },
                          { value: 'staff', label: 'Personel Şablonu' },
                        ]}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setLocalPerms({ ...DEFAULT_PERMISSIONS.owner })}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      Tümünü Görüntüle
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocalWritePerms({ ...DEFAULT_WRITE_PERMISSIONS.owner })}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      Tümünü Düzenle
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const allOff = Object.fromEntries(
                          (Object.keys(DEFAULT_PERMISSIONS.owner) as (keyof StaffPermissions)[]).map(k => [k, false])
                        ) as unknown as StaffPermissions
                        setLocalPerms(allOff)
                        setLocalWritePerms({})
                      }}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Tümünü Kapat
                    </button>
                  </div>

                  {/* Başlık satırı */}
                  <div className="grid grid-cols-[1fr_70px_70px] gap-2 px-2 pb-2 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400">
                    <span>Modül</span>
                    <span className="text-center">Görüntüle</span>
                    <span className="text-center">Düzenle</span>
                  </div>

                  {filteredPermCategories.map(cat => (
                    <div key={cat.label} className="mb-3">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-2 mb-1 px-2">{cat.label}</p>
                      <div className="space-y-0.5">
                        {cat.keys.map((key) => {
                          const view = localPerms[key] === true
                          const isReadOnly = (READ_ONLY_PERMISSION_KEYS as readonly string[]).includes(key)
                          const edit = localWritePerms?.[key] === true
                          return (
                            <div key={key} className="grid grid-cols-[1fr_70px_70px] items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <span className="text-sm text-gray-700 dark:text-gray-300">{permissionLabels[key]}</span>

                              {/* Görüntüle toggle */}
                              <div className="flex justify-center">
                                <label className="relative inline-flex cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={view}
                                    disabled={permsSaving}
                                    onChange={(e) => {
                                      const nextView = e.target.checked
                                      setLocalPerms(prev => prev ? { ...prev, [key]: nextView } : prev)
                                      if (!nextView) {
                                        setLocalWritePerms(prev => ({ ...(prev ?? {}), [key]: false }))
                                      }
                                    }}
                                    className="peer sr-only"
                                  />
                                  <div className="h-5 w-9 rounded-full bg-gray-300 dark:bg-gray-600 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-pulse-900 peer-checked:after:translate-x-4 peer-disabled:opacity-50" />
                                </label>
                              </div>

                              {/* Düzenle toggle */}
                              <div className="flex justify-center">
                                {isReadOnly ? (
                                  <span className="text-xs text-gray-300 dark:text-gray-600" title="Bu modülde düzenleme işlemi yoktur">—</span>
                                ) : (
                                  <label className={cn('relative inline-flex', view ? 'cursor-pointer' : 'cursor-not-allowed')}>
                                    <input
                                      type="checkbox"
                                      checked={edit && view}
                                      disabled={permsSaving || !view}
                                      onChange={(e) => {
                                        const nextEdit = e.target.checked
                                        setLocalWritePerms(prev => ({ ...(prev ?? {}), [key]: nextEdit }))
                                      }}
                                      className="peer sr-only"
                                    />
                                    <div className={cn(
                                      "h-5 w-9 rounded-full bg-gray-300 dark:bg-gray-600 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-pulse-900 peer-checked:after:translate-x-4",
                                      (!view || permsSaving) && 'opacity-40'
                                    )} />
                                  </label>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}

                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 px-2 leading-relaxed">
                    &ldquo;Görüntüle&rdquo; kapalıysa modül hiç görünmez. &ldquo;Düzenle&rdquo; kapalıysa personel içeriği görür ama ekleme/güncelleme/silme yapamaz.
                  </p>
                </div>
              )}
            </div>

            {/* Alt butonlar */}
            {canEditPermissions(currentUserRole as StaffRole, selectedStaff.role) && localPerms && (
              <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-3 flex gap-3 flex-shrink-0">
                <button onClick={closeSelectedStaff} className="btn-secondary flex-1 text-sm">İptal</button>
                <button onClick={handleBatchSavePermissions} disabled={permsSaving} className="btn-primary flex-1 text-sm">
                  {permsSaving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin inline" />}
                  Kaydet
                </button>
              </div>
            )}
          </div>
        </div>
        </Portal>
      )}

      {/* Modal */}
      {showModal && (
        <Portal>
        <div className={`modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/50 dark:bg-black/70 p-4 ${isClosingModal ? 'closing' : ''}`} onAnimationEnd={() => { if (isClosingModal) { setShowModal(false); setIsClosingModal(false) } }}>
          <div className={`modal-content card w-full max-w-md ${isClosingModal ? 'closing' : ''}`}>
            <h2 className="h-section mb-4">
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
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">İptal</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />}
                  {editingStaff ? 'Güncelle' : 'Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}

      {/* Davet Modal */}
      {showInviteModal && (
        <Portal>
        <div className={`modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/50 dark:bg-black/70 p-4 ${isClosingInviteModal ? 'closing' : ''}`} onClick={closeInviteModal} onAnimationEnd={() => { if (isClosingInviteModal) { setShowInviteModal(false); setIsClosingInviteModal(false) } }}>
          <div className={`modal-content card w-full max-w-sm ${isClosingInviteModal ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="h-section">Personel Davet Et</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Link paylaşarak sisteme katmak için</p>
              </div>
              <button onClick={closeInviteModal} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
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
                  onClick={() => { navigator.clipboard.writeText(inviteLink); window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Kopyalandı', body: 'Davet linki panoya kopyalandı' } })) }}
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
        </Portal>
      )}
    </div>
  )
}
