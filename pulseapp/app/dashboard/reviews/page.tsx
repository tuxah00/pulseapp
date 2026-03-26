'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import {
  Star, Loader2, MessageSquare, AlertTriangle,
  ExternalLink, Send, Filter, TrendingUp, Sparkles,
} from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'
import type { Review } from '@/types'

export default function ReviewsPage() {
  const { businessId, loading: ctxLoading, permissions } = useBusinessContext()
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterRating, setFilterRating] = useState<number | null>(null)
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [responseText, setResponseText] = useState('')
  const [saving, setSaving] = useState(false)
  const [aiDraftLoading, setAiDraftLoading] = useState<string | null>(null)

  // Yeni yorum ekleme
  const [showAddModal, setShowAddModal] = useState(false)
  const [newRating, setNewRating] = useState(5)
  const [newComment, setNewComment] = useState('')
  const [newCustomerId, setNewCustomerId] = useState('')
  const [customers, setCustomers] = useState<any[]>([])

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

  const fetchCustomers = useCallback(async () => {
    if (!businessId) return
    const { data } = await supabase
      .from('customers')
      .select('id, name, phone')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name')
    if (data) setCustomers(data)
  }, [businessId])

  useEffect(() => { if (!ctxLoading) fetchReviews() }, [fetchReviews, ctxLoading])
  useEffect(() => { if (!ctxLoading) fetchCustomers() }, [fetchCustomers, ctxLoading])

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
  }

  async function handleAddReview(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('reviews').insert({
      business_id: businessId,
      customer_id: newCustomerId || null,
      rating: newRating,
      comment: newComment || null,
      status: newRating <= 3 ? 'escalated' : 'pending',
    })
    setSaving(false)
    setShowAddModal(false)
    setNewRating(5)
    setNewComment('')
    setNewCustomerId('')
    fetchReviews()
  }

  async function handleAiDraft(review: any) {
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

  if (permissions && !permissions.reviews) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">İşletme sahibinizle iletişime geçin.</p>
        </div>
      </div>
    )
  }

  if (loading || ctxLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-pulse-500" /></div>
  }

  return (
    <div>
      {/* Başlık */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Yorumlar</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{totalReviews} yorum · Ortalama {avgRating} ★</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          <Star className="mr-2 h-4 w-4" />Yorum Ekle
        </button>
      </div>

      {/* İstatistik Kartları */}
      <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{avgRating}</p>
          <div className="flex justify-center mt-1">{renderStars(Math.round(Number(avgRating)))}</div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ortalama Puan</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{totalReviews}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Toplam Yorum</p>
        </div>
        <div className="card p-4 text-center">
          <p className={cn('text-3xl font-bold', pendingCount > 0 ? 'text-amber-600' : 'text-green-600')}>{pendingCount}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Yanıt Bekleyen</p>
        </div>
        <div className="card p-4 text-center">
          <p className={cn('text-3xl font-bold', lowCount > 0 ? 'text-red-600' : 'text-green-600')}>{lowCount}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Düşük Puan (≤3)</p>
        </div>
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
              <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
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
          <button onClick={() => setFilterRating(null)} className="mt-2 text-sm text-pulse-600 hover:text-pulse-700">
            Filtreyi kaldır ×
          </button>
        )}
      </div>

      {/* Yorum Listesi */}
      {reviews.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16">
          <Star className="mb-4 h-12 w-12 text-gray-300" />
          <p className="text-gray-500 mb-4">{filterRating ? `${filterRating} yıldız yorum bulunamadı` : 'Henüz yorum yok'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className={cn('card p-4', review.rating <= 3 && review.status !== 'responded' && 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/20')}>
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full font-semibold text-sm flex-shrink-0',
                  review.rating >= 4 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : review.rating === 3 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                )}>
                  {review.customers?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                </div>

                {/* İçerik */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{review.customers?.name || 'Anonim'}</span>
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
                        onClick={() => { setResponseText(review.ai_response_draft); setRespondingTo(review.id) }}
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
                          className="text-sm text-pulse-600 hover:text-pulse-700 flex items-center gap-1"
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

      {/* Yorum Ekleme Modal */}
      {showAddModal && (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="modal-content card w-full max-w-md dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Yorum Ekle</h2>
            <form onSubmit={handleAddReview} className="space-y-4">
              <div>
                <label className="label">Müşteri (opsiyonel)</label>
                <select value={newCustomerId} onChange={(e) => setNewCustomerId(e.target.value)} className="input">
                  <option value="">Müşteri seçin...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Puan</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(r => (
                    <button key={r} type="button" onClick={() => setNewRating(r)}
                      className={cn('flex h-10 w-10 items-center justify-center rounded-lg text-lg transition-colors',
                        r <= newRating ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                      )}>
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Yorum (opsiyonel)</label>
                <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} className="input" rows={3} placeholder="Müşterinin yorumu..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">İptal</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
