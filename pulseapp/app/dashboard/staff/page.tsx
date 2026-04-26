'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { useViewMode } from '@/lib/hooks/use-view-mode'
import { requirePermission } from '@/lib/hooks/use-require-permission'
import { Plus, Pencil, Trash2, Loader2, UserPlus, X, Mail, Phone, LayoutList, LayoutGrid, Check, ArrowUpDown, BadgePercent, Tag, KeyRound } from 'lucide-react'
import ViewModeToggle from '@/components/ui/view-mode-toggle'
import { cn } from '@/lib/utils'
import { Portal } from '@/components/ui/portal'
import CompactBoxCard from '@/components/ui/compact-box-card'
import { ToolbarPopover, SortPopoverContent } from '@/components/ui/toolbar-popover'
import type { StaffMember, StaffRole, StaffPermissions, StaffWritePermissions, SectorType } from '@/types'
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
import { getStaffTagsForSector } from '@/lib/config/sector-seeds'
import { AnimatedList, AnimatedItem } from '@/components/ui/animated-list'
import EmptyState from '@/components/ui/empty-state'

interface ServiceLite {
  id: string
  name: string
  is_active: boolean
}

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
  manager: 'badge-brand',
  staff: 'badge-neutral',
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
  consultations: 'Ön Konsültasyon',
}

const PERMISSION_CATEGORIES: { label: string; keys: (keyof StaffPermissions)[] }[] = [
  { label: 'Ana', keys: ['dashboard', 'appointments', 'customers', 'waitlist', 'consultations'] },
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
  // Etiket + hizmet seçimi (form state)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  // Etiket havuzu (işletme bazlı, settings.staff_tag_options)
  const [tagPool, setTagPool] = useState<string[]>([])
  // İşletmenin aktif hizmetleri
  const [services, setServices] = useState<ServiceLite[]>([])
  // Personel başına atanmış hizmet ID'leri (staff_services'tan)
  const [staffServicesMap, setStaffServicesMap] = useState<Record<string, string[]>>({})
  // Etiket havuzu modal'ı
  const [tagPoolModal, setTagPoolModal] = useState(false)
  const [tagPoolModalClosing, setTagPoolModalClosing] = useState(false)
  const closeTagPoolModal = () => setTagPoolModalClosing(true)
  const [tagPoolDraft, setTagPoolDraft] = useState<string[]>([])
  const [newTagInput, setNewTagInput] = useState('')
  const [tagPoolSaving, setTagPoolSaving] = useState(false)
  const [permsSaving, setPermsSaving] = useState(false)
  const [permsSaved, setPermsSaved] = useState(false)
  const [localPerms, setLocalPerms] = useState<StaffPermissions | null>(null)
  const [localWritePerms, setLocalWritePerms] = useState<StaffWritePermissions | null>(null)

  // Davet linki üretimi (yeni personel formunda + per-row)
  const [sendInvite, setSendInvite] = useState(true) // Email doluysa default ON
  const [linkModal, setLinkModal] = useState<{ link: string; staffName: string; role: StaffRole; email: string | null; type: 'invite' | 'recovery' } | null>(null)
  const [linkModalClosing, setLinkModalClosing] = useState(false)
  const closeLinkModal = () => setLinkModalClosing(true)
  const [inviteLoadingFor, setInviteLoadingFor] = useState<string | null>(null) // staff_id loading flag
  const [recoveryLoadingFor, setRecoveryLoadingFor] = useState<string | null>(null) // şifre sıfırlama loading flag

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
    // Paralel: personel + hizmet + staff_services + business settings
    const [staffRes, servicesRes, stsRes, bizRes] = await Promise.all([
      supabase
        .from('staff_members')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('services')
        .select('id, name, is_active')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('staff_services')
        .select('staff_id, service_id')
        .eq('business_id', businessId),
      supabase
        .from('businesses')
        .select('settings, sector')
        .eq('id', businessId)
        .maybeSingle(),
    ])

    if (staffRes.data) setStaff(staffRes.data)
    if (staffRes.error) console.error('Personel çekme hatası:', staffRes.error)

    if (servicesRes.data) setServices(servicesRes.data)

    // staff_services → personel başına service_id listesi
    if (stsRes.data) {
      const map: Record<string, string[]> = {}
      for (const row of stsRes.data) {
        if (!map[row.staff_id]) map[row.staff_id] = []
        map[row.staff_id].push(row.service_id)
      }
      setStaffServicesMap(map)
    }

    // Etiket havuzu — boşsa sektör default'unu sessizce kaydet
    if (bizRes.data) {
      const settings = (bizRes.data.settings as Record<string, unknown> | null) ?? {}
      const existingPool = (settings.staff_tag_options as string[] | undefined) ?? []
      if (existingPool.length === 0) {
        const sectorDefault = getStaffTagsForSector((bizRes.data.sector as SectorType) ?? 'other')
        // Sessiz hidrasyon — kullanıcıya bildirim yok
        await supabase
          .from('businesses')
          .update({ settings: { ...settings, staff_tag_options: sectorDefault } })
          .eq('id', businessId)
        setTagPool(sectorDefault)
      } else {
        setTagPool(existingPool)
      }
    }

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
    // Yeni personel: tüm aktif hizmetleri default ata (booking'de görünür kalsın)
    setSelectedTags([])
    setSelectedServiceIds(services.map(s => s.id))
    setSendInvite(true) // Default: email girildiğinde davet linki üretilsin
    setError(null); setShowModal(true)
  }

  function openEditModal(member: StaffMember) {
    setEditingStaff(member)
    setName(member.name); setRole(member.role)
    setPhone(member.phone || ''); setEmail(member.email || '')
    setSelectedTags(Array.isArray(member.tags) ? member.tags : [])
    setSelectedServiceIds(staffServicesMap[member.id] ?? [])
    setError(null); setShowModal(true)
  }

  /** Personel ↔ hizmet eşleşmesini sync et: eski satırları sil, yeni listeyi ekle. */
  async function syncStaffServices(staffMemberId: string, serviceIds: string[]) {
    if (!businessId) return
    // Önce mevcut atamaları sil (RLS owner/manager check'i geçer)
    await supabase
      .from('staff_services')
      .delete()
      .eq('staff_id', staffMemberId)
      .eq('business_id', businessId)
    if (serviceIds.length === 0) return
    const rows = serviceIds.map(sid => ({
      staff_id: staffMemberId,
      service_id: sid,
      business_id: businessId,
    }))
    const { error: stsErr } = await supabase.from('staff_services').insert(rows)
    if (stsErr) {
      console.error('staff_services sync hatası:', stsErr)
      throw stsErr
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null)

    // Manager can't set role to owner or manager
    if (currentUserRole === 'manager' && (role === 'owner' || role === 'manager')) {
      setError('Yönetici olarak sadece Personel rolü atayabilirsiniz.')
      setSaving(false)
      return
    }

    let staffMemberId: string | null = editingStaff?.id ?? null

    if (editingStaff) {
      const { error: err } = await supabase
        .from('staff_members')
        .update({
          name, role,
          phone: phone || null, email: email || null,
          tags: selectedTags,
        })
        .eq('id', editingStaff.id)
      if (err) { setError('Güncelleme hatası: ' + err.message); setSaving(false); return }
      setSelectedStaff(prev => prev?.id === editingStaff.id
        ? { ...prev, name, role, phone: phone || null, email: email || null, tags: selectedTags } as StaffMember
        : prev)
    } else {
      const { data: inserted, error: err } = await supabase.from('staff_members').insert({
        business_id: businessId, name, role,
        phone: phone || null, email: email || null, user_id: null, is_active: true,
        tags: selectedTags,
      }).select('id').single()
      if (err) { setError('Ekleme hatası: ' + err.message); setSaving(false); return }
      staffMemberId = inserted?.id ?? null
    }

    // Hizmet eşleşmelerini sync et
    if (staffMemberId) {
      try {
        await syncStaffServices(staffMemberId, selectedServiceIds)
      } catch (stsErr) {
        const msg = stsErr instanceof Error ? stsErr.message : 'Hizmet ataması başarısız'
        setError('Hizmet ataması kaydedilemedi: ' + msg)
        setSaving(false)
        return
      }
    }

    // Yeni personel + davet linki üretimi (sadece YENİ ekleme + email var + toggle ON + owner değil)
    let generatedLink: string | null = null
    const isNewStaff = !editingStaff
    const canInvite = isNewStaff && sendInvite && email && role !== 'owner' && currentUserRole === 'owner'
    if (canInvite && staffMemberId) {
      try {
        const res = await fetch('/api/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, role, staff_id: staffMemberId }),
        })
        const data = await res.json()
        if (res.ok && data.link) {
          generatedLink = data.link
        } else {
          // Davet üretilemese bile personel kayıt başarılı; sadece toast ile uyar
          window.dispatchEvent(new CustomEvent('pulse-toast', {
            detail: { type: 'error', title: 'Davet linki üretilemedi', body: data.error || 'Bilinmeyen hata' },
          }))
        }
      } catch {
        window.dispatchEvent(new CustomEvent('pulse-toast', {
          detail: { type: 'error', title: 'Davet linki üretilemedi' },
        }))
      }
    }

    setSaving(false); closeModal()
    await fetchStaff()
    window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Kaydedildi' } }))

    // Davet linki üretildiyse modal'da göster
    if (generatedLink) {
      setLinkModal({ link: generatedLink, staffName: name, role, email: email || null, type: 'invite' })
    }

    await logAudit({
      businessId: businessId!,
      staffId: currentStaffId,
      staffName: currentStaffName,
      action: editingStaff ? 'update' : 'create',
      resource: 'staff',
      resourceId: editingStaff?.id ?? staffMemberId ?? undefined,
      details: { name, role, tags: selectedTags, service_count: selectedServiceIds.length, invited: !!generatedLink },
    })
  }

  /** Mevcut personel için davet linki üret (per-row aksiyon). */
  async function generateInviteForExisting(member: StaffMember) {
    if (!member.email) {
      window.dispatchEvent(new CustomEvent('pulse-toast', {
        detail: { type: 'error', title: 'E-posta yok', body: 'Önce personele bir e-posta adresi tanımlayın.' },
      }))
      return
    }
    if (member.role === 'owner') return // owner davet edilemez
    setInviteLoadingFor(member.id)
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: member.email, role: member.role, staff_id: member.id }),
      })
      const data = await res.json()
      if (res.ok && data.link) {
        setLinkModal({ link: data.link, staffName: member.name, role: member.role, email: member.email, type: 'invite' })
      } else {
        window.dispatchEvent(new CustomEvent('pulse-toast', {
          detail: { type: 'error', title: 'Davet üretilemedi', body: data.error || 'Bilinmeyen hata' },
        }))
      }
    } catch {
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Davet üretilemedi' } }))
    } finally {
      setInviteLoadingFor(null)
    }
  }

  /** Sisteme dahil olmuş personel için şifre sıfırlama linki üret. */
  async function generateRecoveryLink(member: StaffMember) {
    if (!member.email) {
      window.dispatchEvent(new CustomEvent('pulse-toast', {
        detail: { type: 'error', title: 'E-posta yok', body: 'Önce personele bir e-posta adresi tanımlayın.' },
      }))
      return
    }

    const confirmed = await confirm({
      title: 'Şifre sıfırlama linki oluştur',
      message: `"${member.name}" adlı personelin zaten bir hesabı var.\n\nBu linki personele ilettiğinizde yeni bir şifre belirleyecek ve eski şifresi değişecektir. Devam etmek istiyor musunuz?`,
      confirmText: 'Linki Oluştur',
      cancelText: 'İptal',
      variant: 'warning',
    })
    if (!confirmed) return

    setRecoveryLoadingFor(member.id)
    try {
      const res = await fetch('/api/staff/recovery-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: member.id }),
      })
      const data = await res.json()
      if (res.ok && data.link) {
        setLinkModal({ link: data.link, staffName: member.name, role: member.role, email: member.email, type: 'recovery' })
      } else {
        window.dispatchEvent(new CustomEvent('pulse-toast', {
          detail: { type: 'error', title: 'Link üretilemedi', body: data.error || 'Bilinmeyen hata' },
        }))
      }
    } catch {
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Link üretilemedi' } }))
    } finally {
      setRecoveryLoadingFor(null)
    }
  }

  /** Etiket havuzu modal'ını aç + mevcut havuzu draft'a kopyala. */
  function openTagPoolModal() {
    setTagPoolDraft([...tagPool])
    setNewTagInput('')
    setTagPoolModal(true)
  }

  function addTagToDraft() {
    const trimmed = newTagInput.trim()
    if (!trimmed) return
    const lower = trimmed.toLowerCase()
    if (tagPoolDraft.some(t => t.toLowerCase() === lower)) {
      setNewTagInput('')
      return
    }
    setTagPoolDraft([...tagPoolDraft, trimmed])
    setNewTagInput('')
  }

  function removeTagFromDraft(tag: string) {
    setTagPoolDraft(tagPoolDraft.filter(t => t !== tag))
  }

  /** Etiket havuzunu kaydet — settings.staff_tag_options PATCH. */
  async function saveTagPool() {
    if (!businessId) return
    setTagPoolSaving(true)

    // Mevcut settings'i çek, merge et
    const { data: bizRow } = await supabase
      .from('businesses')
      .select('settings')
      .eq('id', businessId)
      .maybeSingle()
    const settings = (bizRow?.settings as Record<string, unknown> | null) ?? {}

    const { error: err } = await supabase
      .from('businesses')
      .update({ settings: { ...settings, staff_tag_options: tagPoolDraft } })
      .eq('id', businessId)

    if (err) {
      window.dispatchEvent(new CustomEvent('pulse-toast', {
        detail: { type: 'error', title: 'Etiket havuzu kaydedilemedi', body: err.message },
      }))
      setTagPoolSaving(false)
      return
    }

    setTagPool(tagPoolDraft)
    setTagPoolSaving(false)
    closeTagPoolModal()
    window.dispatchEvent(new CustomEvent('pulse-toast', {
      detail: { type: 'success', title: 'Etiket havuzu güncellendi' },
    }))
    await logAudit({
      businessId,
      staffId: currentStaffId,
      staffName: currentStaffName,
      action: 'update',
      resource: 'settings',
      details: { staff_tag_options: tagPoolDraft },
    })
  }

  function toggleSelectedTag(tag: string) {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag))
    } else {
      setSelectedTags([...selectedTags, tag])
    }
  }

  function toggleSelectedService(id: string) {
    if (selectedServiceIds.includes(id)) {
      setSelectedServiceIds(selectedServiceIds.filter(s => s !== id))
    } else {
      setSelectedServiceIds([...selectedServiceIds, id])
    }
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
    const memberServiceCount = staffServicesMap[member.id]?.length ?? 0
    // Davet edilebilir mi: henüz sisteme dahil değil (user_id null), email var, owner değil, current user owner
    const memberUserId = (member as { user_id?: string | null }).user_id ?? null
    const canInviteMember = currentUserRole === 'owner' && memberUserId === null && !!member.email && member.role !== 'owner'
    // Şifre sıfırlama: sisteme dahil olmuş (user_id dolu), email var, owner değil
    const canResetPassword = currentUserRole === 'owner' && memberUserId !== null && !!member.email && member.role !== 'owner'
    const isInvitingThis = inviteLoadingFor === member.id
    const isResettingThis = recoveryLoadingFor === member.id

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
                {memberUserId === null && member.role !== 'owner' && (
                  <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300" title="Bu personel henüz sisteme dahil olmadı (giriş yapamaz)">
                    Beklemede
                  </span>
                )}
                {member.role !== 'owner' && (
                  <span className="text-xs text-gray-400">{permCount}/{totalPerms} yetki</span>
                )}
                {memberServiceCount > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {memberServiceCount} hizmet
                  </span>
                )}
              </div>
              {Array.isArray(member.tags) && member.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {member.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-pulse-50 dark:bg-pulse-900/20 px-2 py-0.5 text-[10px] font-medium text-pulse-900 dark:text-pulse-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {(member.phone || member.email) && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {[member.phone, member.email].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            {canManageMember && (
              <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                {canInviteMember && (
                  <button
                    onClick={() => generateInviteForExisting(member)}
                    disabled={isInvitingThis}
                    className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors disabled:opacity-50"
                    title="Davet linki üret"
                  >
                    {isInvitingThis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                    Davet
                  </button>
                )}
                {canResetPassword && (
                  <button
                    onClick={() => generateRecoveryLink(member)}
                    disabled={isResettingThis}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50"
                    title="Şifre sıfırlama linki oluştur"
                  >
                    {isResettingThis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
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
            <ViewModeToggle
              value={viewMode}
              onChange={setViewMode}
              modes={[
                { key: 'list', icon: <LayoutList className="h-4 w-4" />, label: 'Liste' },
                { key: 'box', icon: <LayoutGrid className="h-4 w-4" />, label: 'Kutular' },
              ]}
            />
          </div>
          {(currentUserRole === 'owner' || currentUserRole === 'manager') && (
            <button onClick={openTagPoolModal} className="btn-secondary" title="Personel etiket havuzunu düzenle">
              <Tag className="mr-2 h-4 w-4" />Etiket Havuzu
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
        <div className={`modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-4 ${isClosingSelectedStaff ? 'closing' : ''}`} onClick={closeSelectedStaff} onAnimationEnd={() => { if (isClosingSelectedStaff) { setSelectedStaff(null); setIsClosingSelectedStaff(false) } }}>
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
                {Array.isArray(selectedStaff.tags) && selectedStaff.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 justify-center mt-2">
                    {selectedStaff.tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-pulse-50 dark:bg-pulse-900/20 px-2 py-0.5 text-[11px] font-medium text-pulse-900 dark:text-pulse-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
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

              {/* Yapabildiği Hizmetler */}
              {(staffServicesMap[selectedStaff.id]?.length ?? 0) > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Yapabildiği Hizmetler ({staffServicesMap[selectedStaff.id]!.length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(staffServicesMap[selectedStaff.id] ?? []).map(sid => {
                      const svc = services.find(s => s.id === sid)
                      if (!svc) return null
                      return (
                        <span
                          key={sid}
                          className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-xs text-gray-700 dark:text-gray-300"
                        >
                          {svc.name}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

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
        <div className={`modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-4 ${isClosingModal ? 'closing' : ''}`} onAnimationEnd={() => { if (isClosingModal) { setShowModal(false); setIsClosingModal(false) } }}>
          <div className={`modal-content card w-full max-w-lg max-h-[90vh] overflow-y-auto ${isClosingModal ? 'closing' : ''}`}>
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
                <label htmlFor="staffEmail" className="label">E-posta {!editingStaff && '(giriş için)'}</label>
                <input id="staffEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="ahmet@ornek.com" />
              </div>

              {/* Davet linki üretimi — sadece YENİ personel + owner ekleyici */}
              {!editingStaff && currentUserRole === 'owner' && role !== 'owner' && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendInvite}
                      onChange={(e) => setSendInvite(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-pulse-900 focus:ring-pulse-900"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Sisteme giriş yetkisi ver
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {email
                          ? 'Kayıttan sonra paylaşabileceğiniz bir davet linki üretilecek. Personel link üzerinden şifresini belirleyip kendi paneline giriş yapar.'
                          : 'Davet linki üretilmesi için e-posta gerekiyor. E-posta boşsa sadece isim olarak eklenir, kişi sisteme giriş yapamaz.'}
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Etiketler — havuzdan multi-select chip */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Etiketler (opsiyonel)</label>
                  <button
                    type="button"
                    onClick={openTagPoolModal}
                    className="text-xs text-pulse-700 hover:text-pulse-900 dark:text-pulse-400 dark:hover:text-pulse-300"
                  >
                    Havuzu düzenle
                  </button>
                </div>
                {tagPool.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Henüz etiket havuzu yok. Yukarıdaki linkle etiket ekleyin.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {tagPool.map(tag => {
                      const isSelected = selectedTags.includes(tag)
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleSelectedTag(tag)}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                            isSelected
                              ? 'border-pulse-900 bg-pulse-900 text-white'
                              : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-500',
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Yapabildiği hizmetler — multi-select chip */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Yapabildiği Hizmetler</label>
                  {services.length > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setSelectedServiceIds(services.map(s => s.id))}
                        className="text-pulse-700 hover:text-pulse-900 dark:text-pulse-400 dark:hover:text-pulse-300"
                      >
                        Tümü
                      </button>
                      <span className="text-gray-300 dark:text-gray-600">·</span>
                      <button
                        type="button"
                        onClick={() => setSelectedServiceIds([])}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        Hiçbiri
                      </button>
                    </div>
                  )}
                </div>
                {services.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Önce Ayarlar &raquo; Hizmetler&apos;den hizmet ekleyin.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                    {services.map(svc => {
                      const isSelected = selectedServiceIds.includes(svc.id)
                      return (
                        <button
                          key={svc.id}
                          type="button"
                          onClick={() => toggleSelectedService(svc.id)}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                            isSelected
                              ? 'border-pulse-900 bg-pulse-900 text-white'
                              : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-500',
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                          {svc.name}
                        </button>
                      )
                    })}
                  </div>
                )}
                {selectedServiceIds.length === 0 && services.length > 0 && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ Hizmet seçilmedi — bu personel müşteri randevu alma sayfasında hiçbir hizmette görünmez.
                  </p>
                )}
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

      {/* Etiket Havuzu Modal — chip listesi, ekle/sil */}
      {tagPoolModal && (
        <Portal>
        <div
          className={`modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-4 ${tagPoolModalClosing ? 'closing' : ''}`}
          onClick={closeTagPoolModal}
          onAnimationEnd={() => { if (tagPoolModalClosing) { setTagPoolModal(false); setTagPoolModalClosing(false) } }}
        >
          <div
            className={`modal-content card w-full max-w-md ${tagPoolModalClosing ? 'closing' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="h-section">Etiket Havuzu</h2>
              <button onClick={closeTagPoolModal} className="text-gray-400 hover:text-gray-600" aria-label="Kapat">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Personellere atayabileceğiniz etiketleri burada yönetin (örn. Doktor, Asistan, Resepsiyon).
            </p>

            {/* Mevcut etiket chip'leri */}
            <div className="flex flex-wrap gap-2 mb-4 min-h-[48px] rounded-lg border border-gray-200 dark:border-gray-700 p-2">
              {tagPoolDraft.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1">
                  Henüz etiket eklenmedi.
                </p>
              ) : (
                tagPoolDraft.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 rounded-full bg-pulse-100 dark:bg-pulse-900/30 px-3 py-1 text-xs font-medium text-pulse-900 dark:text-pulse-300"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTagFromDraft(tag)}
                      className="rounded-full p-0.5 text-pulse-700 hover:bg-pulse-200 dark:text-pulse-400 dark:hover:bg-pulse-800/40"
                      aria-label={`${tag} etiketini kaldır`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Yeni etiket ekleme */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTagToDraft()
                  }
                }}
                placeholder="Yeni etiket (örn. Operatör)"
                className="input flex-1"
                maxLength={40}
              />
              <button
                type="button"
                onClick={addTagToDraft}
                disabled={!newTagInput.trim()}
                className="btn-secondary px-4"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeTagPoolModal}
                className="btn-secondary flex-1"
                disabled={tagPoolSaving}
              >
                İptal
              </button>
              <button
                type="button"
                onClick={saveTagPool}
                disabled={tagPoolSaving}
                className="btn-primary flex-1"
              >
                {tagPoolSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />}
                Kaydet
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Davet Linki Sonuç Modalı */}
      {linkModal && (
        <Portal>
        <div
          className={`modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-4 ${linkModalClosing ? 'closing' : ''}`}
          onClick={closeLinkModal}
          onAnimationEnd={() => { if (linkModalClosing) { setLinkModal(null); setLinkModalClosing(false) } }}
        >
          <div className={`modal-content card w-full max-w-md ${linkModalClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="h-section">
                  {linkModal.type === 'recovery' ? 'Şifre Sıfırlama Linki Hazır' : 'Davet Linki Hazır'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  <span className="font-medium text-gray-700 dark:text-gray-200">{linkModal.staffName}</span>
                  {' · '}
                  <span>{ROLE_LABELS[linkModal.role]}</span>
                  {linkModal.email && <> · <span className="font-mono text-xs">{linkModal.email}</span></>}
                </p>
              </div>
              <button onClick={closeLinkModal} className="text-gray-400 hover:text-gray-600" aria-label="Kapat">
                <X className="h-5 w-5" />
              </button>
            </div>

            {linkModal.type === 'recovery' ? (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 p-3 mb-3">
                <p className="text-[11px] uppercase tracking-wide text-amber-700 dark:text-amber-400 font-semibold mb-1">
                  ⚠️ Mevcut hesap · Şifre değişecek
                </p>
                <p className="text-xs text-gray-700 dark:text-gray-300 break-all font-mono leading-relaxed">
                  {linkModal.link}
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/40 p-3 mb-3">
                <p className="text-[11px] uppercase tracking-wide text-green-700 dark:text-green-400 font-semibold mb-1">
                  7 gün geçerli · Tek kullanımlık
                </p>
                <p className="text-xs text-gray-700 dark:text-gray-300 break-all font-mono leading-relaxed">
                  {linkModal.link}
                </p>
              </div>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
              {linkModal.type === 'recovery'
                ? 'Bu linki personele iletin. Link üzerinden yeni şifresini belirleyebilir. Personelin eski şifresi artık geçersiz olacak.'
                : 'Bu linki personele iletmeniz yeterli. Link üzerinden adı ve şifresini belirleyip sisteme dahil olur. Link iletilince personel listesinde “Beklemede” rozeti, kabul edildiğinde kaybolur.'}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(linkModal.link)
                  window.dispatchEvent(new CustomEvent('pulse-toast', {
                    detail: {
                      type: 'success',
                      title: 'Kopyalandı',
                      body: linkModal.type === 'recovery' ? 'Şifre sıfırlama linki panoya kopyalandı' : 'Davet linki panoya kopyalandı',
                    },
                  }))
                }}
                className="btn-primary flex-1 text-sm"
              >
                Linki Kopyala
              </button>
              {linkModal.email && (
                <a
                  href={`mailto:${linkModal.email}?subject=${encodeURIComponent(
                    linkModal.type === 'recovery'
                      ? 'Şifre sıfırlama — PulseApp'
                      : 'Sisteme davet — ' + (currentStaffName || 'PulseApp')
                  )}&body=${encodeURIComponent(
                    linkModal.type === 'recovery'
                      ? `Merhaba ${linkModal.staffName},\n\nPulseApp şifrenizi sıfırlamak için aşağıdaki linki kullanabilirsiniz:\n${linkModal.link}\n\nLinke tıkladığınızda yeni şifrenizi belirleyebilirsiniz.`
                      : `Merhaba ${linkModal.staffName},\n\nSisteme dahil olmak için aşağıdaki linki kullanabilirsin:\n${linkModal.link}\n\nLink 7 gün geçerli.`
                  )}`}
                  className="btn-secondary text-sm flex items-center justify-center"
                  title="E-posta uygulamasında aç"
                >
                  <Mail className="h-4 w-4 mr-1.5" />
                  E-posta
                </a>
              )}
              <button onClick={closeLinkModal} className="btn-secondary text-sm">Kapat</button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  )
}
