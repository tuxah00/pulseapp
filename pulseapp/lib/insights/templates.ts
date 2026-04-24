// ================================================
// lib/insights/templates.ts
// Veri paterni → Türkçe öneri şablonu eşlemesi
// ================================================
// 9 kategori × ort. 4 şablon = 35+ kural tabanlı şablon.
// Her şablon bir InsightBlock'un çekirdeğini döndürür
// (template_key ve category generate.ts'te eklenir).

import type {
  InsightBlock,
  InsightTemplate,
  InsightAction,
  InsightActionKind,
} from './types'

const pct = (value: number, fractionDigits = 0) =>
  `%${(value * 100).toFixed(fractionDigits)}`

const money = (value: number) => {
  if (!Number.isFinite(value)) return '0 ₺'
  return `${Math.round(value).toLocaleString('tr-TR')} ₺`
}

// ============================================================
// 1) GELİR DAĞILIMI (Revenue Breakdown)
// ============================================================

export interface RevenueInput {
  slices: Array<{ label: string; amount: number }>
  totalRevenue: number
}

export const revenueTemplates: InsightTemplate<RevenueInput>[] = [
  {
    key: 'revenue_concentration_extreme',
    category: 'revenue',
    match: (i) =>
      i.totalRevenue > 0 &&
      i.slices.length > 0 &&
      topShare(i.slices) >= 0.6,
    generate: (i) => {
      const top = topSlice(i.slices)
      const share = top ? top.amount / i.totalRevenue : 0
      return {
        severity: 'critical',
        title: 'Tek kalemde yoğun konsantrasyon',
        message: `Gelirinin ${pct(share)}'i "${top?.label}" kaleminden geliyor. Bu kalemde bir aksaklık çıkarsa ay ciddi açık verir. Paket ve ek hizmetlerle riski dağıtmanı öneririm.`,
        highlights: [`${top?.label}: ${pct(share)}`, `Ciro: ${money(i.totalRevenue)}`],
        actions: [
          action('Paket önerisi hazırla', 'create_package', {
            base_service: top?.label,
            reason: 'concentration_risk',
          }, true),
          action('Winback kampanyası', 'create_campaign', { kind: 'winback', segment: 'regular' }),
        ],
        refineContext: { top: top?.label ?? '', share, total: i.totalRevenue },
      }
    },
  },
  {
    key: 'revenue_concentration_moderate',
    category: 'revenue',
    match: (i) =>
      i.totalRevenue > 0 && topShare(i.slices) >= 0.4 && topShare(i.slices) < 0.6,
    generate: (i) => {
      const top = topSlice(i.slices)
      const share = top ? top.amount / i.totalRevenue : 0
      return {
        severity: 'high',
        title: 'Belirgin ciro baskısı',
        message: `Gelirinin ${pct(share)}'i "${top?.label}" kaleminde. Mevcut yoğunluğu koruyup, ikincil hizmete hafif bir itme vermek dengeyi iyileştirir.`,
        highlights: [`${top?.label}: ${pct(share)}`],
        actions: [
          action('İkincil hizmete kampanya', 'create_campaign', {
            exclude_service: top?.label,
            tone: 'cross_sell',
          }, true),
        ],
        refineContext: { top: top?.label ?? '', share },
      }
    },
  },
  {
    key: 'revenue_balanced',
    category: 'revenue',
    match: (i) =>
      i.totalRevenue > 0 && i.slices.length >= 3 && topShare(i.slices) < 0.4,
    generate: (i) => ({
      severity: 'info',
      title: 'Ciro dağılımı dengeli',
      message: `Gelir kalemleri birbirine yakın dağılıyor; tek kaleme bağımlı değilsin. Şimdi odak ortalama bilet yükseltmek olabilir.`,
      highlights: i.slices
        .slice(0, 3)
        .map((s) => `${s.label}: ${pct(s.amount / i.totalRevenue)}`),
      actions: [
        action('Ortalama bilet için paket', 'create_package', {
          reason: 'ticket_uplift',
        }),
      ],
    }),
  },
  {
    key: 'revenue_empty',
    category: 'revenue',
    match: (i) => i.totalRevenue <= 0 || i.slices.length === 0,
    generate: () => ({
      severity: 'info',
      title: 'Henüz gelir verisi yok',
      message: `Seçili dönemde kayıtlı gelir bulunamadı. Randevular tamamlandıkça ve faturalar kesildikçe bu alan kendi kendine dolar.`,
      actions: [],
    }),
  },
]

// ============================================================
// 2) GİDER DAĞILIMI (Expense Breakdown)
// ============================================================

export interface ExpenseInput {
  slices: Array<{ category: string; amount: number }>
  totalExpense: number
  totalRevenue: number
}

export const expenseTemplates: InsightTemplate<ExpenseInput>[] = [
  {
    key: 'expense_over_revenue',
    category: 'expense',
    match: (i) => i.totalRevenue > 0 && i.totalExpense > i.totalRevenue,
    generate: (i) => ({
      severity: 'critical',
      title: 'Gider, geliri aşıyor',
      message: `Bu dönemde gider (${money(i.totalExpense)}), ciroyu (${money(i.totalRevenue)}) geçiyor. Sabit giderleri ve taşeron maliyetlerini gözden geçirmen gerekiyor.`,
      highlights: [`Açık: ${money(i.totalExpense - i.totalRevenue)}`],
      actions: [
        action('Bütçe uyarısı kur', 'update_business_settings', { setting: 'budget_alert',
          threshold_ratio: 0.9,
        }, true),
        action('Aylık özet not', 'update_business_settings', { setting: 'note', type: 'budget_review' }),
      ],
      refineContext: { expense: i.totalExpense, revenue: i.totalRevenue },
    }),
  },
  {
    key: 'expense_fixed_heavy',
    category: 'expense',
    match: (i) => {
      if (i.totalExpense <= 0) return false
      const fixed = sumByCategories(i.slices, ['kira', 'personel', 'maaş', 'kira gideri'])
      return fixed / i.totalExpense >= 0.6
    },
    generate: (i) => {
      const fixed = sumByCategories(i.slices, ['kira', 'personel', 'maaş', 'kira gideri'])
      const share = fixed / i.totalExpense
      return {
        severity: 'high',
        title: 'Sabit giderler ağırlıkta',
        message: `Toplam giderin ${pct(share)}'i sabit kalemlerden (kira + personel). Pazarlık alanı dar olduğundan kısa vadede ciroyu büyütmeye odaklanmak daha gerçekçi.`,
        highlights: [`Sabit pay: ${pct(share)}`],
        actions: [
          action('Bütçe uyarısı kur', 'update_business_settings', { setting: 'budget_alert', threshold_ratio: 0.75 }, true),
          action('Ciro artırıcı kampanya', 'create_campaign', { tone: 'fill_capacity' }),
        ],
        refineContext: { fixedShare: share },
      }
    },
  },
  {
    key: 'expense_category_spike',
    category: 'expense',
    match: (i) => {
      if (i.totalExpense <= 0 || i.slices.length === 0) return false
      const top = i.slices[0]
      return top.amount / i.totalExpense >= 0.5
    },
    generate: (i) => {
      const top = i.slices[0]
      return {
        severity: 'high',
        title: 'Tek kategori baskın',
        message: `Gider dağılımında "${top.category}" kalemi tek başına ${pct(top.amount / i.totalExpense)} pay alıyor. Bu kalemde sözleşme/fatura tekrar kontrol edilmeli.`,
        highlights: [`${top.category}: ${money(top.amount)}`],
        actions: [
          action(`${top.category} bütçesi için uyarı`, 'update_business_settings', { setting: 'budget_alert',
            category: top.category,
          }, true),
        ],
      }
    },
  },
  {
    key: 'expense_balanced',
    category: 'expense',
    match: (i) => i.totalExpense > 0,
    generate: (i) => ({
      severity: 'info',
      title: 'Gider dağılımı sağlıklı',
      message: `Gider kalemleri belirli bir kalemde yoğunlaşmamış. Akış düzgün; sadece ay sonu toplam bütçeyi kontrol etmek yeterli.`,
      highlights: i.slices
        .slice(0, 3)
        .map((s) => `${s.category}: ${money(s.amount)}`),
      actions: [],
    }),
  },
  {
    key: 'expense_empty',
    category: 'expense',
    match: (i) => i.totalExpense <= 0,
    generate: () => ({
      severity: 'info',
      title: 'Bu dönemde gider kaydı yok',
      message: `Seçili dönemde gider girişi yapılmamış. Kira, personel maaşı ve malzeme faturalarını girdikçe bu grafik oluşmaya başlar.`,
      actions: [],
    }),
  },
]

// ============================================================
// 3) HİZMET GELİRLERİ (Service Revenue)
// ============================================================

export interface ServiceItem {
  id: string
  name: string
  sessionCount: number
  revenue: number
  avgTicket: number
}

export interface ServiceInput {
  services: ServiceItem[]
  totalRevenue: number
}

export const serviceTemplates: InsightTemplate<ServiceInput>[] = [
  {
    key: 'service_bestseller_dominant',
    category: 'service',
    match: (i) => i.totalRevenue > 0 && i.services.length > 0 &&
      i.services[0].revenue / i.totalRevenue >= 0.3,
    generate: (i) => {
      const top = i.services[0]
      const share = top.revenue / i.totalRevenue
      return {
        severity: 'high',
        title: 'Bir hizmet ciroyu taşıyor',
        message: `"${top.name}" tek başına cironun ${pct(share)}'ini üretiyor (${top.sessionCount} seans). Bu hizmetin varyantını paket haline getirip ortalama bileti büyütebilirsin.`,
        highlights: [
          `${top.name}: ${pct(share)}`,
          `Ort. bilet: ${money(top.avgTicket)}`,
        ],
        actions: [
          action(`${top.name} paketi oluştur`, 'create_package', {
            base_service_id: top.id,
          }, true),
        ],
        refineContext: { topService: top.name, share },
      }
    },
  },
  {
    key: 'service_hidden_gem',
    category: 'service',
    match: (i) => {
      const med = median(i.services.map((s) => s.avgTicket))
      return i.services.some(
        (s) => s.avgTicket > med * 1.5 && s.sessionCount <= 5 && s.revenue > 0
      )
    },
    generate: (i) => {
      const med = median(i.services.map((s) => s.avgTicket))
      const gem = i.services
        .filter((s) => s.avgTicket > med * 1.5 && s.sessionCount <= 5 && s.revenue > 0)
        .sort((a, b) => b.avgTicket - a.avgTicket)[0]
      return {
        severity: 'normal',
        title: 'Saklı değer: az seans, yüksek bilet',
        message: `"${gem.name}" hizmeti sadece ${gem.sessionCount} seansta ortalama ${money(gem.avgTicket)} bilet üretmiş. Görünürlüğü artırınca ciddi katkı sağlayabilir.`,
        highlights: [`${gem.name}: ${money(gem.avgTicket)} ort. bilet`],
        actions: [
          action(`${gem.name} için kampanya`, 'create_campaign', {
            service_id: gem.id,
            tone: 'highlight_premium',
          }, true),
        ],
        refineContext: { service: gem.name, avgTicket: gem.avgTicket },
      }
    },
  },
  {
    key: 'service_underperformer',
    category: 'service',
    match: (i) =>
      i.services.some((s) => s.sessionCount >= 3 && s.avgTicket > 0) &&
      underperformers(i.services).length > 0,
    generate: (i) => {
      const weak = underperformers(i.services)[0]
      return {
        severity: 'normal',
        title: 'Zayıf performans noktası',
        message: `"${weak.name}" hizmeti ${weak.sessionCount} seansa rağmen düşük ciro üretiyor (ortalama bilet ${money(weak.avgTicket)}). Fiyat revizyonu veya paket içinde konumlandırma değerlendirilebilir.`,
        highlights: [`${weak.name}: ${money(weak.revenue)} ciro`],
        actions: [
          action('Hizmet fiyatını gözden geçir', 'update_service', { intent: 'review_price',
            service_id: weak.id,
          }),
          action(`${weak.name} paketi öner`, 'create_package', {
            base_service_id: weak.id,
          }, true),
        ],
      }
    },
  },
  {
    key: 'service_healthy',
    category: 'service',
    match: (i) => i.services.length >= 3 && i.totalRevenue > 0,
    generate: (i) => ({
      severity: 'info',
      title: 'Hizmet mix sağlıklı',
      message: `Hizmetler birbirine yakın performansla ilerliyor; belirgin bir zayıf halka yok. Bu istikrarı koruyup yeni hizmet eklemeden önce mevcut cironun devamlılığına odaklan.`,
      highlights: i.services
        .slice(0, 3)
        .map((s) => `${s.name}: ${money(s.revenue)}`),
      actions: [],
    }),
  },
  {
    key: 'service_empty',
    category: 'service',
    match: (i) => i.services.length === 0 || i.totalRevenue <= 0,
    generate: () => ({
      severity: 'info',
      title: 'Hizmet verisi yok',
      message: `Bu dönem için hizmet bazlı ciro kaydı bulunamadı. Randevular tamamlandıkça bu liste dolar.`,
      actions: [],
    }),
  },
]

// ============================================================
// 4) KAMPANYA ROI (Campaign Effectiveness)
// ============================================================

export interface CampaignItem {
  id: string
  name: string
  recipientCount: number
  attributedAppointments: number
  attributedRevenue: number
  /** kampanya SMS maliyeti + kupon/iskonto maliyeti tahmini */
  estimatedCost: number
  conversionRate: number // 0-1
}

export interface CampaignInput {
  campaigns: CampaignItem[]
}

export const campaignTemplates: InsightTemplate<CampaignInput>[] = [
  {
    key: 'campaign_none',
    category: 'campaign',
    match: (i) => i.campaigns.length === 0,
    generate: () => ({
      severity: 'info',
      title: 'Aktif kampanya kaydı yok',
      message: `Son dönemde kampanya gönderimin olmamış. Risk segmentindeki müşterilere yönelik kısa bir winback ile başlayabiliriz.`,
      actions: [
        action('Winback kampanyası başlat', 'create_campaign', { kind: 'winback', segment: 'risk' }, true),
      ],
    }),
  },
  {
    key: 'campaign_strong_roi',
    category: 'campaign',
    match: (i) => i.campaigns.some((c) => roiRatio(c) >= 3),
    generate: (i) => {
      const best = [...i.campaigns].sort((a, b) => roiRatio(b) - roiRatio(a))[0]
      const ratio = roiRatio(best)
      return {
        severity: 'normal',
        title: 'Güçlü ROI üreten kampanya',
        message: `"${best.name}" kampanyası ${ratio.toFixed(1)}× geri dönüş üretmiş (${money(best.attributedRevenue)} gelir). Benzer mesajla ikinci bir tur açmak mantıklı.`,
        highlights: [
          `ROI: ${ratio.toFixed(1)}×`,
          `Dönüşüm: ${pct(best.conversionRate, 1)}`,
        ],
        actions: [
          action(`"${best.name}" tekrarla`, 'create_campaign', {
            clone_from: best.id,
          }, true),
        ],
        refineContext: { campaign: best.name, roi: ratio },
      }
    },
  },
  {
    key: 'campaign_negative_roi',
    category: 'campaign',
    match: (i) =>
      i.campaigns.some(
        (c) => c.estimatedCost > 0 && roiRatio(c) < 1 && c.recipientCount >= 10
      ),
    generate: (i) => {
      const weak = [...i.campaigns]
        .filter((c) => c.estimatedCost > 0 && c.recipientCount >= 10)
        .sort((a, b) => roiRatio(a) - roiRatio(b))[0]
      return {
        severity: 'high',
        title: 'Geri dönüşü zayıf kampanya',
        message: `"${weak.name}" kampanyası ${pct(weak.conversionRate, 1)} dönüşümle maliyetinin altında kalmış. Hedef segment veya çağrıyı revize etmek gerekiyor.`,
        highlights: [
          `Ulaşım: ${weak.recipientCount}`,
          `Dönüşüm: ${pct(weak.conversionRate, 1)}`,
        ],
        actions: [
          action('Şablonu revize et', 'create_campaign', {
            clone_from: weak.id,
            revise_copy: true,
          }, true),
        ],
      }
    },
  },
  {
    key: 'campaign_low_conversion',
    category: 'campaign',
    match: (i) =>
      i.campaigns.some((c) => c.recipientCount >= 20 && c.conversionRate < 0.02),
    generate: (i) => {
      const weak = [...i.campaigns]
        .filter((c) => c.recipientCount >= 20)
        .sort((a, b) => a.conversionRate - b.conversionRate)[0]
      return {
        severity: 'normal',
        title: 'Düşük tıklama/dönüşüm',
        message: `"${weak.name}" ${weak.recipientCount} kişiye gitmiş ama dönüşüm ${pct(weak.conversionRate, 1)}'de kalmış. Başlık veya saat değişikliği ile A/B denemesi faydalı olur.`,
        actions: [
          action('A/B varyantı kur', 'create_campaign', {
            clone_from: weak.id,
            ab_test: true,
          }, true),
        ],
      }
    },
  },
  {
    key: 'campaign_healthy',
    category: 'campaign',
    match: (i) => i.campaigns.length >= 1,
    generate: (i) => ({
      severity: 'info',
      title: 'Kampanya performansı normal',
      message: `Kampanyalar ortalama bir verim üretiyor. Pattern belirlemek için en az 3 ardışık tur gerekir — mevcut ritmi birkaç hafta koru.`,
      highlights: [
        `${i.campaigns.length} kampanya aktif`,
        `Toplam gelir: ${money(i.campaigns.reduce((s, c) => s + c.attributedRevenue, 0))}`,
      ],
      actions: [],
    }),
  },
]

// ============================================================
// 5) MESAJ AKIŞI ROI (Message Flow Effectiveness)
// ============================================================

export interface MessageFlowItem {
  template_name: string
  label: string
  sentCount: number
  attributedAppointments: number
  attributedRevenue: number
  conversionRate: number
}

export interface MessageFlowInput {
  flows: MessageFlowItem[]
}

export const messageFlowTemplates: InsightTemplate<MessageFlowInput>[] = [
  {
    key: 'message_flows_none',
    category: 'message',
    match: (i) => i.flows.length === 0,
    generate: () => ({
      severity: 'info',
      title: 'Henüz otomatik mesaj akışı ölçülmedi',
      message: `Randevu hatırlatma, doğum günü ve winback akışları kurulduğunda burada ROI ölçümleri görünür. Mevcut bir Twilio/WhatsApp entegrasyonu varsa otomasyonları etkinleştirmek yeterli.`,
      actions: [],
    }),
  },
  {
    key: 'message_flows_winback_strong',
    category: 'message',
    match: (i) =>
      i.flows.some(
        (f) =>
          /winback|dönüş|kayıp|geri/i.test(f.template_name + f.label) &&
          f.conversionRate >= 0.1
      ),
    generate: (i) => {
      const best = i.flows.find(
        (f) =>
          /winback|dönüş|kayıp|geri/i.test(f.template_name + f.label) &&
          f.conversionRate >= 0.1
      )!
      return {
        severity: 'normal',
        title: 'Winback akışı iş görüyor',
        message: `"${best.label}" akışı ${pct(best.conversionRate, 1)} dönüşümle ${money(best.attributedRevenue)} ciroya katkı vermiş. Lost segmenti için ikinci bir dalga denemeye hazır.`,
        highlights: [`${best.label}: ${pct(best.conversionRate, 1)}`],
        actions: [
          action('Lost segmente ikinci dalga', 'create_campaign', { kind: 'winback',
            segment: 'lost',
          }, true),
        ],
        refineContext: { flow: best.label, conv: best.conversionRate },
      }
    },
  },
  {
    key: 'message_flows_birthday_zero',
    category: 'message',
    match: (i) =>
      i.flows.some(
        (f) =>
          /birthday|doğum/i.test(f.template_name + f.label) &&
          f.sentCount > 0 &&
          f.attributedAppointments === 0
      ),
    generate: (i) => {
      const f = i.flows.find(
        (x) =>
          /birthday|doğum/i.test(x.template_name + x.label) &&
          x.sentCount > 0 &&
          x.attributedAppointments === 0
      )!
      return {
        severity: 'high',
        title: 'Doğum günü mesajı randevuya dönüşmemiş',
        message: `"${f.label}" akışı son dönemde ${f.sentCount} kez gönderilmiş ama hiçbir randevuya dönüşmemiş. Kupon veya zaman sınırlı indirimle aksiyon çağrısını netleştirmek gerekiyor.`,
        highlights: [`${f.sentCount} gönderim → 0 randevu`],
        actions: [
          action('Doğum günü şablonunu revize et', 'toggle_message_flow', { kind: 'birthday', action: 'revise',
            template_name: f.template_name,
          }, true),
        ],
      }
    },
  },
  {
    key: 'message_flows_reminder_dependent',
    category: 'message',
    match: (i) => {
      const reminder = i.flows.find((f) =>
        /reminder|hatırlat|onay/i.test(f.template_name + f.label)
      )
      if (!reminder) return false
      const total = i.flows.reduce((s, f) => s + f.attributedRevenue, 0)
      return total > 0 && reminder.attributedRevenue / total >= 0.7
    },
    generate: (i) => {
      const reminder = i.flows.find((f) =>
        /reminder|hatırlat|onay/i.test(f.template_name + f.label)
      )!
      const total = i.flows.reduce((s, f) => s + f.attributedRevenue, 0)
      return {
        severity: 'normal',
        title: 'Mesaj akışı tek ayakta yürüyor',
        message: `Mesaj akışlarından gelen cironun ${pct(reminder.attributedRevenue / total)}'ü "${reminder.label}" üzerinden. İkinci bir akış (winback veya doğum günü) devreye alınırsa risk azalır.`,
        actions: [
          action('Winback akışı kur', 'create_message_flow', {
            kind: 'winback',
          }, true),
        ],
      }
    },
  },
  {
    key: 'message_flows_healthy',
    category: 'message',
    match: (i) => i.flows.length >= 2,
    generate: (i) => ({
      severity: 'info',
      title: 'Mesaj akışı dağılımı dengeli',
      message: `Birden fazla akış aktif ve her biri ciroya katkı sağlıyor. Şimdilik ayar gerekmiyor — aylık olarak dönüşümleri izlemek yeterli.`,
      highlights: i.flows
        .slice(0, 3)
        .map((f) => `${f.label}: ${pct(f.conversionRate, 1)}`),
      actions: [],
    }),
  },
]

// ============================================================
// 6) DOLULUK (Occupancy)
// ============================================================

export interface OccupancyBucket {
  label: string
  bookedMinutes: number
  availableMinutes: number
  rate: number // 0-1
}

export interface OccupancyInput {
  period: 'weekly' | 'monthly' | 'seasonal'
  series: OccupancyBucket[]
  avgRate: number
  lowestBucket: OccupancyBucket | null
  highestBucket: OccupancyBucket | null
}

export const occupancyTemplates: InsightTemplate<OccupancyInput>[] = [
  {
    key: 'occupancy_critical_low',
    category: 'occupancy',
    match: (i) => i.series.length > 0 && i.avgRate < 0.3,
    generate: (i) => ({
      severity: 'critical',
      title: 'Doluluk kritik düşük',
      message: `Ortalama doluluk ${pct(i.avgRate)} — takvimin büyük kısmı boş. Ana hedef bu dönemde yeni müşteriyi pratik şekilde getirmek olmalı.`,
      highlights: [`Ortalama: ${pct(i.avgRate)}`],
      actions: [
        action('Doluluk artırma kampanyası', 'create_campaign', {
          tone: 'fill_capacity',
        }, true),
        action('Çalışma saatlerini gözden geçir', 'update_working_hours', {}),
      ],
      refineContext: { avg: i.avgRate, period: i.period },
    }),
  },
  {
    key: 'occupancy_gap_day',
    category: 'occupancy',
    match: (i) =>
      i.series.length > 0 &&
      i.lowestBucket != null &&
      i.avgRate - i.lowestBucket.rate >= 0.2,
    generate: (i) => {
      const low = i.lowestBucket!
      return {
        severity: 'high',
        title: 'Belirgin boşluk günü',
        message: `"${low.label}" diliminde doluluk ${pct(low.rate)} — ortalamanın altında. Bu zaman dilimine özel kısa bir promosyon açmak ciroyu toparlar.`,
        highlights: [`${low.label}: ${pct(low.rate)}`, `Ort: ${pct(i.avgRate)}`],
        actions: [
          action(`${low.label} için promosyon`, 'create_campaign', {
            target_bucket: low.label,
            tone: 'time_limited',
          }, true),
        ],
      }
    },
  },
  {
    key: 'occupancy_peak',
    category: 'occupancy',
    match: (i) =>
      i.series.length > 0 &&
      i.highestBucket != null &&
      i.highestBucket.rate >= 0.85,
    generate: (i) => {
      const high = i.highestBucket!
      return {
        severity: 'normal',
        title: 'Tepe dilim kapasiteye yakın',
        message: `"${high.label}" diliminde doluluk ${pct(high.rate)} — yeni müşteri bu saatlerde reddediliyor olabilir. Fiyatı hafif yukarı çekmek veya bekleme listesi açmak faydalı.`,
        highlights: [`${high.label}: ${pct(high.rate)}`],
        actions: [
          action(`${high.label} için bekleme listesi kuralı`, 'update_business_settings', { setting: 'note',
            note: 'waitlist_peak',
          }, true),
        ],
      }
    },
  },
  {
    key: 'occupancy_healthy',
    category: 'occupancy',
    match: (i) => i.series.length > 0,
    generate: (i) => ({
      severity: 'info',
      title: 'Doluluk dengeli',
      message: `Ortalama doluluk ${pct(i.avgRate)} ve dilimler arasında büyük uçurum yok. Şu an için ek kampanyaya gerek yok; mevcut ritmi koru.`,
      highlights: [`Ort: ${pct(i.avgRate)}`],
      actions: [],
    }),
  },
]

// ============================================================
// 7) NO-SHOW (Gelmeme Oranı)
// ============================================================

export interface NoShowInput {
  noShowRate: number
  totalAppointments: number
  totalNoShows: number
  confirmationsEnabled: boolean
  riskyCustomerCount: number
  topStaffRate?: { staffName: string; rate: number } | null
}

export const noShowTemplates: InsightTemplate<NoShowInput>[] = [
  {
    key: 'no_show_empty',
    category: 'no_show',
    match: (i) => i.totalAppointments < 10,
    generate: () => ({
      severity: 'info',
      title: 'Yeterli randevu örneği yok',
      message: `Anlamlı bir no-show istatistiği için en az 10 randevu gerekiyor. Veri biriktikçe bu alan kendi kendine dolar.`,
      actions: [],
    }),
  },
  {
    key: 'no_show_critical',
    category: 'no_show',
    match: (i) => i.totalAppointments >= 10 && i.noShowRate >= 0.12,
    generate: (i) => ({
      severity: 'critical',
      title: 'No-show oranı kritik',
      message: `Son dönemde ${pct(i.noShowRate, 1)} randevu gelmemiş — sektör ortalaması %6. Onay SMS'i açık değilse bu tek adım oranı belirgin düşürür.`,
      highlights: [
        `Toplam: ${i.totalNoShows}/${i.totalAppointments}`,
        `Oran: ${pct(i.noShowRate, 1)}`,
      ],
      actions: [
        action(
          i.confirmationsEnabled ? 'Onay SMS ayarlarını aç' : 'Onay SMS\'i etkinleştir',
          'update_business_settings',
          { setting: 'confirmation_sms_enabled', value: true },
          true
        ),
      ],
      refineContext: { rate: i.noShowRate, total: i.totalNoShows },
    }),
  },
  {
    key: 'no_show_high_staff',
    category: 'no_show',
    match: (i) =>
      i.topStaffRate != null && i.topStaffRate.rate >= i.noShowRate * 1.5,
    generate: (i) => {
      const s = i.topStaffRate!
      return {
        severity: 'high',
        title: 'Personel bazında sapma',
        message: `${s.staffName} randevularında no-show ${pct(s.rate, 1)} — ortalamanın belirgin üstünde. Hatırlatma zamanı veya müşteri profilinde sapma olabilir.`,
        actions: [
          action('Personele özel hatırlatma', 'schedule_reminder', {
            staff_name: s.staffName,
          }, true),
        ],
      }
    },
  },
  {
    key: 'no_show_risky_customers',
    category: 'no_show',
    match: (i) => i.riskyCustomerCount >= 5,
    generate: (i) => ({
      severity: 'high',
      title: 'Riskli müşteri grubu büyüdü',
      message: `${i.riskyCustomerCount} müşteri yüksek no-show skoruna sahip. Bu gruba rezervasyon öncesi ön ödeme veya kesin onay iste.`,
      actions: [
        action('Risk müşterilere onay talebi', 'schedule_reminder', {
          segment: 'risky',
        }, true),
      ],
    }),
  },
  {
    key: 'no_show_healthy',
    category: 'no_show',
    match: (i) => i.totalAppointments >= 10 && i.noShowRate < 0.06,
    generate: (i) => ({
      severity: 'info',
      title: 'No-show kontrol altında',
      message: `Gelmeme oranın ${pct(i.noShowRate, 1)} ile sektör ortalamasının altında. Mevcut hatırlatma ritmi çalışıyor.`,
      actions: [],
    }),
  },
]

// ============================================================
// 8) MÜŞTERİ SEGMENT (Customer Mix)
// ============================================================

export interface SegmentDistribution {
  new: number
  regular: number
  vip: number
  risk: number
  lost: number
}

export interface SegmentInput {
  distribution: SegmentDistribution
  total: number
  /** Risk segmentinin 30 gün önceki duruma göre büyüme oranı (1.2 = %20 büyüdü) */
  riskGrowthRatio: number
  vipShareOfRevenue: number // 0-1
}

export const segmentTemplates: InsightTemplate<SegmentInput>[] = [
  {
    key: 'segment_empty',
    category: 'segment',
    match: (i) => i.total === 0,
    generate: () => ({
      severity: 'info',
      title: 'Müşteri verisi yok',
      message: `Kayıtlı müşteri bulunamadı. Randevu sayfasından müşteri oluşturunca bu grafik anlamlanır.`,
      actions: [],
    }),
  },
  {
    key: 'segment_risk_growth',
    category: 'segment',
    match: (i) => i.total > 10 && i.riskGrowthRatio >= 1.15,
    generate: (i) => {
      const growth = i.riskGrowthRatio - 1
      return {
        severity: 'high',
        title: 'Risk segmenti büyüyor',
        message: `Risk segmentindeki müşteri sayısı son 30 günde ${pct(growth)} arttı. Bu grup henüz kaybedilmedi; zaman kaçmadan dokunmak kritik.`,
        highlights: [
          `Risk: ${i.distribution.risk}`,
          `Büyüme: ${pct(growth)}`,
        ],
        actions: [
          action('Risk segmentine winback', 'create_campaign', { kind: 'winback',
            segment: 'risk',
          }, true),
          action(
            'Risk segmentini aç',
            'navigate',
            { segment: 'risk' },
            false,
            '/dashboard/customers?segment=risk'
          ),
        ],
        refineContext: { growth, risk: i.distribution.risk },
      }
    },
  },
  {
    key: 'segment_lost_heavy',
    category: 'segment',
    match: (i) => i.total > 10 && i.distribution.lost / i.total >= 0.25,
    generate: (i) => {
      const share = i.distribution.lost / i.total
      return {
        severity: 'normal',
        title: 'Kayıp müşteri havuzu büyük',
        message: `Toplam müşterinin ${pct(share)}'i kayıp segmentinde (${i.distribution.lost} kişi). Güçlü bir ilk tur winback ile bir kısmı geri döndürülebilir.`,
        actions: [
          action('Kayıp segmente winback', 'create_campaign', { kind: 'winback',
            segment: 'lost',
          }, true),
        ],
      }
    },
  },
  {
    key: 'segment_vip_concentration',
    category: 'segment',
    match: (i) => i.vipShareOfRevenue >= 0.5,
    generate: (i) => ({
      severity: 'normal',
      title: 'VIP grubu ciroya fazla bağımlı',
      message: `Cironun ${pct(i.vipShareOfRevenue)}'i VIP segmentten geliyor. Yeni + Düzenli segmentini güçlendiren bir kampanya uzun vadeli risk azaltır.`,
      highlights: [
        `VIP pay: ${pct(i.vipShareOfRevenue)}`,
        `VIP: ${i.distribution.vip}`,
      ],
      actions: [
        action('Düzenli segmente yükseltme', 'create_campaign', {
          segment: 'regular',
          tone: 'upgrade',
        }, true),
      ],
    }),
  },
  {
    key: 'segment_new_heavy',
    category: 'segment',
    match: (i) => i.total > 10 && i.distribution.new / i.total >= 0.4,
    generate: (i) => ({
      severity: 'info',
      title: 'Taze müşteri akışı güçlü',
      message: `Müşterinin ${pct(i.distribution.new / i.total)}'i yeni. İkinci ziyareti teşvik eden bir onboarding mesajı çok değerli olur.`,
      actions: [
        action('İkinci ziyaret teşvik akışı', 'create_message_flow', {
          kind: 'second_visit',
        }, true),
      ],
    }),
  },
  {
    key: 'segment_healthy',
    category: 'segment',
    match: (i) => i.total > 0,
    generate: () => ({
      severity: 'info',
      title: 'Müşteri dağılımı dengeli',
      message: `Segment dağılımı belirgin uçurum içermiyor. Düzenli + VIP ağırlığı korunduğu sürece ciro öngörülebilir kalır.`,
      actions: [],
    }),
  },
]

// ============================================================
// 9) BEKLEME LİSTESİ (Waitlist)
// ============================================================

export interface WaitlistInput {
  activeEntries: number
  filledLast30Days: number
  totalWaitlistLast90Days: number
  conversionRate: number
}

export const waitlistTemplates: InsightTemplate<WaitlistInput>[] = [
  {
    key: 'waitlist_empty',
    category: 'waitlist',
    match: (i) => i.activeEntries === 0 && i.totalWaitlistLast90Days === 0,
    generate: () => ({
      severity: 'info',
      title: 'Bekleme listesi kullanılmıyor',
      message: `Son 90 günde bekleme listesine kimse eklenmemiş. Doluluk yüksek zamanlarda waitlist açmak iptal edilen slotları sıcak müşteriye atar.`,
      actions: [],
    }),
  },
  {
    key: 'waitlist_low_conversion',
    category: 'waitlist',
    match: (i) => i.totalWaitlistLast90Days >= 5 && i.conversionRate < 0.2,
    generate: (i) => ({
      severity: 'normal',
      title: 'Waitlist dönüşümü düşük',
      message: `Son 90 günde waitlist'e giren ${i.totalWaitlistLast90Days} kişiden sadece ${i.filledLast30Days} tanesi randevuya döndü (${pct(i.conversionRate, 1)}). Otomatik SMS bildirimi devreye alınınca oran genelde iki katına çıkar.`,
      actions: [
        action('Waitlist SMS otomasyonu kur', 'create_message_flow', {
          kind: 'waitlist_autofill',
        }, true),
      ],
    }),
  },
  {
    key: 'waitlist_strong',
    category: 'waitlist',
    match: (i) => i.filledLast30Days >= 3,
    generate: (i) => ({
      severity: 'info',
      title: 'Waitlist iş görüyor',
      message: `Son 30 günde bekleme listesinden ${i.filledLast30Days} randevu doldurulmuş. Bu gizli ciro — mevcut yöntemi koru.`,
      highlights: [
        `Dolum: ${i.filledLast30Days}`,
        `Aktif bekleyen: ${i.activeEntries}`,
      ],
      actions: [],
    }),
  },
]

// ============================================================
// Helpers (private)
// ============================================================

function topShare(slices: Array<{ amount: number }>): number {
  if (slices.length === 0) return 0
  const total = slices.reduce((s, x) => s + x.amount, 0)
  if (total <= 0) return 0
  const top = Math.max(...slices.map((x) => x.amount))
  return top / total
}

function topSlice<T extends { amount: number }>(slices: T[]): T | null {
  if (slices.length === 0) return null
  return slices.reduce((a, b) => (b.amount > a.amount ? b : a))
}

function sumByCategories(
  slices: Array<{ category: string; amount: number }>,
  keywords: string[]
) {
  return slices
    .filter((s) =>
      keywords.some((k) =>
        s.category.toLocaleLowerCase('tr').includes(k.toLocaleLowerCase('tr'))
      )
    )
    .reduce((sum, s) => sum + s.amount, 0)
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function underperformers(services: ServiceItem[]): ServiceItem[] {
  const medRev = median(services.map((s) => s.revenue))
  return services
    .filter((s) => s.sessionCount >= 3 && s.revenue < medRev * 0.5)
    .sort((a, b) => a.revenue - b.revenue)
}

function roiRatio(c: CampaignItem): number {
  if (c.estimatedCost <= 0) return c.attributedRevenue > 0 ? Infinity : 0
  return c.attributedRevenue / c.estimatedCost
}

function action(
  label: string,
  kind: InsightActionKind,
  payload: Record<string, unknown>,
  primary = false,
  href?: string
): InsightAction {
  return {
    key: `${kind}_${Math.random().toString(36).slice(2, 8)}`,
    label,
    kind,
    payload,
    primary,
    ...(href ? { href } : {}),
  }
}

// ============================================================
// Kategori → Şablon Registry (generate.ts tarafından kullanılır)
// ============================================================

export const TEMPLATE_REGISTRY = {
  revenue: revenueTemplates,
  expense: expenseTemplates,
  service: serviceTemplates,
  campaign: campaignTemplates,
  message: messageFlowTemplates,
  occupancy: occupancyTemplates,
  no_show: noShowTemplates,
  segment: segmentTemplates,
  waitlist: waitlistTemplates,
} as const

export type TemplateInputMap = {
  revenue: RevenueInput
  expense: ExpenseInput
  service: ServiceInput
  campaign: CampaignInput
  message: MessageFlowInput
  occupancy: OccupancyInput
  no_show: NoShowInput
  segment: SegmentInput
  waitlist: WaitlistInput
}
