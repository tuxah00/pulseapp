'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useSearchParams } from 'next/navigation'
import {
  CreditCard, CheckCircle2, Loader2, Zap, Star,
  Crown, AlertCircle, ExternalLink, Receipt,
} from 'lucide-react'
import { PLAN_LABELS, PLAN_PRICES, type PlanType } from '@/types'
import { formatCurrency } from '@/lib/utils'

interface PaymentRecord {
  id: string
  plan_type: string
  amount: number
  currency: string
  status: string
  paid_at: string | null
  created_at: string
}

const PLAN_FEATURES: Record<PlanType, string[]> = {
  starter: [
    '100 müşteri',
    '200 randevu / ay',
    'SMS hatırlatma',
    'Temel analitik',
    'Randevu takvimi',
  ],
  standard: [
    '500 müşteri',
    'Sınırsız randevu',
    'WhatsApp desteği',
    'AI mesaj yanıtlama',
    'Gelişmiş analitik',
    'Çoklu personel',
    'Paket yönetimi',
  ],
  pro: [
    'Sınırsız müşteri',
    'Sınırsız randevu',
    'WhatsApp Business',
    'AI asistan (tam erişim)',
    'e-Fatura (Paraşüt)',
    'Tedavi protokolleri',
    'Fotoğraf portfolyosu',
    'Öncelikli destek',
  ],
}

const PLAN_ICONS: Record<PlanType, React.ReactNode> = {
  starter: <Zap className="h-5 w-5 text-blue-500" />,
  standard: <Star className="h-5 w-5 text-purple-500" />,
  pro: <Crown className="h-5 w-5 text-amber-500" />,
}

export default function BillingPage() {
  const { businessId } = useBusinessContext()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [business, setBusiness] = useState<{
    subscription_plan: PlanType
    subscription_status: string
    subscription_ends_at: string | null
    trial_ends_at: string | null
  } | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<PlanType | null>(null)
  const [iframeUrl, setIframeUrl] = useState<string | null>(null)
  const [paymentResult, setPaymentResult] = useState<'success' | 'failed' | null>(null)

  const fetchData = useCallback(async () => {
    if (!businessId) return
    const [bizRes, payRes] = await Promise.all([
      supabase.from('businesses').select('subscription_plan, subscription_status, subscription_ends_at, trial_ends_at').eq('id', businessId).single(),
      supabase.from('payments').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(10),
    ])
    if (bizRes.data) setBusiness(bizRes.data as typeof business)
    if (payRes.data) setPayments(payRes.data)
    setLoading(false)
  }, [businessId, supabase])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const status = searchParams.get('payment')
    if (status === 'success' || status === 'failed') {
      setPaymentResult(status)
      fetchData()
    }
  }, [searchParams, fetchData])

  async function handleUpgrade(plan: PlanType) {
    if (!businessId) return
    setUpgrading(plan)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok) {
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: data.error || 'Ödeme başlatılamadı' } }))
        return
      }
      setIframeUrl(data.iframeUrl)
    } catch {
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: 'Bağlantı hatası' } }))
    } finally {
      setUpgrading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-pulse-900" />
      </div>
    )
  }

  const currentPlan = business?.subscription_plan || 'starter'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Abonelik & Ödeme</h1>
        <p className="mt-1 text-sm text-gray-500">Plan yönetimi ve ödeme geçmişi</p>
      </div>

      {/* Ödeme sonuç banner */}
      {paymentResult === 'success' && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700 font-medium">Ödeme başarıyla tamamlandı! Aboneliğiniz aktif edildi.</p>
        </div>
      )}
      {paymentResult === 'failed' && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">Ödeme başarısız. Lütfen kart bilgilerinizi kontrol edin.</p>
        </div>
      )}

      {/* PayTR iFrame */}
      {iframeUrl && (
        <div className="card !p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="font-medium text-gray-900">Güvenli Ödeme</p>
            <button onClick={() => setIframeUrl(null)} className="text-sm text-gray-400 hover:text-gray-600">Kapat</button>
          </div>
          <iframe
            src={iframeUrl}
            className="w-full"
            style={{ height: 500 }}
            title="PayTR Ödeme"
          />
        </div>
      )}

      {/* Mevcut plan */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Mevcut Plan</h2>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pulse-50">
            <CreditCard className="h-6 w-6 text-pulse-900" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">{PLAN_LABELS[currentPlan]} Plan</p>
            <p className="text-sm text-gray-500">
              Durum:{' '}
              <span className={business?.subscription_status === 'active' || business?.subscription_status === 'trial' ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                {business?.subscription_status === 'trial' && 'Deneme Süreci'}
                {business?.subscription_status === 'active' && 'Aktif'}
                {business?.subscription_status === 'past_due' && 'Ödeme Bekliyor'}
                {business?.subscription_status === 'cancelled' && 'İptal Edildi'}
                {business?.subscription_status === 'expired' && 'Süresi Doldu'}
              </span>
            </p>
            {business?.subscription_ends_at && (
              <p className="text-xs text-gray-400 mt-0.5">
                Sonraki ödeme: {new Date(business.subscription_ends_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
            {business?.trial_ends_at && business?.subscription_status === 'trial' && (
              <p className="text-xs text-amber-500 mt-0.5">
                Deneme bitiş: {new Date(business.trial_ends_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(PLAN_PRICES[currentPlan])}</p>
            <p className="text-xs text-gray-400">/ ay</p>
          </div>
        </div>
      </div>

      {/* Plan karşılaştırma */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Planları Karşılaştır</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {(['starter', 'standard', 'pro'] as PlanType[]).map((plan) => {
            const isCurrent = plan === currentPlan
            return (
              <div
                key={plan}
                className={`rounded-2xl border p-5 flex flex-col transition-all ${
                  isCurrent
                    ? 'border-pulse-300 ring-2 ring-pulse-200 bg-pulse-50/30'
                    : plan === 'standard'
                    ? 'border-purple-200 bg-purple-50/20'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {PLAN_ICONS[plan]}
                  <h3 className="font-bold text-gray-900">{PLAN_LABELS[plan]}</h3>
                  {plan === 'standard' && (
                    <span className="ml-auto text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">Popüler</span>
                  )}
                </div>
                <p className="text-2xl font-bold text-gray-900 mb-4">
                  {formatCurrency(PLAN_PRICES[plan])}
                  <span className="text-sm font-normal text-gray-400">/ay</span>
                </p>
                <ul className="space-y-2 mb-6 flex-1">
                  {PLAN_FEATURES[plan].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <div className="w-full py-2 text-center text-sm font-medium text-pulse-900 bg-pulse-100 rounded-xl">
                    Mevcut Plan
                  </div>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan)}
                    disabled={upgrading !== null}
                    className="btn-primary w-full"
                  >
                    {upgrading === plan ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {plan === 'starter' ? 'Düşür' : 'Yükselt'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Ödeme geçmişi */}
      {payments.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Ödeme Geçmişi</h2>
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3">
                <Receipt className="h-5 w-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{PLAN_LABELS[p.plan_type as PlanType] || p.plan_type} Plan</p>
                  <p className="text-xs text-gray-400">
                    {p.paid_at ? new Date(p.paid_at).toLocaleDateString('tr-TR') : new Date(p.created_at).toLocaleDateString('tr-TR')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(p.amount)}</p>
                  <span className={
                    p.status === 'paid' ? 'badge-success' :
                    p.status === 'pending' ? 'badge-warning' :
                    'badge-danger'
                  }>
                    {p.status === 'paid' ? 'Ödendi' : p.status === 'pending' ? 'Bekliyor' : 'Başarısız'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PayTR bilgi notu */}
      {!process.env.NEXT_PUBLIC_PAYTR_CONFIGURED && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">PayTR yapılandırılmamış</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Ödeme almak için <code className="bg-amber-100 px-1 rounded">PAYTR_MERCHANT_ID</code>, <code className="bg-amber-100 px-1 rounded">PAYTR_MERCHANT_KEY</code> ve <code className="bg-amber-100 px-1 rounded">PAYTR_MERCHANT_SALT</code> env değişkenlerini ekleyin.
            </p>
            <a
              href="https://www.paytr.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-amber-700 underline mt-1"
            >
              paytr.com&apos;a git <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
