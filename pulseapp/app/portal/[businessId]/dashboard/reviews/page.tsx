'use client'

import { useEffect, useState, useCallback } from 'react'
import { Star, MessageSquare, Clock, Loader2, PenSquare, CheckCircle2, Users, User as UserIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ReviewFormModal, type PendingAppointmentForReview } from '../_components/review-form-modal'
import { SectionHeader } from '../_components/section-header'

interface PortalReview {
  id: string
  rating: number
  comment: string | null
  status: 'pending' | 'responded' | 'escalated'
  created_at: string
  appointment_id: string | null
  actual_response: string | null
  is_anonymous?: boolean
}

interface BusinessReview {
  id: string
  rating: number
  comment: string | null
  created_at: string
  author_name: string
  is_mine: boolean
}

type TabId = 'my' | 'business'

const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: 'Beklemede',
  responded: 'Yanıtlandı',
  escalated: 'İnceleniyor',
}

const REVIEW_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  responded: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  escalated: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
}

function first<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  if (Array.isArray(v)) return v[0] || null
  return v
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return iso
  }
}

function StarRow({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'h-5 w-5' : 'h-4 w-4'
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            cls,
            n <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600'
          )}
        />
      ))}
    </div>
  )
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?'
}

export default function PortalReviewsPage() {
  const [tab, setTab] = useState<TabId>('my')

  // "Benim" tab verileri
  const [reviews, setReviews] = useState<PortalReview[]>([])
  const [pending, setPending] = useState<PendingAppointmentForReview[]>([])
  const [loadingMy, setLoadingMy] = useState(true)

  // "İşletme" tab verileri
  const [businessReviews, setBusinessReviews] = useState<BusinessReview[]>([])
  const [loadingBiz, setLoadingBiz] = useState(false)

  const [modalAppt, setModalAppt] = useState<PendingAppointmentForReview | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const loadMy = useCallback(async () => {
    setLoadingMy(true)
    const res = await fetch('/api/portal/reviews?tab=my')
    if (res.ok) {
      const data = await res.json()
      setReviews(data.reviews || [])
      setPending(data.pendingAppointments || [])
    }
    setLoadingMy(false)
  }, [])

  const loadBusiness = useCallback(async () => {
    setLoadingBiz(true)
    const res = await fetch('/api/portal/reviews?tab=business')
    if (res.ok) {
      const data = await res.json()
      setBusinessReviews(data.reviews || [])
    }
    setLoadingBiz(false)
  }, [])

  useEffect(() => {
    loadMy()
  }, [loadMy])

  useEffect(() => {
    if (tab === 'business' && businessReviews.length === 0 && !loadingBiz) {
      loadBusiness()
    }
  }, [tab, loadBusiness, businessReviews.length, loadingBiz])

  function openModal(apt: PendingAppointmentForReview | null) {
    setModalAppt(apt)
    setModalOpen(true)
  }

  const myCount = reviews.length
  const bizCount = businessReviews.length

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Yorumlar</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Deneyimini paylaş — hem bize hem de diğer müşterilere yol gösterir.
        </p>
      </div>

      {/* Segmented tab */}
      <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
        <button
          onClick={() => setTab('my')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            tab === 'my'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          )}
        >
          <UserIcon className="h-4 w-4" />
          Benim Yazdıklarım
          {myCount > 0 && (
            <span className={cn(
              'ml-1 px-1.5 py-0.5 rounded-full text-[10px]',
              tab === 'my' ? 'bg-pulse-900 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            )}>{myCount}</span>
          )}
        </button>
        <button
          onClick={() => setTab('business')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            tab === 'business'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          )}
        >
          <Users className="h-4 w-4" />
          İşletme Yorumları
          {bizCount > 0 && (
            <span className={cn(
              'ml-1 px-1.5 py-0.5 rounded-full text-[10px]',
              tab === 'business' ? 'bg-pulse-900 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            )}>{bizCount}</span>
          )}
        </button>
      </div>

      {tab === 'my' ? (
        loadingMy ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Yorum Bekleyen Randevular */}
            {pending.length > 0 && (
              <section>
                <SectionHeader
                  title="Yorum Bekleyen Randevular"
                  subtitle="Son randevularını değerlendir, bir dakikadan az sürer."
                  icon={Clock}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  {pending.map((apt) => {
                    const service = first(apt.services)
                    const staff = first(apt.staff_members)
                    return (
                      <div
                        key={apt.id}
                        className="bg-gradient-to-br from-pulse-50 to-indigo-50 dark:from-pulse-900/20 dark:to-indigo-900/20 border border-pulse-100 dark:border-pulse-900/40 rounded-2xl p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {service?.name || 'Hizmet'}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {formatDate(apt.appointment_date)} · {apt.start_time?.slice(0, 5)}
                            </p>
                            {staff?.name && (
                              <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">{staff.name}</p>
                            )}
                          </div>
                          <div className="h-10 w-10 rounded-xl bg-white/80 dark:bg-gray-900/60 flex items-center justify-center flex-shrink-0 backdrop-blur">
                            <Star className="h-5 w-5 text-amber-400" />
                          </div>
                        </div>
                        <button
                          onClick={() => openModal(apt)}
                          className="w-full mt-4 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-pulse-900 hover:bg-pulse-800 text-white text-sm font-medium transition-colors"
                        >
                          <PenSquare className="h-4 w-4" />
                          Yorum Yaz
                        </button>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Geçmiş Yorumlar */}
            <section>
              <SectionHeader
                title="Geçmiş Yorumların"
                subtitle={reviews.length > 0 ? `Toplam ${reviews.length} yorum` : undefined}
                icon={MessageSquare}
                action={
                  <button
                    onClick={() => openModal(null)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-pulse-900 dark:hover:border-pulse-300 hover:text-pulse-900 dark:hover:text-pulse-300 transition-colors"
                  >
                    <PenSquare className="h-3.5 w-3.5" />
                    Yeni
                  </button>
                }
              />
              {reviews.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 text-center">
                  <MessageSquare className="h-10 w-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Henüz bir yorum yapmadın.
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Randevuların tamamlandıkça burada deneyimini paylaşabilirsin.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map((r) => (
                    <div key={r.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <StarRow rating={r.rating} size="md" />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                            {formatDate(r.created_at)}
                            {r.is_anonymous && (
                              <span className="ml-2 inline-flex items-center gap-1 text-gray-400">
                                · Anonim paylaşıldı
                              </span>
                            )}
                          </p>
                        </div>
                        <span className={cn(
                          'text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap',
                          REVIEW_STATUS_COLORS[r.status] || REVIEW_STATUS_COLORS.pending
                        )}>
                          {REVIEW_STATUS_LABELS[r.status] || r.status}
                        </span>
                      </div>
                      {r.comment && (
                        <p className="mt-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {r.comment}
                        </p>
                      )}
                      {r.actual_response && (
                        <div className="mt-3 bg-pulse-900/5 dark:bg-pulse-900/20 border-l-2 border-pulse-900 dark:border-pulse-300 rounded-r-lg p-3">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-pulse-900 dark:text-pulse-300 uppercase tracking-wide">
                            <CheckCircle2 className="h-3 w-3" />
                            İşletme yanıtı
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                            {r.actual_response}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )
      ) : (
        // İşletme Yorumları tab
        loadingBiz ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : businessReviews.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 text-center">
            <Users className="h-10 w-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Henüz yayınlanmış yorum yok.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              İşletme tarafından onaylanan yorumlar burada listelenir.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {businessReviews.map((r) => (
              <div key={r.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-sm',
                    r.author_name === 'Anonim'
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      : 'bg-gradient-to-br from-pulse-700 to-indigo-600 text-white'
                  )}>
                    {r.author_name === 'Anonim' ? '?' : initials(r.author_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {r.author_name}
                      </span>
                      {r.is_mine && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-pulse-100 dark:bg-pulse-900/30 text-pulse-900 dark:text-pulse-300">
                          Sen
                        </span>
                      )}
                      <StarRow rating={r.rating} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {formatDate(r.created_at)}
                    </p>
                    {r.comment && (
                      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {r.comment}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      <ReviewFormModal
        open={modalOpen}
        appointment={modalAppt}
        onClose={() => setModalOpen(false)}
        onSubmitted={() => { loadMy(); if (tab === 'business') loadBusiness() }}
      />
    </div>
  )
}
