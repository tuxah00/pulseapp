'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { requirePermission, requireSectorModule } from '@/lib/hooks/use-require-permission'
import { getCustomerLabelSingular } from '@/lib/config/sector-modules'
import {
  Star, Loader2, MessageSquare, AlertTriangle,
  ExternalLink, Send, TrendingUp, Sparkles, Search,
  MessageSquarePlus, Lightbulb, Heart, HelpCircle, Inbox, CheckCircle2,
} from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'
import { CustomSelect } from '@/components/ui/custom-select'
import type { Review } from '@/types'
import EmptyState from '@/components/ui/empty-state'

type ReviewWithJoin = Review & {
  customers?: { name: string; phone: string | null } | null
}

type FeedbackType = 'suggestion' | 'complaint' | 'praise' | 'question'
type FeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

interface FeedbackItem {
  id: string
  business_id: string
  customer_id: string | null
  customer_name: string | null
  customer_phone: string | null
  type: FeedbackType
  subject: string | null
  message: string
  status: FeedbackStatus
  response: string | null
  responded_at: string | null
  responded_by_staff_id: string | null
  source: 'portal' | 'staff_manual'
  created_at: string
  updated_at: string
}

const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  suggestion: 'Öneri',
  complaint: 'Şikayet',
  praise: 'Teşekkür',
  question: 'Soru',
}

const FEEDBACK_TYPE_ICONS: Record<FeedbackType, typeof Lightbulb> = {
  suggestion: Lightbulb,
  complaint: AlertTriangle,
  praise: Heart,
  question: HelpCircle,
}

const FEEDBACK_TYPE_COLORS: Record<FeedbackType, string> = {
  suggestion: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  complaint: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  praise: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  question: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
}

const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: 'Açık',
  in_progress: 'İşlemde',
  resolved: 'Çözüldü',
  closed: 'Kapalı',
}

const FEEDBACK_STATUS_COLORS: Record<FeedbackStatus, string> = {
  open: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  closed: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
}

const FEEDBACK_STATUS_OPTIONS: { value: FeedbackStatus; label: string }[] = [
  { value: 'open', label: 'Açık' },
  { value: 'in_progress', label: 'İşlemde' },
  { value: 'resolved', label: 'Çözüldü' },
  { value: 'closed', label: 'Kapalı' },
]

const FEEDBACK_TYPE_FILTER_OPTIONS: { value: FeedbackType | 'all'; label: string }[] = [
  { value: 'all', label: 'Tüm Tipler' },
  { value: 'suggestion', label: 'Öneri' },
  { value: 'complaint', label: 'Şikayet' },
  { value: 'praise', label: 'Teşekkür' },
  { value: 'question', label: 'Soru' },
]

type TabId = 'reviews' | 'feedback'
type FeedbackStatFilter = 'open' | 'complaint' | 'praise' | null

export default function ReviewsPage() {
  const { businessId, sector, loading: ctxLoading, permissions } = useBusinessContext()
  const [tab, setTab] = useState<TabId>('reviews')
  const [reviews, setReviews] = useState<ReviewWithJoin[]>([])
  const [loading, setLoading] = useState(true)
  const [filterRating, setFilterRating] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [statFilter, setStatFilter] = useState<'pending' | 'low' | null>(null)
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [responseText, setResponseText] = useState('')
  const [saving, setSaving] = useState(false)
  const [aiDraftLoading, setAiDraftLoading] = useState<string | null>(null)

  // Geri bildirim sekmesi state'leri
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [fbLoading, setFbLoading] = useState(false)
  const [fbLoaded, setFbLoaded] = useState(false)
  const [fbSearch, setFbSearch] = useState('')
  const [fbTypeFilter, setFbTypeFilter] = useState<FeedbackType | 'all'>('all')
  const [fbStatFilter, setFbStatFilter] = useState<FeedbackStatFilter>(null)
  const [fbRespondingTo, setFbRespondingTo] = useState<string | null>(null)
  const [fbResponseText, setFbResponseText] = useState('')
  const [fbSaving, setFbSaving] = useState(false)
  const [fbStatusSavingId, setFbStatusSavingId] = useState<string | null>(null)

  const supabase = createClient()

  const fetchReviews = useCallback(async () => {
    if (!businessId) return
    let query = supabase
      .from('reviews')
      .select('*, customers(name, phone)')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })

    if (filterRating) {
      query = query.eq('rating', filterRating)
    }

    const { data } = await query
    if (data) setReviews(data)
    setLoading(false)
  }, [businessId, filterRating])

  useEffect(() => { if (!ctxLoading) fetchReviews() }, [fetchReviews, ctxLoading])

  const fetchFeedback = useCallback(async () => {
    if (!businessId) return
    setFbLoading(true)
    try {
      const res = await fetch(`/api/feedback?businessId=${businessId}`)
      if (res.ok) {
        const data = await res.json()
        setFeedback(data.feedback || [])
      }
    } finally {
      setFbLoading(false)
      setFbLoaded(true)
    }
  }, [businessId])

  useEffect(() => {
    if (!ctxLoading && tab === 'feedback' && !fbLoaded && !fbLoading) {
      fetchFeedback()
    }
  }, [ctxLoading, tab, fbLoaded, fbLoading, fetchFeedback])

  // İstatistikler
  const totalReviews = reviews.length
  const avgRating = totalReviews > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
    : '—'
  const ratingDist = [5, 4, 3, 2, 1].map(r => ({
    rating: r,
    count: reviews.filter(rev => rev.rating === r).length,
    pct: totalReviews > 0 ? Math.round((reviews.filter(rev => rev.rating === r).length / totalReviews) * 100) : 0,
  }))
  const lowCount = reviews.filter(r => r.rating <= 3).length
  const pendingCount = reviews.filter(r => r.status === 'pending' || r.status === 'escalated').length

  async function handleRespond(reviewId: string) {
    setSaving(true)
    await supabase
      .from('reviews')
      .update({ actual_response: responseText, status: 'responded' })
      .eq('id', reviewId)
    setSaving(false)
    setRespondingTo(null)
    setResponseText('')
    fetchReviews()
    window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Yanıt kaydedildi' } }))
  }

  async function handleAiDraft(review: ReviewWithJoin) {
    setAiDraftLoading(review.id)
    try {
      const res = await fetch('/api/ai/review-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId: review.id,
          businessId,
          rating: review.rating,
          comment: review.comment,
          customerName: review.customers?.name,
        }),
      })
      const data = await res.json()
      if (data.draft) {
        setResponseText(data.draft)
        setRespondingTo(review.id)
      }
    } catch (err) {
      console.error('AI taslak hatası:', err)
    }
    setAiDraftLoading(null)
  }

  // === Geri Bildirim istatistikleri ===
  const fbTotal = feedback.length
  const fbOpenCount = feedback.filter(f => f.status === 'open' || f.status === 'in_progress').length
  const fbComplaintCount = feedback.filter(f => f.type === 'complaint').length
  const fbPraiseCount = feedback.filter(f => f.type === 'praise').length

  const filteredFeedback = feedback.filter(f => {
    if (fbStatFilter === 'open' && !(f.status === 'open' || f.status === 'in_progress')) return false
    if (fbStatFilter === 'complaint' && f.type !== 'complaint') return false
    if (fbStatFilter === 'praise' && f.type !== 'praise') return false
    if (fbTypeFilter !== 'all' && f.type !== fbTypeFilter) return false
    if (!fbSearch.trim()) return true
    const q = fbSearch.toLowerCase()
    return (
      (f.customer_name?.toLowerCase().includes(q) ?? false) ||
      (f.subject?.toLowerCase().includes(q) ?? false) ||
      f.message.toLowerCase().includes(q)
    )
  })

  async function handleFeedbackRespond(id: string) {
    if (!businessId || !fbResponseText.trim()) return
    setFbSaving(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, id, response: fbResponseText, status: 'resolved' }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: body.error || 'Yanıt gönderilemedi' } }))
        return
      }
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Yanıt gönderildi' } }))
      setFbRespondingTo(null)
      setFbResponseText('')
      await fetchFeedback()
    } catch {
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Bağlantı hatası' } }))
    } finally {
      setFbSaving(false)
    }
  }

  async function handleFeedbackStatusChange(id: string, newStatus: FeedbackStatus) {
    if (!businessId) return
    setFbStatusSavingId(id)
    try {
      const res = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, id, status: newStatus }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: body.error || 'Durum güncellenemedi' } }))
        return
      }
      setFeedback(prev => prev.map(f => f.id === id ? { ...f, status: newStatus } : f))
    } catch {
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Bağlantı hatası' } }))
    } finally {
      setFbStatusSavingId(null)
    }
  }

  function fbInitials(name: string | null): string {
    if (!name) return '?'
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'
  }

  function renderStars(rating: number, size: 'sm' | 'lg' = 'sm') {
    const sizeClass = size === 'lg' ? 'h-6 w-6' : 'h-4 w-4'
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star key={i} className={cn(sizeClass, i <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200')} />
        ))}
      </div>
    )
  }

  const filteredReviews = reviews.filter(r => {
    if (statFilter === 'pending' && r.status === 'responded') return false
    if (statFilter === 'low' && r.rating > 3) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      r.customers?.name?.toLowerCase().includes(q) ||
      r.comment?.toLowerCase().includes(q)
    )
  })

  requireSectorModule(sector, 'reviews')
  requirePermission(permissions, 'reviews')

  if (loading || ctxLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-pulse-900" /></div>
  }

  return (
    <div>
      {/* Başlık */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Yorumlar</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {tab === 'reviews'
              ? `${totalReviews} yorum · Ortalama ${avgRating} ★`
              : `${fbTotal} geri bildirim · ${fbOpenCount} açık`}
          </p>
        </div>
      </div>

      {/* Segmented tab */}
      <div className="mb-6 inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 max-w-full overflow-x-auto">
        <button
          onClick={() => setTab('reviews')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
            tab === 'reviews'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          )}
        >
          <Star className="h-4 w-4" />
          Yorumlar
          {totalReviews > 0 && (
            <span className={cn(
              'ml-1 px-1.5 py-0.5 rounded-full text-[10px]',
              tab === 'reviews' ? 'bg-pulse-900 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            )}>{totalReviews}</span>
          )}
        </button>
        <button
          onClick={() => setTab('feedback')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
            tab === 'feedback'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          )}
        >
          <MessageSquarePlus className="h-4 w-4" />
          Geri Bildirimler
          {fbOpenCount > 0 && (
            <span className={cn(
              'ml-1 px-1.5 py-0.5 rounded-full text-[10px]',
              tab === 'feedback' ? 'bg-pulse-900 text-white' : 'bg-amber-500 text-white'
            )}>{fbOpenCount}</span>
          )}
        </button>
      </div>

      {tab === 'reviews' && (
      <>
      {/* İstatistik Kartları */}
      <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{avgRating}</p>
          <div className="flex justify-center mt-1">{renderStars(Math.round(Number(avgRating)))}</div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ortalama Puan</p>
        </div>
        <button onClick={() => setStatFilter(null)} className={cn('card p-4 text-center transition-all hover:shadow-md', statFilter === null && 'ring-2 ring-gray-400')}>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{totalReviews}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Toplam Yorum</p>
        </button>
        <button onClick={() => setStatFilter(statFilter === 'pending' ? null : 'pending')} className={cn('card p-4 text-center transition-all hover:shadow-md', statFilter === 'pending' && 'ring-2 ring-amber-500')}>
          <p className={cn('text-3xl font-bold', pendingCount > 0 ? 'text-amber-600' : 'text-green-600')}>{pendingCount}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Yanıt Bekleyen</p>
        </button>
        <button onClick={() => setStatFilter(statFilter === 'low' ? null : 'low')} className={cn('card p-4 text-center transition-all hover:shadow-md', statFilter === 'low' && 'ring-2 ring-red-500')}>
          <p className={cn('text-3xl font-bold', lowCount > 0 ? 'text-red-600' : 'text-green-600')}>{lowCount}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Düşük Puan (≤3)</p>
        </button>
      </div>

      {/* Arama */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} className="input pl-10" placeholder={`${getCustomerLabelSingular(sector ?? undefined)} adı veya yorum ara...`} />
      </div>

      {/* Puan Dağılımı */}
      <div className="card p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Puan Dağılımı</h3>
        <div className="space-y-2">
          {ratingDist.map(({ rating, count, pct }) => (
            <button
              key={rating}
              onClick={() => setFilterRating(filterRating === rating ? null : rating)}
              className={cn('flex items-center gap-3 w-full text-left rounded-lg p-1.5 transition-colors',
                filterRating === rating ? 'bg-amber-50 dark:bg-amber-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
              )}
            >
              <span className="text-sm font-medium w-8">{rating} ★</span>
              <div className="flex-1 h-4 bg-gray-200 dark:bg-white/15 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all',
                    rating >= 4 ? 'bg-green-500 dark:bg-green-400' : rating === 3 ? 'bg-amber-500 dark:bg-amber-400' : 'bg-red-500 dark:bg-red-400'
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-sm text-gray-500 w-16 text-right">{count} ({pct}%)</span>
            </button>
          ))}
        </div>
        {filterRating && (
          <button onClick={() => setFilterRating(null)} className="mt-2 text-sm text-pulse-900 hover:text-pulse-900">
            Filtreyi kaldır ×
          </button>
        )}
      </div>

      {/* Yorum Listesi */}
      {filteredReviews.length === 0 ? (
        <EmptyState
          icon={<Star className="h-7 w-7" />}
          title={search ? 'Aramanızla eşleşen yorum bulunamadı' : statFilter === 'pending' ? 'Yanıt bekleyen yorum yok' : statFilter === 'low' ? 'Düşük puanlı yorum yok' : filterRating ? `${filterRating} yıldız yorum bulunamadı` : 'Henüz yorum yok'}
        />
      ) : (
        <div className="space-y-3">
          {filteredReviews.map((review) => (
            <div key={review.id} className={cn('card p-4', review.rating <= 3 && review.status !== 'responded' && 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/20')}>
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full font-semibold text-sm flex-shrink-0',
                  review.rating >= 4 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : review.rating === 3 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                )}>
                  {review.is_anonymous
                    ? 'A'
                    : (review.customers?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '?')}
                </div>

                {/* İçerik */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {review.is_anonymous ? 'Anonim' : (review.customers?.name || 'Anonim')}
                    </span>
                    {renderStars(review.rating)}
                    {review.rating <= 3 && review.status !== 'responded' && (
                      <span className="badge bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"><AlertTriangle className="h-3 w-3 mr-1" />Dikkat</span>
                    )}
                    {review.status === 'responded' && (
                      <span className="badge bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Yanıtlandı</span>
                    )}
                  </div>

                  {review.comment && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{review.comment}</p>
                  )}

                  <p className="text-xs text-gray-400">{formatDate(review.created_at)}</p>

                  {/* Mevcut yanıt */}
                  {review.actual_response && (
                    <div className="mt-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Yanıtınız:</p>
                      <p className="text-sm text-blue-800 dark:text-blue-200">{review.actual_response}</p>
                    </div>
                  )}

                  {/* AI taslak */}
                  {review.ai_response_draft && !review.actual_response && respondingTo !== review.id && (
                    <div className="mt-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                        <p className="text-xs font-medium text-purple-700 dark:text-purple-300">AI Yanıt Taslağı</p>
                      </div>
                      <p className="text-sm text-purple-800 dark:text-purple-200">{review.ai_response_draft}</p>
                      <button
                        onClick={() => { setResponseText(review.ai_response_draft ?? ''); setRespondingTo(review.id) }}
                        className="mt-2 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-800/50 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-lg px-3 py-1.5 transition-colors"
                      >
                        Bu taslağı kullan
                      </button>
                    </div>
                  )}

                  {/* Yanıt formu */}
                  {respondingTo === review.id ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        className="input text-sm"
                        placeholder="Yanıtınızı yazın..."
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleRespond(review.id)} disabled={saving || !responseText.trim()} className="btn-primary text-sm px-3">
                          <Send className="h-4 w-4 mr-1.5" />Gönder
                        </button>
                        <button onClick={() => { setRespondingTo(null); setResponseText('') }} className="btn-secondary text-sm px-3">
                          İptal
                        </button>
                      </div>
                    </div>
                  ) : (
                    !review.actual_response && (
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          onClick={() => setRespondingTo(review.id)}
                          className="text-sm text-pulse-900 hover:text-pulse-900 flex items-center gap-1"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />Yanıtla
                        </button>
                        <button
                          onClick={() => handleAiDraft(review)}
                          disabled={aiDraftLoading === review.id}
                          className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                        >
                          {aiDraftLoading === review.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Sparkles className="h-3.5 w-3.5" />
                          }
                          AI Taslak
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}

      {tab === 'feedback' && (
        <>
          {/* İstatistik Kartları */}
          <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => setFbStatFilter(null)}
              className={cn('card p-4 text-center transition-all hover:shadow-md', fbStatFilter === null && 'ring-2 ring-gray-400')}
            >
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{fbTotal}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Toplam</p>
            </button>
            <button
              onClick={() => setFbStatFilter(fbStatFilter === 'open' ? null : 'open')}
              className={cn('card p-4 text-center transition-all hover:shadow-md', fbStatFilter === 'open' && 'ring-2 ring-amber-500')}
            >
              <p className={cn('text-3xl font-bold', fbOpenCount > 0 ? 'text-amber-600' : 'text-green-600')}>{fbOpenCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Açık / İşlemde</p>
            </button>
            <button
              onClick={() => setFbStatFilter(fbStatFilter === 'complaint' ? null : 'complaint')}
              className={cn('card p-4 text-center transition-all hover:shadow-md', fbStatFilter === 'complaint' && 'ring-2 ring-red-500')}
            >
              <p className={cn('text-3xl font-bold', fbComplaintCount > 0 ? 'text-red-600' : 'text-green-600')}>{fbComplaintCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Şikayet</p>
            </button>
            <button
              onClick={() => setFbStatFilter(fbStatFilter === 'praise' ? null : 'praise')}
              className={cn('card p-4 text-center transition-all hover:shadow-md', fbStatFilter === 'praise' && 'ring-2 ring-pink-400')}
            >
              <p className="text-3xl font-bold text-pink-600">{fbPraiseCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Teşekkür</p>
            </button>
          </div>

          {/* Arama + Tip Filtresi */}
          <div className="mb-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={fbSearch}
                onChange={(e) => setFbSearch(e.target.value)}
                className="input pl-10 w-full"
                placeholder="Müşteri adı, konu veya mesaj içinde ara..."
              />
            </div>
            <div className="sm:w-52">
              <CustomSelect
                options={FEEDBACK_TYPE_FILTER_OPTIONS}
                value={fbTypeFilter}
                onChange={(v) => setFbTypeFilter(v as FeedbackType | 'all')}
              />
            </div>
          </div>

          {/* Liste */}
          {fbLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-pulse-900" />
            </div>
          ) : filteredFeedback.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-16">
              <Inbox className="mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
              <p className="text-gray-500 dark:text-gray-400">
                {fbSearch || fbTypeFilter !== 'all' || fbStatFilter
                  ? 'Filtreyle eşleşen geri bildirim bulunamadı'
                  : 'Henüz geri bildirim yok'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFeedback.map((item) => {
                const Icon = FEEDBACK_TYPE_ICONS[item.type]
                const isUrgent = item.type === 'complaint' && (item.status === 'open' || item.status === 'in_progress')
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'card p-4',
                      isUrgent && 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/20'
                    )}
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="flex h-10 w-10 items-center justify-center rounded-full font-semibold text-sm flex-shrink-0 bg-gradient-to-br from-pulse-700 to-indigo-600 text-white">
                        {fbInitials(item.customer_name)}
                      </div>

                      {/* İçerik */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {item.customer_name || 'Anonim'}
                          </span>
                          {item.customer_phone && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">{item.customer_phone}</span>
                          )}
                          <span className={cn(
                            'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full',
                            FEEDBACK_TYPE_COLORS[item.type]
                          )}>
                            <Icon className="h-3 w-3" />
                            {FEEDBACK_TYPE_LABELS[item.type]}
                          </span>
                          {isUrgent && (
                            <span className="badge bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                              <AlertTriangle className="h-3 w-3 mr-1" />Acil
                            </span>
                          )}
                        </div>

                        {item.subject && (
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                            {item.subject}
                          </p>
                        )}

                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 whitespace-pre-wrap">
                          {item.message}
                        </p>

                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="text-xs text-gray-400">{formatDate(item.created_at)}</p>
                          <div className="w-36">
                            <CustomSelect
                              options={FEEDBACK_STATUS_OPTIONS}
                              value={item.status}
                              onChange={(v) => handleFeedbackStatusChange(item.id, v as FeedbackStatus)}
                              disabled={fbStatusSavingId === item.id}
                            />
                          </div>
                          <span className={cn(
                            'text-[11px] font-medium px-2 py-0.5 rounded-full border',
                            FEEDBACK_STATUS_COLORS[item.status]
                          )}>
                            {FEEDBACK_STATUS_LABELS[item.status]}
                          </span>
                        </div>

                        {/* Mevcut Yanıt */}
                        {item.response && (
                          <div className="mt-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3">
                            <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Yanıtınız
                              {item.responded_at && (
                                <span className="text-blue-600/70 dark:text-blue-400/70 font-normal">
                                  · {formatDate(item.responded_at)}
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                              {item.response}
                            </p>
                          </div>
                        )}

                        {/* Yanıt Formu */}
                        {fbRespondingTo === item.id ? (
                          <div className="mt-3 space-y-2">
                            <textarea
                              value={fbResponseText}
                              onChange={(e) => setFbResponseText(e.target.value)}
                              className="input text-sm"
                              placeholder="Yanıtınızı yazın..."
                              rows={3}
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleFeedbackRespond(item.id)}
                                disabled={fbSaving || !fbResponseText.trim()}
                                className="btn-primary text-sm px-3"
                              >
                                <Send className="h-4 w-4 mr-1.5" />Gönder
                              </button>
                              <button
                                onClick={() => { setFbRespondingTo(null); setFbResponseText('') }}
                                className="btn-secondary text-sm px-3"
                              >
                                İptal
                              </button>
                            </div>
                          </div>
                        ) : (
                          !item.response && (
                            <div className="mt-2 flex items-center gap-3">
                              <button
                                onClick={() => { setFbRespondingTo(item.id); setFbResponseText('') }}
                                className="text-sm text-pulse-900 hover:text-pulse-900 flex items-center gap-1"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />Yanıtla
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

    </div>
  )
}
