'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Bot, Bell, CheckCircle2, MessageSquare, ClipboardCheck,
  Globe, Sparkles, Calendar, Megaphone,
  Users, RotateCcw, Gift, Cake,
  Star, MessageCircle, CreditCard, Clock, Workflow,
  Info, Gem,
} from 'lucide-react'
import { formatCurrency, formatEstimatedDuration } from '@/lib/utils'
import type { PulseValueData } from '@/lib/analytics/pulse-value-methods'
import { SummaryStats } from './summary-stats'
import { GroupSection } from './group-section'
import { MetricRow } from './metric-row'

interface PulseValuePanelProps {
  from: string
  to: string
}

export function PulseValuePanel({ from, to }: PulseValuePanelProps) {
  const [data, setData] = useState<PulseValueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/analytics/pulse-value?from=${from}&to=${to}`)
      .then(async r => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}))
          throw new Error(body.error || 'Veri yüklenemedi')
        }
        return r.json()
      })
      .then(json => {
        if (!cancelled) setData(json)
      })
      .catch(err => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [from, to])

  const totalMetricCount = useMemo(() => {
    if (!data) return 0
    return (
      Object.values(data.automation).reduce((sum, m) => sum + m.count, 0) +
      Object.values(data.digital_revenue).reduce((sum, m) => sum + m.count, 0) +
      Object.values(data.growth).reduce((sum, m) => sum + m.count, 0) +
      Object.values(data.experience).reduce((sum, m) => sum + m.count, 0)
    )
  }, [data])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-3"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card p-4 animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm text-red-600 dark:text-red-400">
          {error || 'Veri yüklenemedi.'}
        </p>
      </div>
    )
  }

  if (totalMetricCount === 0) {
    return (
      <div className="space-y-4">
        <div className="card p-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-pulse-100 dark:bg-pulse-900/30 text-pulse-900 dark:text-pulse-400 mb-3">
            <Gem className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Bu dönemde henüz otomasyon kaydı yok
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Daha geniş bir tarih aralığı seçin veya platformun özelliklerini aktif olarak kullanmaya başladıkça metrikler burada görünecek.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Üst Özet — 3 ana stat */}
      <SummaryStats
        savedMinutes={data.summary.saved_minutes}
        savedMoneyEstimate={data.summary.saved_money_estimate}
        digitalRevenue={data.summary.digital_revenue}
        newReturningCustomers={data.summary.new_returning_customers}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Grup 1: Otomasyon Kazanımları */}
        <GroupSection
          title="Otomasyon Kazanımları"
          description="Sizin yerinize yapılan işler"
          icon={<Bot className="h-4 w-4" />}
        >
          <MetricRow
            label="24 saat öncesi hatırlatma"
            count={data.automation.reminders_24h.count}
            secondary={formatEstimatedDuration(data.automation.reminders_24h.est_minutes)}
            methodKey="reminders_24h"
            icon={<Bell className="h-3.5 w-3.5" />}
          />
          <MetricRow
            label="2 saat öncesi hatırlatma"
            count={data.automation.reminders_2h.count}
            secondary={formatEstimatedDuration(data.automation.reminders_2h.est_minutes)}
            methodKey="reminders_2h"
            icon={<Bell className="h-3.5 w-3.5" />}
          />
          <MetricRow
            label="Müşteri self-onayı"
            count={data.automation.self_confirmations.count}
            secondary={formatEstimatedDuration(data.automation.self_confirmations.est_minutes)}
            methodKey="self_confirmations"
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          />
          <MetricRow
            label="AI asistan eylemi"
            count={data.automation.ai_actions.count}
            secondary={formatEstimatedDuration(data.automation.ai_actions.est_minutes)}
            methodKey="ai_actions"
            icon={<Sparkles className="h-3.5 w-3.5" />}
          />
          <MetricRow
            label="Otomatik sistem mesajı"
            count={data.automation.system_messages.count}
            secondary={formatEstimatedDuration(data.automation.system_messages.est_minutes)}
            methodKey="system_messages"
            icon={<MessageSquare className="h-3.5 w-3.5" />}
          />
          <MetricRow
            label="Takip kuyruğu"
            count={data.automation.follow_ups.count}
            secondary={formatEstimatedDuration(data.automation.follow_ups.est_minutes)}
            methodKey="follow_ups"
            icon={<ClipboardCheck className="h-3.5 w-3.5" />}
          />
        </GroupSection>

        {/* Grup 2: Dijital Kanal Geliri */}
        <GroupSection
          title="Dijital Kanal Geliri"
          description="Platform olmasa çok zor oluşacak gelir"
          icon={<Globe className="h-4 w-4" />}
        >
          <MetricRow
            label="Online randevu (link)"
            count={data.digital_revenue.web_appointments.count}
            secondary={formatCurrency(data.digital_revenue.web_appointments.revenue)}
            methodKey="web_appointments"
            icon={<Globe className="h-3.5 w-3.5" />}
          />
          <MetricRow
            label="AI asistan randevusu"
            count={data.digital_revenue.ai_appointments.count}
            secondary={formatCurrency(data.digital_revenue.ai_appointments.revenue)}
            methodKey="ai_appointments"
            icon={<Sparkles className="h-3.5 w-3.5" />}
          />
          <MetricRow
            label="Boş slot doldurma"
            count={data.digital_revenue.gap_fill.count}
            secondary={formatCurrency(data.digital_revenue.gap_fill.revenue)}
            methodKey="gap_fill"
            icon={<Calendar className="h-3.5 w-3.5" />}
          />
          <MetricRow
            label="Kampanya kaynaklı randevu"
            count={data.digital_revenue.campaign_sourced.count}
            secondary={formatCurrency(data.digital_revenue.campaign_sourced.revenue)}
            methodKey="campaign_sourced"
            icon={<Megaphone className="h-3.5 w-3.5" />}
          />
        </GroupSection>

        {/* Grup 3: Müşteri Büyüme & Geri Dönüş */}
        <GroupSection
          title="Müşteri Büyüme & Geri Dönüş"
          description="Platform özellikleriyle gelen müşteriler"
          icon={<Users className="h-4 w-4" />}
        >
          <MetricRow
            label="Referans dönüşümü"
            count={data.growth.referrals_converted.count}
            secondary={data.growth.referrals_converted.revenue > 0 ? formatCurrency(data.growth.referrals_converted.revenue) : undefined}
            methodKey="referrals_converted"
            icon={<Users className="h-3.5 w-3.5" />}
          />
          <MetricRow
            label="Geri Kazanım ile geri dönüş"
            count={data.growth.winback_recovered.count}
            methodKey="winback_recovered"
            icon={<RotateCcw className="h-3.5 w-3.5" />}
          />
          <MetricRow
            label="Ödül kullanımı"
            count={data.growth.rewards_used.count}
            methodKey="rewards_used"
            icon={<Gift className="h-3.5 w-3.5" />}
          />
          <MetricRow
            label="Doğum günü mesajı"
            count={data.growth.birthday_driven.count}
            methodKey="birthday_driven"
            icon={<Cake className="h-3.5 w-3.5" />}
          />
        </GroupSection>

        {/* Grup 4: Müşteri Deneyimi & Dijitalleşme */}
        <GroupSection
          title="Müşteri Deneyimi & Dijitalleşme"
          description="Platformun operasyonel omurgası"
          icon={<Star className="h-4 w-4" />}
        >
          <MetricRow
            label="Otomatik yorum talebi"
            count={data.experience.review_requests.count}
            methodKey="review_requests"
            icon={<MessageCircle className="h-3.5 w-3.5" />}
          />
          <MetricRow
            label="Alınan yorum"
            count={data.experience.reviews_received.count}
            secondary={data.experience.reviews_received.avg_rating > 0 ? `Ort ${data.experience.reviews_received.avg_rating}★` : undefined}
            methodKey="reviews_received"
            icon={<Star className="h-3.5 w-3.5" />}
          />
          <MetricRow
            label="Kasa dijital işlemi"
            count={data.experience.pos_transactions.count}
            secondary={data.experience.pos_transactions.total > 0 ? formatCurrency(data.experience.pos_transactions.total) : undefined}
            methodKey="pos_transactions"
            icon={<CreditCard className="h-3.5 w-3.5" />}
          />
          <MetricRow
            label="Periyodik kontrol hatırlatması"
            count={data.experience.periodic_reminders.count}
            methodKey="periodic_reminders"
            icon={<Clock className="h-3.5 w-3.5" />}
          />
          <MetricRow
            label="Workflow tamamlanması"
            count={data.experience.workflow_runs.count}
            methodKey="workflow_runs"
            icon={<Workflow className="h-3.5 w-3.5" />}
          />
        </GroupSection>
      </div>

      {/* Alt Şeffaflık Kutusu */}
      <div className="card p-3 flex items-start gap-2 bg-gray-50/50 dark:bg-gray-800/30">
        <Info className="h-4 w-4 text-gray-500 dark:text-gray-400 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
          <span className="font-medium">Tahmini değerler —</span>{' '}
          hesaplamalar ortalama iş süreleri ve ~30 ₺/saat standart işletme zaman maliyeti üzerinden yapılır.
          Kesin rakamlar işletmenize göre değişebilir. Her metrikte <span className="font-medium">(?)</span> ikonuna tıklayarak hesaplama yöntemini görebilirsiniz.
        </p>
      </div>
    </div>
  )
}
