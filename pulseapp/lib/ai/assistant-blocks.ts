import type { AIBlock, AIBlockTableColumn, AIBlockTableCell } from '@/types'

/**
 * Tool sonuçlarından zengin UI blokları türetir.
 * Her tool için hangi bloklar (stat cards, tablo, grafik) üretileceğini tanımlar.
 * Asistan handler'larını şişirmemek için server-side bu tek dosyada toplanır.
 */
export function deriveBlocksFromToolResult(toolName: string, data: any): AIBlock[] {
  if (!data) return []

  switch (toolName) {
    case 'get_revenue_breakdown':
      return revenueBreakdownBlocks(data)
    case 'get_profit_loss':
      return profitLossBlocks(data)
    case 'get_expense_breakdown':
      return expenseBreakdownBlocks(data)
    case 'compare_periods':
      return comparePeriodsBlocks(data)
    case 'get_occupancy_stats':
      return occupancyBlocks(data)
    case 'get_staff_performance':
      return staffPerformanceBlocks(data)
    case 'get_customer_lifetime_value':
      return clvBlocks(data)
    case 'detect_risk_customers':
      return riskCustomersBlocks(data)
    case 'detect_anomalies':
      return anomaliesBlocks(data)
    case 'list_unpaid_invoices':
      return unpaidInvoicesBlocks(data)
    case 'list_appointments':
      return appointmentsBlocks(data)
    case 'search_customers':
      return customersBlocks(data)
    case 'list_services':
      return servicesBlocks(data)
    case 'list_staff':
      return staffBlocks(data)
    case 'list_campaigns':
      return campaignsBlocks(data)
    case 'list_scheduled_actions':
      return scheduledActionsBlocks(data)
    case 'list_workflows':
      return workflowsBlocks(data)
    case 'list_blocked_slots':
      return blockedSlotsBlocks(data)
    case 'list_shifts':
      return shiftsBlocks(data)
    default:
      return []
  }
}

// ── Yardımcılar ──

const money = (v: number | null | undefined): AIBlockTableCell =>
  v == null ? '—' : { value: `${Number(v).toLocaleString('tr-TR')}₺`, variant: 'money' }

const percent = (v: number | null | undefined): AIBlockTableCell =>
  v == null ? '—' : { value: `%${v}`, variant: 'percent' }

const muted = (v: string | number | null | undefined): AIBlockTableCell =>
  v == null || v === '' ? '—' : { value: v, variant: 'muted' }

function revenueBreakdownBlocks(d: any): AIBlock[] {
  const blocks: AIBlock[] = []
  const totals = d.totals || {}
  if (totals.revenue != null || totals.count != null) {
    blocks.push({
      type: 'stat_cards',
      cards: [
        { label: 'Toplam Gelir', value: `${Number(totals.revenue || 0).toLocaleString('tr-TR')}₺`, tone: 'positive' },
        { label: 'Fatura Sayısı', value: String(totals.count || 0) },
        { label: 'Ortalama Sepet', value: `${Number(totals.avg_ticket || 0).toLocaleString('tr-TR')}₺` },
      ],
    })
  }

  const breakdown = Array.isArray(d.breakdown) ? d.breakdown : []
  if (breakdown.length > 0) {
    const groupLabel =
      d.group_by === 'service' ? 'Hizmet' :
      d.group_by === 'staff' ? 'Personel' :
      d.group_by === 'customer_type' ? 'Müşteri Segmenti' :
      d.group_by === 'period' ? 'Dönem' : 'Kategori'

    blocks.push({
      type: 'table',
      title: `Gelir Dökümü — ${groupLabel}`,
      columns: [
        { key: 'label', label: groupLabel },
        { key: 'revenue', label: 'Gelir', align: 'right', variant: 'money' },
        { key: 'count', label: 'Adet', align: 'right' },
        { key: 'percentage', label: 'Pay', align: 'right', variant: 'percent' },
      ],
      rows: breakdown.map((b: any) => [
        String(b.label),
        money(b.revenue),
        b.count ?? 0,
        percent(b.percentage),
      ]),
    })

    // Dönem bazlı ise çizgi grafik de ekle
    if (d.group_by === 'period') {
      blocks.push({
        type: 'chart',
        chartType: 'line',
        title: 'Dönemsel Gelir',
        labels: breakdown.map((b: any) => String(b.label)),
        series: [{ name: 'Gelir', data: breakdown.map((b: any) => Number(b.revenue) || 0) }],
      })
    }
  }

  return blocks
}

function profitLossBlocks(d: any): AIBlock[] {
  return [{
    type: 'stat_cards',
    title: 'Kâr-Zarar Özeti',
    cards: [
      { label: 'Gelir', value: `${Number(d.revenue || 0).toLocaleString('tr-TR')}₺`, tone: 'positive' },
      { label: 'Gider', value: `${Number(d.expenses || 0).toLocaleString('tr-TR')}₺`, tone: 'negative' },
      {
        label: 'Net Kâr',
        value: `${Number(d.net_profit || 0).toLocaleString('tr-TR')}₺`,
        tone: (d.net_profit || 0) >= 0 ? 'positive' : 'negative',
      },
      {
        label: 'Marj',
        value: `%${d.margin_percentage ?? 0}`,
        tone: (d.margin_percentage || 0) >= 0 ? 'positive' : 'negative',
      },
    ],
  }]
}

function expenseBreakdownBlocks(d: any): AIBlock[] {
  const blocks: AIBlock[] = []
  blocks.push({
    type: 'stat_cards',
    cards: [{
      label: 'Toplam Gider', value: `${Number(d.total || 0).toLocaleString('tr-TR')}₺`, tone: 'negative',
    }],
  })
  const breakdown = Array.isArray(d.breakdown) ? d.breakdown : []
  if (breakdown.length > 0) {
    blocks.push({
      type: 'table',
      title: 'Gider Dökümü',
      columns: [
        { key: 'category', label: 'Kategori' },
        { key: 'amount', label: 'Tutar', align: 'right', variant: 'money' },
        { key: 'count', label: 'Adet', align: 'right' },
        { key: 'percentage', label: 'Pay', align: 'right', variant: 'percent' },
      ],
      rows: breakdown.map((b: any) => [
        String(b.category),
        money(b.amount),
        b.count ?? 0,
        percent(b.percentage),
      ]),
    })
  }
  return blocks
}

function comparePeriodsBlocks(d: any): AIBlock[] {
  const fmt = (v: number, suffix = '₺') => `${Number(v || 0).toLocaleString('tr-TR')}${suffix}`
  const toneFor = (pct: number | null, reverse = false): 'positive' | 'negative' | 'default' => {
    if (pct == null) return 'default'
    const isGood = reverse ? pct < 0 : pct > 0
    return pct === 0 ? 'default' : isGood ? 'positive' : 'negative'
  }
  return [{
    type: 'stat_cards',
    title: 'Dönem Karşılaştırması',
    cards: [
      { label: 'Gelir', value: fmt(d.revenue?.current), delta: d.revenue?.change_pct, tone: toneFor(d.revenue?.change_pct) },
      { label: 'Gider', value: fmt(d.expenses?.current), delta: d.expenses?.change_pct, tone: toneFor(d.expenses?.change_pct, true) },
      { label: 'Net Kâr', value: fmt(d.net_profit?.current), delta: d.net_profit?.change_pct, tone: toneFor(d.net_profit?.change_pct) },
      { label: 'Randevu', value: fmt(d.appointments?.current, ''), delta: d.appointments?.change_pct, tone: toneFor(d.appointments?.change_pct) },
      { label: 'Yeni Müşteri', value: fmt(d.new_customers?.current, ''), delta: d.new_customers?.change_pct, tone: toneFor(d.new_customers?.change_pct) },
      { label: 'Tamamlanma', value: `%${d.completion_rate?.current ?? 0}`, delta: d.completion_rate?.change_pct, tone: toneFor(d.completion_rate?.change_pct) },
    ],
  }]
}

function occupancyBlocks(d: any): AIBlock[] {
  const blocks: AIBlock[] = [{
    type: 'stat_cards',
    cards: [
      { label: 'Doluluk', value: `%${d.overall_occupancy ?? 0}`, tone: (d.overall_occupancy || 0) >= 50 ? 'positive' : 'warning' },
      { label: 'Dolu Slot', value: String(d.filled_slots ?? 0) },
      { label: 'Boş Slot', value: String(d.empty_slots ?? 0) },
    ],
  }]
  if (Array.isArray(d.by_staff) && d.by_staff.length > 0) {
    blocks.push({
      type: 'table',
      title: 'Personel Doluluğu',
      columns: [
        { key: 'name', label: 'Personel' },
        { key: 'filled', label: 'Dolu', align: 'right' },
        { key: 'empty', label: 'Boş', align: 'right' },
        { key: 'occupancy', label: 'Oran', align: 'right', variant: 'percent' },
      ],
      rows: d.by_staff.map((s: any) => [
        String(s.name || '—'),
        s.filled_slots ?? 0,
        s.empty_slots ?? 0,
        percent(s.occupancy_rate),
      ]),
    })
  }
  return blocks
}

function staffPerformanceBlocks(d: any): AIBlock[] {
  const perf = Array.isArray(d.performance) ? d.performance : []
  if (perf.length === 0) return []
  return [{
    type: 'table',
    title: 'Personel Performansı',
    columns: [
      { key: 'name', label: 'Personel' },
      { key: 'revenue', label: 'Gelir', align: 'right', variant: 'money' },
      { key: 'appointments', label: 'Randevu', align: 'right' },
      { key: 'completed', label: 'Tamamlanan', align: 'right' },
      { key: 'avg_ticket', label: 'Ort. Sepet', align: 'right', variant: 'money' },
    ],
    rows: perf.map((p: any) => [
      String(p.name || '—'),
      money(p.revenue),
      p.total_appointments ?? 0,
      p.completed_appointments ?? 0,
      money(p.avg_ticket),
    ]),
  }]
}

function clvBlocks(d: any): AIBlock[] {
  const clv = Array.isArray(d.clv) ? d.clv : []
  if (clv.length === 0) return []
  return [{
    type: 'table',
    title: 'Müşteri Yaşam Boyu Değeri',
    columns: [
      { key: 'name', label: 'Müşteri' },
      { key: 'total_spend', label: 'Toplam Harcama', align: 'right', variant: 'money' },
      { key: 'visits', label: 'Ziyaret', align: 'right' },
      { key: 'avg_spend', label: 'Ort. Harcama', align: 'right', variant: 'money' },
      { key: 'annual_value', label: 'Tahmini Yıllık', align: 'right', variant: 'money' },
    ],
    rows: clv.map((c: any) => [
      String(c.name || '—'),
      money(c.total_spend),
      c.visit_count ?? 0,
      money(c.avg_spend),
      money(c.estimated_annual_value),
    ]),
  }]
}

function riskCustomersBlocks(d: any): AIBlock[] {
  const customers = Array.isArray(d.customers) ? d.customers : []
  if (customers.length === 0) return []
  return [{
    type: 'table',
    title: 'Risk Altındaki Müşteriler',
    columns: [
      { key: 'name', label: 'Müşteri' },
      { key: 'phone', label: 'Telefon' },
      { key: 'days', label: 'Gün', align: 'right' },
      { key: 'segment', label: 'Segment' },
      { key: 'reasons', label: 'Sebep' },
    ],
    rows: customers.map((c: any) => [
      String(c.name || '—'),
      muted(c.phone),
      c.days_since_last_visit ?? '—',
      muted(c.segment),
      muted((c.reasons || []).join(', ')),
    ]),
    footer: `Toplam ${d.toplam ?? customers.length} müşteri`,
  }]
}

function anomaliesBlocks(d: any): AIBlock[] {
  const anomalies = Array.isArray(d.anomalies) ? d.anomalies : []
  if (anomalies.length === 0) return []
  return [{
    type: 'table',
    title: 'Tespit Edilen Anomaliler',
    columns: [
      { key: 'type', label: 'Tip' },
      { key: 'severity', label: 'Şiddet' },
      { key: 'message', label: 'Açıklama' },
    ],
    rows: anomalies.map((a: any) => [
      String(a.type || '—'),
      String(a.severity || '—'),
      String(a.message || '—'),
    ]),
  }]
}

function unpaidInvoicesBlocks(d: any): AIBlock[] {
  const rows = Array.isArray(d.faturalar) ? d.faturalar : []
  if (rows.length === 0) return []
  return [{
    type: 'table',
    title: 'Ödenmemiş Faturalar',
    columns: [
      { key: 'fatura_no', label: 'Fatura' },
      { key: 'musteri', label: 'Müşteri' },
      { key: 'toplam', label: 'Toplam', align: 'right', variant: 'money' },
      { key: 'odenen', label: 'Ödenen', align: 'right', variant: 'money' },
      { key: 'kalan', label: 'Kalan', align: 'right', variant: 'money' },
      { key: 'durum', label: 'Durum' },
    ],
    rows: rows.map((r: any) => [
      String(r.fatura_no || '—'),
      muted(r.musteri),
      money(r.toplam),
      money(r.odenen),
      money(r.kalan),
      muted(r.durum),
    ]),
    footer: `Toplam bakiye: ${Number(d.toplam_bakiye || 0).toLocaleString('tr-TR')}₺`,
  }]
}

function appointmentsBlocks(d: any): AIBlock[] {
  const rows = Array.isArray(d.randevular) ? d.randevular : []
  if (rows.length === 0) return []
  return [{
    type: 'table',
    title: 'Randevular',
    columns: [
      { key: 'tarih', label: 'Tarih' },
      { key: 'saat', label: 'Saat' },
      { key: 'musteri', label: 'Müşteri' },
      { key: 'hizmet', label: 'Hizmet' },
      { key: 'personel', label: 'Personel' },
      { key: 'durum', label: 'Durum' },
    ],
    rows: rows.map((r: any) => [
      muted(r.tarih),
      muted(r.saat),
      muted(r.musteri),
      muted(r.hizmet),
      muted(r.personel),
      muted(r.durum),
    ]),
    footer: `Toplam ${d.toplam ?? rows.length} randevu`,
  }]
}

function customersBlocks(d: any): AIBlock[] {
  const rows = Array.isArray(d.musteriler) ? d.musteriler : []
  if (rows.length === 0) return []
  return [{
    type: 'table',
    title: 'Müşteriler',
    columns: [
      { key: 'isim', label: 'İsim' },
      { key: 'telefon', label: 'Telefon' },
      { key: 'segment', label: 'Segment' },
      { key: 'ziyaret', label: 'Ziyaret', align: 'right' },
      { key: 'son_ziyaret', label: 'Son Ziyaret' },
    ],
    rows: rows.map((r: any) => [
      String(r.isim || '—'),
      muted(r.telefon),
      muted(r.segment),
      r.ziyaret_sayisi ?? 0,
      muted(r.son_ziyaret ? new Date(r.son_ziyaret).toLocaleDateString('tr-TR') : null),
    ]),
    footer: `Toplam ${d.toplam ?? rows.length} müşteri`,
  }]
}

function servicesBlocks(d: any): AIBlock[] {
  const rows = Array.isArray(d.hizmetler) ? d.hizmetler : []
  if (rows.length === 0) return []
  return [{
    type: 'table',
    title: 'Hizmetler',
    columns: [
      { key: 'ad', label: 'Hizmet' },
      { key: 'sure', label: 'Süre', align: 'right' },
      { key: 'fiyat', label: 'Fiyat', align: 'right', variant: 'money' },
    ],
    rows: rows.map((r: any) => [
      String(r.ad || '—'),
      r.sure_dk ? `${r.sure_dk} dk` : '—',
      money(r.fiyat),
    ]),
    footer: `Toplam ${d.toplam ?? rows.length} hizmet`,
  }]
}

function staffBlocks(d: any): AIBlock[] {
  const rows = Array.isArray(d.personeller) ? d.personeller : []
  if (rows.length === 0) return []
  return [{
    type: 'table',
    title: 'Personeller',
    columns: [
      { key: 'isim', label: 'İsim' },
      { key: 'rol', label: 'Rol' },
      { key: 'telefon', label: 'Telefon' },
    ],
    rows: rows.map((r: any) => [
      String(r.isim || '—'),
      muted(r.rol),
      muted(r.telefon),
    ]),
  }]
}

function campaignsBlocks(d: any): AIBlock[] {
  const rows = Array.isArray(d.kampanyalar) ? d.kampanyalar : []
  if (rows.length === 0) return []
  return [{
    type: 'table',
    title: 'Kampanyalar',
    columns: [
      { key: 'ad', label: 'Kampanya' },
      { key: 'durum', label: 'Durum' },
      { key: 'kanal', label: 'Kanal' },
      { key: 'alici', label: 'Alıcı', align: 'right' },
      { key: 'gonderilen', label: 'Gönderilen', align: 'right' },
    ],
    rows: rows.map((r: any) => [
      String(r.ad || '—'),
      muted(r.durum),
      muted(r.kanal),
      r.alici_sayisi ?? 0,
      r.gonderilen ?? 0,
    ]),
  }]
}

function scheduledActionsBlocks(d: any): AIBlock[] {
  const rows = Array.isArray(d.actions) ? d.actions : []
  if (rows.length === 0) return []
  return [{
    type: 'table',
    title: 'Planlı Eylemler',
    columns: [
      { key: 'scheduled', label: 'Zaman' },
      { key: 'action_type', label: 'Eylem' },
      { key: 'preview', label: 'Detay' },
    ],
    rows: rows.map((r: any) => [
      muted(r.scheduled_for_local || r.scheduled_for),
      muted(r.action_type),
      muted(r.preview),
    ]),
  }]
}

function workflowsBlocks(d: any): AIBlock[] {
  const rows = Array.isArray(d.is_akislari) ? d.is_akislari : []
  if (rows.length === 0) return []
  return [{
    type: 'table',
    title: 'İş Akışları',
    columns: [
      { key: 'ad', label: 'İş Akışı' },
      { key: 'tetikleyici', label: 'Tetikleyici' },
      { key: 'adimlar', label: 'Adımlar', align: 'right' },
      { key: 'aktif', label: 'Durum' },
    ],
    rows: rows.map((r: any) => [
      String(r.ad || '—'),
      muted(r.tetikleyici),
      r.adim_sayisi ?? 0,
      r.aktif === true ? 'Aktif' : 'Pasif',
    ]),
  }]
}

function blockedSlotsBlocks(d: any): AIBlock[] {
  const rows = Array.isArray(d.bloklar) ? d.bloklar : []
  if (rows.length === 0) return []
  return [{
    type: 'table',
    title: 'Bloke Slotlar',
    columns: [
      { key: 'tarih', label: 'Tarih' },
      { key: 'saat', label: 'Saat' },
      { key: 'sebep', label: 'Sebep' },
    ],
    rows: rows.map((r: any) => [
      muted(r.tarih),
      muted(r.saat),
      muted(r.sebep),
    ]),
  }]
}

function shiftsBlocks(d: any): AIBlock[] {
  const rows = Array.isArray(d.vardiyalar) ? d.vardiyalar : []
  if (rows.length === 0) return []
  return [{
    type: 'table',
    title: 'Vardiyalar',
    columns: [
      { key: 'tarih', label: 'Tarih' },
      { key: 'personel', label: 'Personel' },
      { key: 'saat', label: 'Saat' },
      { key: 'not', label: 'Not' },
    ],
    rows: rows.map((r: any) => [
      muted(r.tarih),
      muted(r.personel),
      muted(r.saat),
      muted(r.not),
    ]),
  }]
}

// ── Column helper (dışa aktarım, gelecekte action_panel için) ──
export type { AIBlockTableColumn as _AIBlockTableColumn }
