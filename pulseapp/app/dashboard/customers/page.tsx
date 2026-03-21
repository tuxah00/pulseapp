'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useViewMode } from '@/lib/hooks/use-view-mode'
import {
  Plus, Search, Loader2, Phone, Mail, Calendar,
  X, Pencil, Trash2, User, LayoutList, LayoutGrid,
} from 'lucide-react'
import { formatPhone, formatDate, formatCurrency, getSegmentColor, cn } from '@/lib/utils'
import { SEGMENT_LABELS, type Customer, type CustomerSegment } from '@/types'
import { logAudit } from '@/lib/utils/audit'

import { getCustomerLabel } from '@/lib/config/sector-modules'

export default function CustomersPage() {
  const { businessId, staffId, staffName, loading: ctxLoading, sector } = useBusinessContext()
  const customerLabel = sector ? getCustomerLabel(sector) : 'Müşteriler'
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSegment, setFilterSegment] = useState<CustomerSegment | 'all'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useViewMode('customers', 'list')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [birthday, setBirthday] = useState('')
  const [notes, setNotes] = useState('')

  const supabase = createClient()

  const fetchCustomers = useCallback(async () => {
    if (!businessId) return
    let query = supabase
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (filterSegment !== 'all') query = query.eq('segment', filterSegment)
    if (search.trim()) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)

    const { data, error } = await query
    if (data) setCustomers(data)
    if (error) console.error('Müşteri çekme hatası:', error)
    setLoading(false)
  }, [businessId, filterSegment, search])

  useEffect(() => { if (!ctxLoading) fetchCustomers() }, [fetchCustomers, ctxLoading])

  function openNewModal() {
    setEditingCustomer(null)
    setName(''); setPhone(''); setEmail(''); setBirthday(''); setNotes('')
    setError(null); setShowModal(true)
  }

  function openEditModal(customer: Customer) {
    setEditingCustomer(customer)
    setName(customer.name); setPhone(customer.phone)
    setEmail(customer.email || ''); setBirthday(customer.birthday || '')
    setNotes(customer.notes || ''); setError(null); setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null)
    const customerData = {
      name, phone: phone.replace(/\s/g, ''),
      email: email || null, birthday: birthday || null, notes: notes || null,
      business_id: businessId,
    }
    if (editingCustomer) {
      const { error } = await supabase.from('customers').update({
        name, phone: phone.replace(/\s/g, ''),
        email: email || null, birthday: birthday || null, notes: notes || null,
      }).eq('id', editingCustomer.id)
      if (error) { setError(error.message.includes('idx_customers_business_phone') ? 'Bu telefon numarası zaten kayıtlı.' : error.message); setSaving(false); return }
      setSelectedCustomer(prev => prev?.id === editingCustomer.id ? { ...prev, name, phone: phone.replace(/\s/g, ''), email: email || null, birthday: birthday || null, notes: notes || null } as Customer : prev)
    } else {
      const { error } = await supabase.from('customers').insert(customerData)
      if (error) { setError(error.message.includes('idx_customers_business_phone') ? 'Bu telefon numarası zaten kayıtlı.' : error.message); setSaving(false); return }
    }
    setSaving(false); setShowModal(false)
    await fetchCustomers()
    await logAudit({
      businessId: businessId!,
      staffId,
      staffName,
      action: editingCustomer ? 'update' : 'create',
      resource: 'customer',
      resourceId: editingCustomer?.id,
      details: { name },
    })
  }

  async function handleDelete(customer: Customer) {
    if (!confirm(`"${customer.name}" müşterisini silmek istediğinize emin misiniz?`)) return
    await supabase.from('customers').update({ is_active: false }).eq('id', customer.id)
    if (selectedCustomer?.id === customer.id) setSelectedCustomer(null)
    await fetchCustomers()
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

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-pulse-500" /></div>
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{customerLabel}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{customers.length} {customerLabel.toLowerCase()} kayıtlı</p>
        </div>
        <button onClick={openNewModal} className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />Yeni {customerLabel.endsWith('lar') || customerLabel.endsWith('ler') ? customerLabel.slice(0, -3) : customerLabel}
        </button>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" placeholder="İsim veya telefon ara..." />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterSegment('all')} className={cn('badge px-3 py-1.5 cursor-pointer transition-colors', filterSegment === 'all' ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600')}>Tümü</button>
          {(['new', 'regular', 'vip', 'risk', 'lost'] as CustomerSegment[]).map((seg) => (
            <button key={seg} onClick={() => setFilterSegment(seg)} className={cn('badge px-3 py-1.5 cursor-pointer transition-colors', filterSegment === seg ? getSegmentColor(seg) + ' ring-2 ring-offset-1' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600')}>
              {SEGMENT_LABELS[seg]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setViewMode('list')} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', viewMode === 'list' ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700')} title="Liste"><LayoutList className="h-4 w-4" /></button>
          <button onClick={() => setViewMode('box')} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', viewMode === 'box' ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700')} title="Kutular"><LayoutGrid className="h-4 w-4" /></button>
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16">
          <User className="mb-4 h-12 w-12 text-gray-300" />
          <p className="text-gray-500 mb-4">{search ? 'Aramanızla eşleşen müşteri bulunamadı' : 'Henüz müşteri eklenmemiş'}</p>
          {!search && <button onClick={openNewModal} className="btn-primary"><Plus className="mr-2 h-4 w-4" />İlk Müşteriyi Ekle</button>}
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-2">
          {customers.map((customer) => (
            <div key={customer.id} onClick={() => setSelectedCustomer(customer)} className={cn('card flex items-center gap-4 p-4 cursor-pointer transition-all hover:shadow-md', selectedCustomer?.id === customer.id && 'ring-2 ring-pulse-500')}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pulse-100 text-pulse-700 font-semibold text-sm flex-shrink-0">
                {customer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{customer.name}</span>
                  <span className={`badge ${getSegmentColor(customer.segment)}`}>{SEGMENT_LABELS[customer.segment]}</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{formatPhone(customer.phone)}</p>
              </div>
              <div className="text-right text-sm flex-shrink-0 hidden sm:block">
                <p className="text-gray-900 dark:text-gray-100 font-medium">{customer.total_visits} ziyaret</p>
                <p className="text-gray-400">{customer.last_visit_at ? formatDate(customer.last_visit_at) : 'Henüz yok'}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {customers.map((customer) => (
            <div key={customer.id} onClick={() => setSelectedCustomer(customer)} className={cn('card flex aspect-square flex-col justify-between p-4 cursor-pointer transition-all hover:shadow-md', selectedCustomer?.id === customer.id && 'ring-2 ring-pulse-500')}>
              <div className="flex flex-col items-center gap-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pulse-100 text-pulse-700 font-semibold text-sm">
                  {customer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <span className={`badge ${getSegmentColor(customer.segment)}`}>{SEGMENT_LABELS[customer.segment]}</span>
              </div>
              <div className="mt-2 space-y-0.5 text-center text-sm">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{customer.name}</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs">{formatPhone(customer.phone)}</p>
                <p className="text-gray-400 text-xs">{customer.total_visits} ziyaret · {customer.last_visit_at ? formatDate(customer.last_visit_at) : '—'}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Müşteri Detay Slide-Over Paneli ── */}
      {selectedCustomer && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 dark:bg-black/50" onClick={() => setSelectedCustomer(null)} />
          <div className="slide-panel border-l border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Müşteri Detayı</h3>
              <button onClick={() => setSelectedCustomer(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Avatar + isim */}
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-pulse-100 text-pulse-700 font-bold text-lg">
                  {selectedCustomer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedCustomer.name}</h4>
                <span className={`badge mt-1 ${getSegmentColor(selectedCustomer.segment)}`}>{SEGMENT_LABELS[selectedCustomer.segment]}</span>
              </div>

              {/* İletişim */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <a href={`tel:${selectedCustomer.phone}`} className="text-pulse-600 hover:underline">{formatPhone(selectedCustomer.phone)}</a>
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

              {selectedCustomer.notes && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notlar</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">{selectedCustomer.notes}</p>
                </div>
              )}

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex gap-2">
                <button onClick={() => { openEditModal(selectedCustomer); setSelectedCustomer(null) }} className="btn-secondary flex-1 text-sm">
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />Düzenle
                </button>
                <button onClick={() => handleDelete(selectedCustomer)} className="btn-danger flex-1 text-sm">
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />Sil
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {editingCustomer ? 'Müşteriyi Düzenle' : 'Yeni Müşteri Ekle'}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div><label htmlFor="custName" className="label">Ad Soyad</label><input id="custName" type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Ayşe Yılmaz" required autoFocus /></div>
              <div><label htmlFor="custPhone" className="label">Telefon</label><input id="custPhone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="0532 123 45 67" required /></div>
              <div><label htmlFor="custEmail" className="label">E-posta (opsiyonel)</label><input id="custEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="ayse@email.com" /></div>
              <div><label htmlFor="custBday" className="label">Doğum Tarihi (opsiyonel)</label><input id="custBday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className="input" /></div>
              <div><label htmlFor="custNotes" className="label">Notlar (opsiyonel)</label><textarea id="custNotes" value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={3} placeholder="Tercihler, alerjiler, vb." /></div>
              {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">İptal</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingCustomer ? 'Güncelle' : 'Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
