'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Gift, Coins, Trophy, Loader2, TrendingUp, Megaphone, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RewardCard, type PortalReward } from '../_components/reward-card'
import { SectionHeader } from '../_components/section-header'

interface Loyalty {
  points_balance: number
  tier: 'bronze' | 'silver' | 'gold'
  total_earned: number
  total_spent: number
}

interface PointTx {
  id: string
  type: 'earn' | 'spend' | 'expire' | 'adjust'
  points: number
  source: string
  description: string | null
  created_at: string
}

interface Campaign {
  id: string
  name: string
  description: string | null
  message_template: string | null
  status: string
  scheduled_at: string | null
  created_at: string
}

const TIER_CONFIG: Record<string, { label: string; nextAt: number | null; gradient: string; text: string }> = {
  bronze: { label: 'Bronz', nextAt: 500, gradient: 'from-amber-700 to-orange-600', text: 'Gümüş üyelik için' },
  silver: { label: 'Gümüş', nextAt: 1500, gradient: 'from-slate-400 to-slate-500', text: 'Altın üyelik için' },
  gold: { label: 'Altın', nextAt: null, gradient: 'from-amber-400 to-yellow-500', text: 'Maksimum seviyedesin' },
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

const TX_SOURCE_LABELS: Record<string, string> = {
  appointment: 'Randevu',
  visit_bonus: 'Ziyaret Bonusu',
  campaign: 'Kampanya',
  manual: 'Manuel',
  redemption: 'Kullanım',
}

export default function PortalRewardsPage() {
  const params = useParams()
  const businessId = params.businessId as string

  const [rewards, setRewards] = useState<PortalReward[]>([])
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null)
  const [transactions, setTransactions] = useState<PointTx[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [seenCampaigns, setSeenCampaigns] = useState<Set<string>>(new Set())

  useEffect(() => {
    (async () => {
      try {
        const [rRes, cRes] = await Promise.all([
          fetch('/api/portal/rewards'),
          fetch('/api/portal/campaigns'),
        ])
        if (rRes.ok) {
          const data = await rRes.json()
          setRewards(data.rewards || [])
          setLoyalty(data.loyalty || null)
          setTransactions(data.transactions || [])
        }
        if (cRes.ok) {
          const data = await cRes.json()
          const list: Campaign[] = data.campaigns || []
          setCampaigns(list)
          // localStorage — daha önce görülen kampanya id'leri
          try {
            const storageKey = `portal_seen_campaigns_${businessId}`
            const seenRaw = localStorage.getItem(storageKey)
            const seen: string[] = seenRaw ? JSON.parse(seenRaw) : []
            setSeenCampaigns(new Set(seen))
            const next = Array.from(new Set([...seen, ...list.map(c => c.id)]))
            localStorage.setItem(storageKey, JSON.stringify(next))
          } catch { /* ignore */ }
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const activeRewards = rewards.filter((r) => r.status === 'pending')
  const pastRewards = rewards.filter((r) => r.status !== 'pending')

  const tier = loyalty?.tier || 'bronze'
  const tierInfo = TIER_CONFIG[tier]
  const pointsBalance = loyalty?.points_balance ?? 0
  const progressToNext = tierInfo.nextAt ? Math.min(100, Math.round((pointsBalance / tierInfo.nextAt) * 100)) : 100
  const pointsToNext = tierInfo.nextAt ? Math.max(0, tierInfo.nextAt - pointsBalance) : 0

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Ödüllerim</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Sadakatin karşılıksız kalmasın — puanların, ödüllerin ve sana özel kampanyalar burada.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Sadakat Tier Kartı */}
          <section>
            <div className={cn(
              'relative overflow-hidden rounded-2xl p-6 shadow-xl text-white bg-gradient-to-br',
              tierInfo.gradient
            )}>
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium text-white/80 uppercase tracking-wider">
                    Sadakat Seviyen
                  </p>
                  <h2 className="text-3xl font-bold mt-1 flex items-center gap-2">
                    <Trophy className="h-7 w-7" />
                    {tierInfo.label}
                  </h2>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-medium text-white/80 uppercase tracking-wider">Puan</p>
                  <p className="text-3xl font-bold mt-1">{pointsBalance}</p>
                </div>
              </div>

              {tierInfo.nextAt ? (
                <div className="relative mt-5">
                  <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                    <div
                      className="h-full bg-white transition-all"
                      style={{ width: `${progressToNext}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-white/90">
                    <span>{tierInfo.text} {pointsToNext} puan daha</span>
                    <span>%{progressToNext}</span>
                  </div>
                </div>
              ) : (
                <p className="relative mt-4 text-sm text-white/90">{tierInfo.text} 🏆</p>
              )}

              <div className="relative mt-4 grid grid-cols-2 gap-3">
                <div className="bg-white/10 backdrop-blur rounded-xl p-3">
                  <p className="text-[10px] text-white/80 uppercase tracking-wide">Toplam Kazanç</p>
                  <p className="text-xl font-bold mt-0.5">{loyalty?.total_earned ?? 0}</p>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-3">
                  <p className="text-[10px] text-white/80 uppercase tracking-wide">Harcanan</p>
                  <p className="text-xl font-bold mt-0.5">{loyalty?.total_spent ?? 0}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Aktif Ödüller */}
          {activeRewards.length > 0 && (
            <section>
              <SectionHeader
                title="Kullanıma Hazır Ödüllerin"
                subtitle="Bir sonraki ziyaretinde kullanabilirsin."
                icon={Gift}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {activeRewards.map((r) => (
                  <RewardCard
                    key={r.id}
                    reward={r}
                    onBook={() => { window.location.href = `/book/${businessId}` }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Sana Özel Kampanyalar */}
          {campaigns.length > 0 && (
            <section>
              <SectionHeader
                title="Sana Özel Kampanyalar"
                subtitle="Sadece sana uygun kampanyaları gösteriyoruz."
                icon={Megaphone}
              />
              <div className="space-y-3">
                {campaigns.map((c) => {
                  const isNew = !seenCampaigns.has(c.id)
                  return (
                    <div
                      key={c.id}
                      className="relative overflow-hidden rounded-2xl border border-orange-200 dark:border-orange-800/60 bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-900/30 dark:via-amber-900/20 dark:to-yellow-900/20 p-5 shadow-sm hover:shadow-lg transition-shadow"
                    >
                      {/* dekoratif parıltılar */}
                      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-300/30 blur-2xl" />
                      <div className="pointer-events-none absolute -left-4 -bottom-4 h-20 w-20 rounded-full bg-orange-300/30 blur-2xl" />

                      <div className="relative flex items-start gap-4">
                        <div className="relative flex-shrink-0">
                          <div
                            className={cn(
                              'h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-400 via-amber-400 to-yellow-400 flex items-center justify-center shadow-lg shadow-orange-500/30 text-3xl',
                              isNew && 'campaign-pop',
                            )}
                            aria-hidden
                          >
                            <span>🥂</span>
                          </div>
                          {isNew && (
                            <>
                              <span className="campaign-sparkle absolute -right-1 -top-1 text-lg">✨</span>
                              <span className="campaign-sparkle absolute -left-2 top-3 text-sm" style={{ animationDelay: '0.5s' }}>✨</span>
                            </>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{c.name}</h3>
                            {isNew && (
                              <span className="text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded-full bg-orange-500 text-white">Yeni</span>
                            )}
                          </div>
                          {c.description && (
                            <p className="text-sm text-gray-700 dark:text-gray-200 mt-1">{c.description}</p>
                          )}
                          {c.message_template && (
                            <div className="mt-3 bg-white/70 dark:bg-gray-900/40 backdrop-blur rounded-lg p-3 border border-orange-100 dark:border-orange-900/40">
                              <p className="text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                                {c.message_template}
                              </p>
                            </div>
                          )}
                          <Link
                            href={`/book/${businessId}`}
                            className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-orange-700 dark:text-orange-300 hover:text-orange-800 dark:hover:text-orange-200"
                          >
                            Randevu Al
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Puan Geçmişi */}
          {transactions.length > 0 && (
            <section>
              <SectionHeader
                title="Puan Geçmişin"
                subtitle="Son hareketlerin."
                icon={TrendingUp}
              />
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {transactions.map((tx) => {
                    const isEarn = tx.type === 'earn'
                    const isSpend = tx.type === 'spend' || tx.type === 'expire'
                    return (
                      <li key={tx.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn(
                            'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0',
                            isEarn && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                            isSpend && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                            tx.type === 'adjust' && 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          )}>
                            <Coins className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {tx.description || TX_SOURCE_LABELS[tx.source] || tx.source}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                              {formatDate(tx.created_at)}
                            </p>
                          </div>
                        </div>
                        <span className={cn(
                          'text-sm font-semibold whitespace-nowrap',
                          isEarn && 'text-emerald-700 dark:text-emerald-400',
                          isSpend && 'text-red-700 dark:text-red-400',
                          tx.type === 'adjust' && 'text-gray-700 dark:text-gray-300'
                        )}>
                          {isEarn ? '+' : isSpend ? '−' : ''}{Math.abs(tx.points)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </section>
          )}

          {/* Geçmiş Ödüller */}
          {pastRewards.length > 0 && (
            <section>
              <SectionHeader title="Geçmiş Ödüller" icon={Gift} />
              <div className="grid gap-3 sm:grid-cols-2">
                {pastRewards.map((r) => (
                  <RewardCard key={r.id} reward={r} />
                ))}
              </div>
            </section>
          )}

          {/* Empty State */}
          {activeRewards.length === 0 && campaigns.length === 0 && transactions.length === 0 && pastRewards.length === 0 && (
            <div className="bg-gradient-to-br from-pulse-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 rounded-2xl border border-pulse-100 dark:border-gray-800 p-10 text-center">
              <div className="h-14 w-14 rounded-full bg-white dark:bg-gray-900 shadow flex items-center justify-center mx-auto mb-3">
                <Gift className="h-7 w-7 text-pulse-900 dark:text-pulse-300" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Randevu aldıkça puan kazanırsın.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
                İşletmen sana özel ödüller de tanımlayabilir.
              </p>
              <Link
                href={`/book/${businessId}`}
                className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-full bg-pulse-900 text-white text-sm font-medium hover:bg-pulse-800 transition-colors"
              >
                Randevu Al
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
