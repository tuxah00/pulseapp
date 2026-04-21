'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { useViewMode } from '@/lib/hooks/use-view-mode'
import {
  Plus, Search, Loader2, Phone, Mail, Calendar, Cake, Filter, ArrowUpDown,
  X, Pencil, Trash2, User, LayoutList, LayoutGrid,
  Clock, Star, MessageSquare, CheckCircle, XCircle, AlertTriangle, Info, Download,
  Gift, FileText, ChevronRight,
} from 'lucide-react'
import { formatPhone, formatDate, formatTime, formatCurrency, getSegmentColor, cn, getInitials, formatDateISO } from '@/lib/utils'
import { SEGMENT_LABELS, STATUS_LABELS, REFERRAL_STATUS_LABELS, REWARD_TYPE_LABELS, type Customer, type CustomerSegment, type Referral, type RewardType, type LoyaltyPoints } from '@/types'
import type { AppointmentRow, MessageRow, ReviewRow } from '@/types/db'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { customerCreateSchema, type CustomerCreateInput } from '@/lib/schemas/customer'

type AppointmentTimelineData = Pick<
  AppointmentRow,
  'id' | 'appointment_date' | 'start_time' | 'end_time' | 'status' | 'notes'
> & {
  services: { name: string } | null
  staff_members: { name: string } | null
}

type TimelineItem =
  | { id: string; type: 'appointment'; date: string; sortDate: string; data: AppointmentTimelineData }
  | { id: string; type: 'message'; date: string; sortDate: string; data: MessageRow }
  | { id: string; type: 'review'; date: string; sortDate: string; data: ReviewRow }
import { logAudit } from '@/lib/utils/audit'
import CompactBoxCard from '@/components/ui/compact-box-card'
import { AnimatedList, AnimatedItem } from '@/components/ui/animated-list'
import { ToolbarPopover, SortPopoverContent } from '@/components/ui/toolbar-popover'
import { exportToCSV } from '@/lib/utils/export'
import { CustomSelect } from '@/components/ui/custom-select'
import { Portal } from '@/components/ui/portal'
import EmptyState from '@/components/ui/empty-state'

import { useRouter, useSearchParams } from 'next/navigation'
import { getCustomerLabel, getCustomerLabelSingular } from '@/lib/config/sector-modules'
import { getCustomerNotesPlaceholder } from '@/lib/config/sector-labels'
import dynamic from 'next/dynamic'
const ToothChart = dynamic(() => import('@/components/dashboard/tooth-chart'), {
  loading: () => <div className="h-40 w-full animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg" />
})

import { isBirthdayToday } from '@/lib/utils/birthday'
import { useConfirm } from '@/lib/hooks/use-confirm'

const VALID_SEGMENTS: CustomerSegment[] = ['new', 'regular', 'vip', 'risk', 'lost']

export default function CustomersPage() {
  const { businessId, staffId, staffName, loading: ctxLoading, sector } = useBusinessContext()
  const { confirm } = useConfirm()
  const searchParams = useSearchParams()
  const customerLabel = sector ? getCustomerLabel(sector) : 'Müşteriler'
  const singularLabel = getCustomerLabelSingular(sector ?? undefined)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [filterSegment, setFilterSegment] = useState<CustomerSegment | 'all'>(() => {
    const q = searchParams?.get('segment')
    return q && (VALID_SEGMENTS as string[]).includes(q) ? (q as CustomerSegment) : 'all'
  })
  const [showModal, setShowModal] = useState(false)
  const [isClosingModal, setIsClosingModal] = useState(false)
  const closeModal = () => setIsClosingModal(true)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [panelClosing, setPanelClosing] = useState(false)
  const closePanelAnimated = useCallback(() => setPanelClosing(true), [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useViewMode('customers', 'list')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const PAGE_SIZE = 50

  const [segment, setSegment] = useState<CustomerSegment>('new')
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerCreateInput>({
    resolver: zodResolver(customerCreateSchema),
    defaultValues: { name: '', phone: '', email: undefined, notes: undefined, birthday: undefined },
  })

  // Advanced filters (popover tabanlı)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [minVisits, setMinVisits] = useState('')

  // Sort
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Timeline state
  const [panelTab, setPanelTab] = useState<'info' | 'history' | 'teeth'>('info')
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)

  // Allergy state
  const [allergies, setAllergies] = useState<any[]>([])
  const [allergiesLoading, setAllergiesLoading] = useState(false)
  const [showAllergyForm, setShowAllergyForm] = useState(false)
  const [newAllergen, setNewAllergen] = useState('')
  const [newSeverity, setNewSeverity] = useState<'mild' | 'moderate' | 'severe'>('moderate')
  const [newReaction, setNewReaction] = useState('')

  // Detay paneli ek veriler
  const [upcomingAppointments, setUpcomingAppointments] = useState<AppointmentTimelineData[]>([])
  const [customerReferrals, setCustomerReferrals] = useState<Referral[]>([])
  const [customerReviews, setCustomerReviews] = useState<ReviewRow[]>([])
  const [customerRecordsCount, setCustomerRecordsCount] = useState(0)
  const [detailLoading, setDetailLoading] = useState(false)

  // Sadakat puan
  const [customerLoyalty, setCustomerLoyalty] = useState<LoyaltyPoints | null>(null)
  const [loyaltyRedemptionRate, setLoyaltyRedemptionRate] = useState(10)
  const [showRedeemModal, setShowRedeemModal] = useState(false)
  const [redeemPoints, setRedeemPoints] = useState('')
  const [redeemDesc, setRedeemDesc] = useState('')
  const [redeemSaving, setRedeemSaving] = useState(false)

  // Ödül verme modalı
  const [showRewardModal, setShowRewardModal] = useState(false)
  const [isClosingReward, setIsClosingReward] = useState(false)
  const closeRewardModal = () => setIsClosingReward(true)
  const [rewardType, setRewardType] = useState<RewardType>('discount_percent')
  const [rewardValue, setRewardValue] = useState('')
  const [rewardSaving, setRewardSaving] = useState(false)

  const router = useRouter()

  const supabase = createClient()

  // URL ?segment= değişikliklerinde filtreyi güncelle (Analytics'ten gelen link gibi)
  useEffect(() => {
    const q = searchParams?.get('segment')
    if (q && (VALID_SEGMENTS as string[]).includes(q)) {
      setFilterSegment(q as CustomerSegment)
    }
  }, [searchParams])

  const fetchCustomers = useCallback(async () => {
    if (!businessId) return
    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (filterSegment !== 'all') query = query.eq('segment', filterSegment)
    if (debouncedSearch.trim()) query = query.or(`name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`)

    const { data, error, count } = await query
    if (data) setCustomers(data)
    if (count !== null) setTotalCount(count)
    if (error) console.error('Müşteri çekme hatası:', error)
    setLoading(false)
  }, [businessId, filterSegment, debouncedSearch, page, supabase])

  useEffect(() => { if (!ctxLoading) fetchCustomers() }, [fetchCustomers, ctxLoading])

  // Filtre/arama değiştiğinde sayfayı sıfırla
  useEffect(() => { setPage(0) }, [filterSegment, debouncedSearch])

  function openNewModal() {
    setEditingCustomer(null)
    setSegment('new')
    reset({ name: '', phone: '', email: undefined, notes: undefined, birthday: undefined })
    setError(null); setShowModal(true)
  }

  function openEditModal(customer: Customer) {
    setEditingCustomer(customer)
    setSegment(customer.segment || 'new')
    reset({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || undefined,
      birthday: customer.birthday || undefined,
      notes: customer.notes || undefined,
    })
    setError(null); setShowModal(true)
  }

  const onValidSubmit = async (values: CustomerCreateInput) => {
    setSaving(true); setError(null)
    const customerData = {
      name: values.name,
      phone: values.phone, // schema 10 haneli "5XXXXXXXXX" formatına normalize etti
      email: values.email ?? null,
      birthday: values.birthday ?? null,
      notes: values.notes ?? null,
      segment,
      business_id: businessId,
    }
    if (editingCustomer) {
      const { error } = await supabase.from('customers').update({
        name: customerData.name,
        phone: customerData.phone,
        email: customerData.email,
        birthday: customerData.birthday,
        notes: customerData.notes,
        segment,
      }).eq('id', editingCustomer.id)
      if (error) {
        setError(error.message.includes('idx_customers_business_phone') ? 'Bu telefon numarası zaten kayıtlı.' : error.message.includes('invalid input syntax') ? 'Geçersiz veri formatı. Lütfen girdiğiniz bilgileri kontrol edin.' : error.message)
        setSaving(false)
        return
      }
      setSelectedCustomer(prev => prev?.id === editingCustomer.id ? {
        ...prev,
        name: customerData.name,
        phone: customerData.phone,
        email: customerData.email,
        birthday: customerData.birthday,
        notes: customerData.notes,
        segment,
      } as Customer : prev)
    } else {
      const { error } = await supabase.from('customers').insert(customerData)
      if (error) {
        // Telefon unique constraint hatası — pasif kayıt varsa yeniden aktive et
        if (error.message.includes('idx_customers_business_phone')) {
          const { data: inactiveCustomer } = await supabase
            .from('customers')
            .select('id')
            .eq('business_id', businessId)
            .eq('phone', customerData.phone)
            .eq('is_active', false)
            .single()
          if (inactiveCustomer) {
            const { error: reactivateError } = await supabase
              .from('customers')
              .update({
                name: customerData.name,
                email: customerData.email,
                birthday: customerData.birthday,
                notes: customerData.notes,
                segment: customerData.segment,
                is_active: true,
              })
              .eq('id', inactiveCustomer.id)
            if (!reactivateError) {
              setSaving(false); setShowModal(false)
              await fetchCustomers()
              window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Müşteri yeniden aktive edildi' } }))
              return
            }
          }
          setError('Bu telefon numarası zaten kayıtlı.')
        } else {
          setError(error.message.includes('invalid input syntax') ? 'Geçersiz veri formatı. Lütfen girdiğiniz bilgileri kontrol edin.' : error.message)
        }
        setSaving(false)
        return
      }
    }
    setSaving(false); setShowModal(false)
    await fetchCustomers()
    window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: editingCustomer ? 'Kaydedildi' : 'Oluşturuldu' } }))
    await logAudit({
      businessId: businessId!,
      staffId,
      staffName,
      action: editingCustomer ? 'update' : 'create',
      resource: 'customer',
      resourceId: editingCustomer?.id,
      details: { name: customerData.name },
    })
  }

  async function handleDelete(customer: Customer) {
    const ok = await confirm({ title: 'Onay', message: `"${customer.name}" müşterisini silmek istediğinize emin misiniz?` })
    if (!ok) return
    await supabase.from('customers').update({ is_active: false }).eq('id', customer.id)
    if (selectedCustomer?.id === customer.id) setSelectedCustomer(null)
    await fetchCustomers()
    window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Silindi' } }))
    await logAudit({
      businessId: businessId!,
      staffId,
      staffName,
      action: 'delete',
      resource: 'customer',
      resourceId: customer.id,
      details: { name: customer.name },
    })
  }

  // Timeline verisi çekme
  const fetchTimeline = useCallback(async (customerId: string) => {
    if (!businessId) return
    setTimelineLoading(true)
    try {
      const [aptsRes, msgsRes, reviewsRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('id, appointment_date, start_time, end_time, status, notes, services(name), staff_members(name)')
          .eq('business_id', businessId)
          .eq('customer_id', customerId)
          .is('deleted_at', null)
          .order('appointment_date', { ascending: false })
          .order('start_time', { ascending: false })
          .limit(50),
        supabase
          .from('messages')
          .select('id, content, direction, channel, created_at')
          .eq('business_id', businessId)
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('reviews')
          .select('id, rating, comment, status, created_at')
          .eq('business_id', businessId)
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      const items: TimelineItem[] = []

      // Randevuları ekle
      if (aptsRes.data) {
        ;(aptsRes.data as unknown as AppointmentTimelineData[]).forEach((apt) => {
          items.push({
            id: `apt-${apt.id}`,
            type: 'appointment',
            date: apt.appointment_date,
            sortDate: `${apt.appointment_date}T${apt.start_time}`,
            data: apt,
          })
        })
      }

      // Mesajları ekle
      if (msgsRes.data) {
        ;(msgsRes.data as MessageRow[]).forEach((msg) => {
          const createdAt = msg.created_at
          if (!createdAt) return
          items.push({
            id: `msg-${msg.id}`,
            type: 'message',
            date: createdAt.split('T')[0],
            sortDate: createdAt,
            data: msg,
          })
        })
      }

      // Yorumları ekle
      if (reviewsRes.data) {
        ;(reviewsRes.data as ReviewRow[]).forEach((rev) => {
          const createdAt = rev.created_at
          if (!createdAt) return
          items.push({
            id: `rev-${rev.id}`,
            type: 'review',
            date: createdAt.split('T')[0],
            sortDate: createdAt,
            data: rev,
          })
        })
      }

      // Tarihe göre sırala (en yeni en üstte)
      items.sort((a, b) => b.sortDate.localeCompare(a.sortDate))
      setTimeline(items)
    } catch (err) {
      console.error('Timeline çekme hatası:', err)
      setTimeline([])
    } finally {
      setTimelineLoading(false)
    }
  }, [businessId, supabase])

  // Alerji verisi çekme
  const fetchAllergies = useCallback(async (customerId: string) => {
    if (!businessId) return
    setAllergiesLoading(true)
    const { data } = await supabase
      .from('customer_allergies')
      .select('*')
      .eq('business_id', businessId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
    setAllergies(data || [])
    setAllergiesLoading(false)
  }, [businessId, supabase])

  // Müşteri detay verilerini çek (info tab için)
  const fetchCustomerDetail = useCallback(async (customerId: string) => {
    if (!businessId) return
    setDetailLoading(true)
    try {
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

      const [aptsRes, refsRes, revsRes, recsRes, loyaltyRes] = await Promise.all([
        // Yaklaşan randevular
        supabase
          .from('appointments')
          .select('id, appointment_date, start_time, end_time, status, notes, services(name), staff_members(name)')
          .eq('business_id', businessId)
          .eq('customer_id', customerId)
          .is('deleted_at', null)
          .in('status', ['pending', 'confirmed'])
          .gte('appointment_date', todayStr)
          .order('appointment_date', { ascending: true })
          .order('start_time', { ascending: true })
          .limit(5),
        // Referanslar
        supabase
          .from('referrals')
          .select('*')
          .eq('business_id', businessId)
          .eq('referrer_customer_id', customerId)
          .order('created_at', { ascending: false })
          .limit(10),
        // Yorumlar
        supabase
          .from('reviews')
          .select('id, rating, comment, created_at')
          .eq('business_id', businessId)
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false })
          .limit(5),
        // Hasta dosyaları sayısı
        supabase
          .from('business_records')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .eq('customer_id', customerId),
        // Sadakat puanı
        fetch(`/api/loyalty?customerId=${customerId}`).then(r => r.json()).catch(() => ({ loyalty: null })),
      ])

      setUpcomingAppointments((aptsRes.data as unknown as AppointmentTimelineData[]) || [])
      setCustomerReferrals((refsRes.data as Referral[]) || [])
      setCustomerReviews((revsRes.data as ReviewRow[]) || [])
      setCustomerRecordsCount(recsRes.count || 0)
      setCustomerLoyalty((loyaltyRes as any)?.loyalty ?? null)
      setLoyaltyRedemptionRate((loyaltyRes as any)?.redemptionRate ?? 10)
    } catch (err) {
      console.error('Detay veri çekme hatası:', err)
    } finally {
      setDetailLoading(false)
    }
  }, [businessId, supabase])

  // Ödül verme
  async function handleGiveReward() {
    if (!selectedCustomer || !businessId || !rewardValue) return
    setRewardSaving(true)
    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          referrerCustomerId: selectedCustomer.id,
          referredName: 'Manuel Ödül',
          rewardType,
          rewardValue: parseFloat(rewardValue),
          status: 'converted',
          rewardClaimed: true,
        }),
      })
      if (res.ok) {
        closeRewardModal()
        setRewardValue('')
        fetchCustomerDetail(selectedCustomer.id)
      }
    } catch (err) {
      console.error('Ödül verme hatası:', err)
    } finally {
      setRewardSaving(false)
    }
  }

  async function handleRedeemPoints() {
    if (!selectedCustomer || !redeemPoints || Number(redeemPoints) <= 0) return
    setRedeemSaving(true)
    try {
      const res = await fetch('/api/loyalty', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          points: Number(redeemPoints),
          description: redeemDesc || 'Manuel indirim',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: data.error || 'Puan harcama başarısız' } }))
        return
      }
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'system', title: `-${redeemPoints} Puan Harcandı`, body: `Kalan bakiye: ${data.newBalance} puan` } }))
      setShowRedeemModal(false)
      setRedeemPoints('')
      setRedeemDesc('')
      fetchCustomerDetail(selectedCustomer.id)
    } catch {
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: 'Bağlantı hatası' } }))
    } finally {
      setRedeemSaving(false)
    }
  }

  // Tab değiştiğinde geçmişi yükle
  useEffect(() => {
    if (panelTab === 'history' && selectedCustomer) {
      fetchTimeline(selectedCustomer.id)
    }
  }, [panelTab, selectedCustomer, fetchTimeline])

  // Müşteri değiştiğinde tab'ı sıfırla + detay verilerini çek
  useEffect(() => {
    setPanelTab('info')
    setTimeline([])
    setShowAllergyForm(false)
    setNewAllergen('')
    setNewReaction('')
    setUpcomingAppointments([])
    setCustomerReferrals([])
    setCustomerReviews([])
    setCustomerRecordsCount(0)
    if (selectedCustomer) {
      fetchAllergies(selectedCustomer.id)
      fetchCustomerDetail(selectedCustomer.id)
    } else {
      setAllergies([])
    }
  }, [selectedCustomer, fetchAllergies, fetchCustomerDetail])

  useEffect(() => {
    if (!showModal) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [showModal])

  useEffect(() => {
    if (!selectedCustomer) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !showModal && !showRewardModal && !showRedeemModal) closePanelAnimated() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [selectedCustomer, showModal, showRewardModal, showRedeemModal, closePanelAnimated])

  useEffect(() => {
    if (!showRewardModal) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRewardModal() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [showRewardModal])

  useEffect(() => {
    if (!showRedeemModal) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowRedeemModal(false) }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [showRedeemModal])

  function getStatusIcon(status: string) {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'confirmed': return <CheckCircle className="h-4 w-4 text-blue-500" />
      case 'cancelled': return <XCircle className="h-4 w-4 text-red-500" />
      case 'no_show': return <AlertTriangle className="h-4 w-4 text-orange-500" />
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />
      default: return <Info className="h-4 w-4 text-gray-400" />
    }
  }

  function renderTimelineItem(item: TimelineItem) {
    if (item.type === 'appointment') {
      const apt = item.data
      const statusLabel = STATUS_LABELS[apt.status as keyof typeof STATUS_LABELS] || apt.status
      return (
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0">{getStatusIcon(apt.status)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {apt.services?.name || 'Randevu'} — {statusLabel}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {formatDate(apt.appointment_date)} · {formatTime(apt.start_time)} – {formatTime(apt.end_time)}
              {apt.staff_members?.name && ` · ${apt.staff_members.name}`}
            </p>
          </div>
        </div>
      )
    }

    if (item.type === 'message') {
      const msg = item.data
      const isInbound = msg.direction === 'inbound'
      return (
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0">
            <MessageSquare className={cn('h-4 w-4', isInbound ? 'text-purple-500' : 'text-blue-500')} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {isInbound ? 'Gelen Mesaj' : 'Gönderilen Mesaj'}
              <span className="ml-1 text-xs font-normal text-gray-400">({msg.channel?.toUpperCase()})</span>
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">{msg.content}</p>
            <p className="text-xs text-gray-400 mt-0.5">{formatDate(item.sortDate)}</p>
          </div>
        </div>
      )
    }

    if (item.type === 'review') {
      const rev = item.data
      return (
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0">
            <Star className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)} Yorum
            </p>
            {rev.comment && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">&ldquo;{rev.comment}&rdquo;</p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">{formatDate(item.sortDate)}</p>
          </div>
        </div>
      )
    }

    return null
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-pulse-900" /></div>
  }

  const hasActiveFilters = !!(dateFrom || dateTo || minVisits)
  const SORT_OPTIONS = [
    { value: 'name', label: 'İsim' },
    { value: 'created_at', label: 'Kayıt tarihi' },
    { value: 'total_visits', label: 'Toplam ziyaret' },
    { value: 'segment', label: 'Segment' },
  ]

  const filteredCustomers = (() => {
    let list = customers.filter(c => {
      if (dateFrom && c.created_at && c.created_at < dateFrom) return false
      if (dateTo && c.created_at && c.created_at > dateTo + 'T23:59:59') return false
      if (minVisits && (c.total_visits || 0) < parseInt(minVisits)) return false
      return true
    })
    if (sortField) {
      list = [...list].sort((a, b) => {
        const va = a[sortField as keyof Customer]
        const vb = b[sortField as keyof Customer]
        if (va == null && vb == null) return 0
        if (va == null) return 1
        if (vb == null) return -1
        const cmp =
          typeof va === 'string' && typeof vb === 'string'
            ? va.localeCompare(vb, 'tr')
            : (va as number) - (vb as number)
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return list
  })()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{customerLabel}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{totalCount} {customerLabel.toLowerCase()} kayıtlı</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => exportToCSV(
              customers.map(c => ({
                name: c.name,
                phone: c.phone,
                email: c.email || '',
                segment: SEGMENT_LABELS[c.segment] || c.segment,
                total_visits: c.total_visits,
                total_revenue: c.total_revenue,
                total_no_shows: c.total_no_shows,
                last_visit: c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString('tr-TR') : '',
                created_at: new Date(c.created_at).toLocaleDateString('tr-TR'),
              })),
              'musteri-listesi',
              [
                { key: 'name', label: 'İsim' },
                { key: 'phone', label: 'Telefon' },
                { key: 'email', label: 'E-posta' },
                { key: 'segment', label: 'Segment' },
                { key: 'total_visits', label: 'Toplam Ziyaret' },
                { key: 'total_revenue', label: 'Toplam Gelir (TL)' },
                { key: 'total_no_shows', label: 'Gelmeme' },
                { key: 'last_visit', label: 'Son Ziyaret' },
                { key: 'created_at', label: 'Kayıt Tarihi' },
              ]
            )}
            className="btn-secondary text-sm gap-1.5"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Dışa Aktar</span>
          </button>
          <button onClick={openNewModal} className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />{`Yeni ${singularLabel}`}
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" placeholder="İsim veya telefon ara..." />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterSegment('all')} className={cn('badge px-3 py-1.5 cursor-pointer transition-colors', filterSegment === 'all' ? 'bg-gray-900 dark:bg-gray-700 text-white dark:text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600')}>Tümü</button>
          {(['new', 'regular', 'vip', 'risk', 'lost'] as CustomerSegment[]).map((seg) => (
            <button key={seg} onClick={() => setFilterSegment(seg)} className={cn('badge px-3 py-1.5 cursor-pointer transition-colors', filterSegment === seg ? getSegmentColor(seg) + ' ring-2 ring-offset-1' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600')}>
              {SEGMENT_LABELS[seg]}
            </button>
          ))}
        </div>
        {/* Birleşik toolbar: Filtre + Sırala + Görünüm */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 shrink-0">
          <ToolbarPopover icon={<Filter className="h-4 w-4" />} label="Filtre" active={hasActiveFilters}>
            <div className="p-3 w-56 space-y-3">
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Gelişmiş Filtreler</p>
              <div className="space-y-2">
                <label className="text-xs text-gray-500 dark:text-gray-400">Kayıt tarihi aralığı</label>
                <div className="space-y-1.5">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">Başlangıç</span>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input py-1 text-xs w-full" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">Bitiş</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input py-1 text-xs w-full" />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500 dark:text-gray-400">Min. ziyaret sayısı</label>
                <input type="number" min={0} value={minVisits} onChange={e => setMinVisits(e.target.value)} className="input py-1 text-sm w-full" placeholder="0" />
              </div>
              {hasActiveFilters && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); setMinVisits('') }} className="w-full text-xs text-center py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-1">
                  <X className="h-3 w-3" /> Temizle
                </button>
              )}
            </div>
          </ToolbarPopover>
          <ToolbarPopover icon={<ArrowUpDown className="h-4 w-4" />} label="Sırala" active={sortField !== null}>
            <SortPopoverContent
              options={SORT_OPTIONS}
              sortField={sortField}
              sortDir={sortDir}
              onSortField={setSortField}
              onSortDir={setSortDir}
            />
          </ToolbarPopover>
          <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-0.5" />
          <button onClick={() => setViewMode('list')} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', viewMode === 'list' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')} title="Liste"><LayoutList className="h-4 w-4" /></button>
          <button onClick={() => setViewMode('box')} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', viewMode === 'box' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')} title="Kutular"><LayoutGrid className="h-4 w-4" /></button>
        </div>
      </div>

      {filteredCustomers.length === 0 ? (
        <EmptyState
          icon={<User className="h-7 w-7" />}
          title={search || dateFrom || dateTo || minVisits ? 'Filtreye uygun müşteri bulunamadı' : `Henüz ${singularLabel.toLowerCase()} eklenmemiş`}
          action={!search && !dateFrom && !dateTo && !minVisits ? {
            label: `İlk ${singularLabel} Ekle`,
            onClick: openNewModal,
            icon: <Plus className="mr-2 h-4 w-4" />,
          } : undefined}
        />
      ) : (
        <div key={viewMode} className="view-transition">
        {viewMode === 'list' ? (
        <AnimatedList className="space-y-2">
          {filteredCustomers.map((customer) => {
            const initials = getInitials(customer.name)
            return (
              <AnimatedItem key={customer.id}>
                <div onClick={() => setSelectedCustomer(customer)} className={cn(
                  'rounded-2xl border px-4 py-3 cursor-pointer transition-all',
                  'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/50',
                  'hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm',
                  selectedCustomer?.id === customer.id && 'ring-2 ring-pulse-900 border-pulse-300 dark:border-pulse-700',
                )}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pulse-50 dark:bg-pulse-900/20 text-pulse-900 dark:text-pulse-400 font-semibold text-sm flex-shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{customer.name}</span>
                        {isBirthdayToday(customer.birthday) && <span title="Bugün doğum günü!"><Cake className="h-4 w-4 text-pink-500 flex-shrink-0" /></span>}
                        <span className={`badge text-xs ${getSegmentColor(customer.segment)}`}>{SEGMENT_LABELS[customer.segment]}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{formatPhone(customer.phone)}</p>
                    </div>
                    <div className="text-right text-xs flex-shrink-0 hidden sm:block">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{customer.total_visits} ziyaret</p>
                      <p className="text-gray-400 mt-0.5">{customer.last_visit_at ? formatDate(customer.last_visit_at) : 'Henüz yok'}</p>
                    </div>
                  </div>
                </div>
              </AnimatedItem>
            )
          })}
        </AnimatedList>
      ) : (
        <AnimatedList className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-2">
          {filteredCustomers.map((customer) => (
            <AnimatedItem key={customer.id}>
              <CompactBoxCard
                initials={customer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                title={customer.name}
                colorClass="bg-pulse-50 dark:bg-pulse-900/20 text-pulse-900 dark:text-pulse-400"
                badge={isBirthdayToday(customer.birthday) ? <Cake className="h-3.5 w-3.5 text-pink-500" /> : undefined}
                selected={selectedCustomer?.id === customer.id}
                onClick={() => setSelectedCustomer(customer)}
              />
            </AnimatedItem>
          ))}
        </AnimatedList>
        )}
        </div>
      )}

      {/* ── Sayfalama ── */}
      {totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} / {totalCount}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40"
            >
              Önceki
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * PAGE_SIZE >= totalCount}
              className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40"
            >
              Sonraki
            </button>
          </div>
        </div>
      )}

      {/* ── Müşteri Detay Slide-Over Paneli ── */}
      {selectedCustomer && (
        <Portal>
          <div className="fixed inset-0 z-[100] bg-black/50 dark:bg-black/70" onClick={closePanelAnimated} />
          <div
            className={`slide-panel border-l border-gray-200 dark:border-gray-700 ${panelClosing ? 'closing' : ''}`}
            onAnimationEnd={() => { if (panelClosing) { setSelectedCustomer(null); setPanelClosing(false) } }}
          >
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{`${singularLabel} Detayı`}</h3>
              <button onClick={closePanelAnimated} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tab Başlıkları */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setPanelTab('info')}
                className={cn(
                  'flex-1 py-2.5 text-sm font-medium text-center transition-colors',
                  panelTab === 'info'
                    ? 'text-pulse-900 border-b-2 border-pulse-900'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                Bilgiler
              </button>
              <button
                onClick={() => setPanelTab('history')}
                className={cn(
                  'flex-1 py-2.5 text-sm font-medium text-center transition-colors',
                  panelTab === 'history'
                    ? 'text-pulse-900 border-b-2 border-pulse-900'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                Geçmiş
              </button>
              {sector === 'dental_clinic' && (
                <button
                  onClick={() => setPanelTab('teeth')}
                  className={cn(
                    'flex-1 py-2.5 text-sm font-medium text-center transition-colors',
                    panelTab === 'teeth'
                      ? 'text-pulse-900 border-b-2 border-pulse-900'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  Diş Haritası
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {panelTab === 'info' ? (
                <>
                  {/* Avatar + isim */}
                  <div className="text-center">
                    <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-pulse-50 dark:bg-pulse-900/20 text-pulse-900 dark:text-pulse-400 font-bold text-lg">
                      {getInitials(selectedCustomer.name)}
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedCustomer.name}</h4>
                    <span className={`badge mt-1 ${getSegmentColor(selectedCustomer.segment)}`}>{SEGMENT_LABELS[selectedCustomer.segment]}</span>
                  </div>

                  {/* İletişim */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <a href={`tel:${selectedCustomer.phone}`} className="text-pulse-900 hover:underline">{formatPhone(selectedCustomer.phone)}</a>
                    </div>
                    {selectedCustomer.email && (
                      <div className="flex items-center gap-3 text-sm">
                        <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300 truncate">{selectedCustomer.email}</span>
                      </div>
                    )}
                    {selectedCustomer.birthday && (
                      <div className="flex items-center gap-3 text-sm">
                        <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300">{formatDate(selectedCustomer.birthday)}</span>
                      </div>
                    )}
                  </div>

                  {/* İstatistikler */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{selectedCustomer.total_visits}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Ziyaret</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <p className="text-lg font-bold text-price">{formatCurrency(selectedCustomer.total_revenue)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Toplam</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{selectedCustomer.total_no_shows}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Gelmedi</p>
                    </div>
                  </div>

                  {/* Sadakat Puan Kartı */}
                  {customerLoyalty && (
                    <div className="rounded-xl p-3 border border-purple-200 dark:border-purple-700/50 bg-purple-50 dark:bg-purple-900/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold flex items-center gap-1.5 text-purple-700 dark:text-purple-300">
                          <Gift className="h-3.5 w-3.5" />
                          Sadakat Puanı
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                            {customerLoyalty.points_balance.toLocaleString('tr-TR')} puan
                          </span>
                          {customerLoyalty.points_balance > 0 && (
                            <button
                              onClick={() => setShowRedeemModal(true)}
                              className="text-xs px-2 py-0.5 rounded-lg bg-white/60 dark:bg-gray-800/60 border border-purple-300 dark:border-purple-600 text-purple-700 dark:text-purple-300 font-medium hover:bg-white dark:hover:bg-gray-700 transition-colors"
                            >
                              Kullan
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Kazanılan</span>
                          <p className="font-semibold text-gray-700 dark:text-gray-300">{customerLoyalty.total_earned.toLocaleString('tr-TR')}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Harcanan</span>
                          <p className="font-semibold text-gray-700 dark:text-gray-300">{customerLoyalty.total_spent.toLocaleString('tr-TR')}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedCustomer.notes && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notlar</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">{selectedCustomer.notes}</p>
                    </div>
                  )}

                  {/* Alerjiler */}
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                        Alerjiler
                      </h4>
                      <button
                        onClick={() => setShowAllergyForm(!showAllergyForm)}
                        className="text-xs text-blue-500 hover:text-blue-600 font-medium"
                      >
                        {showAllergyForm ? 'İptal' : '+ Ekle'}
                      </button>
                    </div>

                    {showAllergyForm && (
                      <div className="space-y-2 mb-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                        <input
                          placeholder="Alerjen (ör: Lateks, Penisilin)"
                          value={newAllergen}
                          onChange={(e) => setNewAllergen(e.target.value)}
                          className="input text-sm"
                        />
                        <CustomSelect
                          options={[
                            { value: 'mild', label: 'Hafif' },
                            { value: 'moderate', label: 'Orta' },
                            { value: 'severe', label: 'Şiddetli' },
                          ]}
                          value={newSeverity}
                          onChange={(v) => setNewSeverity(v as any)}
                          className="w-28"
                        />
                        <input
                          placeholder="Reaksiyon (opsiyonel)"
                          value={newReaction}
                          onChange={(e) => setNewReaction(e.target.value)}
                          className="input text-sm"
                        />
                        <button
                          onClick={async () => {
                            if (!newAllergen.trim() || !businessId || !selectedCustomer) return
                            await supabase.from('customer_allergies').insert({
                              business_id: businessId,
                              customer_id: selectedCustomer.id,
                              allergen: newAllergen.trim(),
                              severity: newSeverity,
                              reaction: newReaction.trim() || null,
                              created_by: staffId,
                            })
                            setNewAllergen('')
                            setNewReaction('')
                            setShowAllergyForm(false)
                            fetchAllergies(selectedCustomer.id)
                          }}
                          className="btn-primary text-sm w-full"
                        >
                          Kaydet
                        </button>
                      </div>
                    )}

                    {allergiesLoading ? (
                      <p className="text-xs text-gray-400">Yükleniyor...</p>
                    ) : allergies.length === 0 ? (
                      <p className="text-xs text-gray-400">Kayıtlı alerji yok</p>
                    ) : (
                      <div className="space-y-1.5">
                        {allergies.map((a) => (
                          <div key={a.id} className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
                            <div className="flex items-center gap-2">
                              <span className={`inline-block w-2 h-2 rounded-full ${
                                a.severity === 'severe' ? 'bg-red-500' : a.severity === 'moderate' ? 'bg-amber-500' : 'bg-yellow-400'
                              }`} />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{a.allergen}</span>
                              {a.reaction && <span className="text-xs text-gray-400">— {a.reaction}</span>}
                            </div>
                            <button
                              onClick={async () => {
                                await supabase.from('customer_allergies').delete().eq('id', a.id)
                                fetchAllergies(selectedCustomer!.id)
                              }}
                              className="text-gray-300 hover:text-red-500 transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── 1. Yaklaşan Randevular ── */}
                  {detailLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-pulse-900" /></div>
                  ) : upcomingAppointments.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" /> Yaklaşan Randevular
                      </p>
                      <div className="space-y-2">
                        {upcomingAppointments.map((apt) => (
                          <div key={apt.id} className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3">
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">{apt.services?.name || 'Randevu'}</p>
                            <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                              {formatDate(apt.appointment_date)} · {formatTime(apt.start_time)} – {formatTime(apt.end_time)}
                              {apt.staff_members?.name && ` · ${apt.staff_members.name}`}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── 2. Referans Ödülleri ── */}
                  {!detailLoading && customerReferrals.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                        <Gift className="h-3.5 w-3.5" /> Referans Ödülleri
                      </p>
                      <div className="space-y-2">
                        {customerReferrals.map((ref) => (
                          <div key={ref.id} className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{ref.referred_name || 'İsimsiz'}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {REFERRAL_STATUS_LABELS[ref.status]} · {ref.reward_type ? REWARD_TYPE_LABELS[ref.reward_type] : '—'}
                                {ref.reward_value ? ` (${ref.reward_value})` : ''}
                              </p>
                            </div>
                            <span className={ref.reward_claimed ? 'badge-success' : 'badge-warning'}>
                              {ref.reward_claimed ? 'Alındı' : 'Bekliyor'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── 3. Yorumlar ── */}
                  {!detailLoading && customerReviews.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                        <Star className="h-3.5 w-3.5" /> Yorumlar
                      </p>
                      <div className="space-y-2">
                        {customerReviews.map((rev) => (
                          <div key={rev.id} className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-amber-500">{'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}</span>
                              <span className="text-xs text-gray-400">{rev.created_at ? formatDate(rev.created_at) : ''}</span>
                            </div>
                            {rev.comment && <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-3">{rev.comment}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── 4. Toplam Getiri + Ödül Verme ── */}
                  {!detailLoading && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                        <Gift className="h-3.5 w-3.5" /> Toplam Getiri
                      </p>
                      <div className="rounded-lg bg-gradient-to-r from-pulse-50 to-blue-50 dark:from-pulse-900/20 dark:to-blue-900/20 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold text-pulse-900 dark:text-pulse-300">{formatCurrency(selectedCustomer.total_revenue)}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{selectedCustomer.total_visits} ziyarette</p>
                          </div>
                          <button
                            onClick={() => { setRewardType('discount_percent'); setRewardValue(''); setShowRewardModal(true) }}
                            className="btn-primary text-sm px-3 py-1.5"
                          >
                            <Gift className="mr-1.5 h-3.5 w-3.5" /> Ödül Ver
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── 5. Hasta Dosyaları Yönlendirme ── */}
                  {!detailLoading && customerRecordsCount > 0 && (
                    <div>
                      <button
                        onClick={() => router.push(`/dashboard/records?customerId=${selectedCustomer.id}`)}
                        className="w-full rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Hasta Dosyaları</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{customerRecordsCount} kayıt mevcut</p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                  )}

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex gap-2">
                    <button onClick={() => openEditModal(selectedCustomer)} className="btn-secondary flex-1 text-sm">
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />Düzenle
                    </button>
                    <button onClick={() => handleDelete(selectedCustomer)} className="btn-danger flex-1 text-sm">
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />Sil
                    </button>
                  </div>
                </>
              ) : panelTab === 'teeth' && sector === 'dental_clinic' ? (
                /* ── Diş Haritası ── */
                businessId && selectedCustomer ? (
                  <ToothChart
                    businessId={businessId}
                    customerId={selectedCustomer.id}
                    staffId={staffId ?? null}
                  />
                ) : null
              ) : (
                /* ── Geçmiş / Zaman Çizelgesi ── */
                timelineLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-pulse-900" />
                  </div>
                ) : timeline.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <Clock className="h-10 w-10 mb-3" />
                    <p className="text-sm">Henüz aktivite kaydı yok</p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Timeline çizgisi */}
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-700" />
                    <div className="space-y-4">
                      {timeline.map((item) => (
                        <div key={item.id} className="relative pl-6">
                          {/* Timeline noktası */}
                          <div className={cn(
                            'absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full border-2 border-white dark:border-gray-800',
                            item.type === 'appointment' ? 'bg-blue-400' :
                            item.type === 'message' ? 'bg-purple-400' :
                            item.type === 'review' ? 'bg-amber-400' : 'bg-gray-400'
                          )} />
                          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">
                            {renderTimelineItem(item)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </Portal>
      )}

      {/* Modal */}
      {(showModal || isClosingModal) && (
        <Portal>
        <div className={`modal-overlay fixed inset-0 z-[115] flex items-center justify-center bg-black/60 dark:bg-black/70 p-4 ${isClosingModal ? 'closing' : ''}`} onAnimationEnd={() => { if (isClosingModal) { setShowModal(false); setIsClosingModal(false) } }}>
          <div className={`modal-content card w-full max-w-md dark:bg-gray-900 ${isClosingModal ? 'closing' : ''}`}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {editingCustomer ? `${singularLabel} Düzenle` : `Yeni ${singularLabel} Ekle`}
            </h2>
            <form onSubmit={handleSubmit(onValidSubmit)} className="space-y-4" noValidate>
              <div>
                <label htmlFor="custName" className="label">Ad Soyad</label>
                <input id="custName" type="text" {...register('name')} className="input" placeholder="Ayşe Yılmaz" autoFocus />
                {errors.name && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name.message}</p>}
              </div>
              <div>
                <label htmlFor="custPhone" className="label">Telefon</label>
                <input id="custPhone" type="tel" {...register('phone')} className="input" placeholder="0532 123 45 67" />
                {errors.phone && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.phone.message}</p>}
              </div>
              <div>
                <label htmlFor="custEmail" className="label">E-posta (opsiyonel)</label>
                <input id="custEmail" type="email" {...register('email')} className="input" placeholder="ayse@email.com" />
                {errors.email && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email.message}</p>}
              </div>
              <div>
                <label htmlFor="custBday" className="label">Doğum Tarihi (opsiyonel)</label>
                <input
                  id="custBday"
                  type="date"
                  {...register('birthday')}
                  className="input"
                  min={(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 120); return formatDateISO(d) })()}
                />

                {errors.birthday && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.birthday.message}</p>}
              </div>
              <div>
                <label htmlFor="custNotes" className="label">Notlar (opsiyonel)</label>
                <textarea id="custNotes" {...register('notes')} className="input" rows={3} placeholder={getCustomerNotesPlaceholder(sector)} />
                {errors.notes && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.notes.message}</p>}
              </div>
              <div>
                <label htmlFor="custSegment" className="label">Segment</label>
                <CustomSelect
                  options={(['new', 'regular', 'vip', 'risk', 'lost'] as CustomerSegment[]).map(seg => ({ value: seg, label: SEGMENT_LABELS[seg] }))}
                  value={segment}
                  onChange={v => setSegment(v as CustomerSegment)}
                  className="input"
                />
              </div>
              {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => closeModal()} className="btn-secondary flex-1">İptal</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingCustomer ? 'Güncelle' : 'Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}

      {/* Ödül Verme Modalı */}
      {(showRewardModal || isClosingReward) && (
        <Portal>
          <div className={`modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/60 dark:bg-black/70 p-4 ${isClosingReward ? 'closing' : ''}`} onAnimationEnd={() => { if (isClosingReward) { setShowRewardModal(false); setIsClosingReward(false) } }}>
            <div className={`modal-content card w-full max-w-sm dark:bg-gray-900 ${isClosingReward ? 'closing' : ''}`}>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Gift className="h-5 w-5 text-pulse-900 dark:text-pulse-300" /> Ödül Ver
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Ödül Tipi</label>
                  <CustomSelect
                    options={[
                      { value: 'discount_percent', label: REWARD_TYPE_LABELS.discount_percent },
                      { value: 'discount_amount', label: REWARD_TYPE_LABELS.discount_amount },
                      { value: 'free_service', label: REWARD_TYPE_LABELS.free_service },
                      { value: 'points', label: REWARD_TYPE_LABELS.points },
                    ]}
                    value={rewardType}
                    onChange={v => setRewardType(v as RewardType)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Değer</label>
                  <input
                    type="number"
                    value={rewardValue}
                    onChange={e => setRewardValue(e.target.value)}
                    className="input"
                    placeholder={rewardType === 'discount_percent' ? 'Ör: 10' : rewardType === 'discount_amount' ? 'Ör: 50' : rewardType === 'points' ? 'Ör: 100' : 'Ör: 1'}
                    min={0}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeRewardModal} className="btn-secondary flex-1">İptal</button>
                <button type="button" onClick={handleGiveReward} disabled={rewardSaving || !rewardValue} className="btn-primary flex-1">
                  {rewardSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Ödül Ver
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Puan Harcama Modalı */}
      {showRedeemModal && selectedCustomer && customerLoyalty && (
        <Portal>
          <div
            className="modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/60 dark:bg-black/70 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowRedeemModal(false) }}
          >
            <div className="modal-content card w-full max-w-sm dark:bg-gray-900">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                <Gift className="h-5 w-5 text-pulse-900 dark:text-pulse-300" /> Puan Kullan
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Mevcut bakiye: <span className="font-semibold text-gray-700 dark:text-gray-300">{customerLoyalty.points_balance.toLocaleString('tr-TR')} puan</span>
              </p>
              <div className="space-y-3">
                <div>
                  <label className="label label-required">Harcanacak Puan</label>
                  <input
                    type="number"
                    min={1}
                    max={customerLoyalty.points_balance}
                    value={redeemPoints}
                    onChange={e => setRedeemPoints(e.target.value)}
                    className="input"
                    placeholder={`Maks: ${customerLoyalty.points_balance}`}
                    autoFocus
                  />
                  {redeemPoints && Number(redeemPoints) > 0 && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                      ≈ {(Number(redeemPoints) / loyaltyRedemptionRate).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}₺ indirim değeri
                      <span className="text-gray-400 dark:text-gray-500 ml-1">({loyaltyRedemptionRate} puan = 1₺)</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="label">Açıklama (opsiyonel)</label>
                  <input
                    type="text"
                    value={redeemDesc}
                    onChange={e => setRedeemDesc(e.target.value)}
                    className="input"
                    placeholder="Ör: Randevu indirimi, Hediye ürün..."
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowRedeemModal(false); setRedeemPoints(''); setRedeemDesc('') }}
                  className="btn-secondary flex-1"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleRedeemPoints}
                  disabled={redeemSaving || !redeemPoints || Number(redeemPoints) <= 0 || Number(redeemPoints) > customerLoyalty.points_balance}
                  className="btn-primary flex-1"
                >
                  {redeemSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Onayla
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
