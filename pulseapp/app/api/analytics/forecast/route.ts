import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeSeasonalTrend } from '@/lib/analytics/insights'
import type { SectorType } from '@/types'

// GET — Gelir tahmini ve iş zekası
// Params: ?months=3 (kaç ay tahmin)
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'analytics')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const forecastMonths = Math.min(parseInt(searchParams.get('months') || '3'), 6)

  const admin = createAdminClient()

  // İşletme sektörünü al — sezonsal analiz için gerekli
  const { data: bizRow } = await admin
    .from('businesses')
    .select('sector')
    .eq('id', businessId)
    .maybeSingle()
  const sector = ((bizRow?.sector as SectorType) || 'other') as SectorType

  // İş Zekası seasonal datasını paralel çek (12 ay + YoY + demand)
  const seasonalPromise = computeSeasonalTrend(admin, businessId, sector).catch(() => [])

  // Son 6 ay tarih aralıkları
  const months: { key: string; label: string; year: number; month: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const key = `${year}-${String(month).padStart(2, '0')}`
    const label = d.toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' })
    months.push({ key, label, year, month })
  }

  // Tamamlanmış randevuları çek (son 6 ay)
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  sixMonthsAgo.setDate(1)

  const { data: appointments, error: aptError } = await admin
    .from('appointments')
    .select('id, appointment_date, start_time, service_id, services(name, price)')
    .eq('business_id', businessId)
    .eq('status', 'completed')
    .is('deleted_at', null)
    .gte('appointment_date', sixMonthsAgo.toISOString().split('T')[0])

  if (aptError) return NextResponse.json({ error: aptError.message }, { status: 500 })

  const aptList = appointments || []

  // Aylık gelir hesapla
  const monthlyRevenue = new Map<string, number>()
  months.forEach(m => monthlyRevenue.set(m.key, 0))

  // Hizmet bazlı gelir
  const serviceRevenue = new Map<string, { name: string; revenue: number; count: number }>()

  // Gün/saat yoğunluk matrisi
  const dayHourMatrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  const dayRevenue = Array(7).fill(0)
  const hourRevenue = Array(24).fill(0)

  for (const apt of aptList) {
    const monthKey = apt.appointment_date?.slice(0, 7)
    if (!monthKey) continue

    const revenue = ((apt.services as any)?.price ?? 0) as number

    if (monthlyRevenue.has(monthKey)) {
      monthlyRevenue.set(monthKey, (monthlyRevenue.get(monthKey) || 0) + revenue)
    }

    // Hizmet bazlı
    const serviceName = (apt.services as any)?.name || 'Diğer'
    const svc = serviceRevenue.get(serviceName) || { name: serviceName, revenue: 0, count: 0 }
    svc.revenue += revenue
    svc.count += 1
    serviceRevenue.set(serviceName, svc)

    // Gün/saat matrisi
    const date = new Date(apt.appointment_date + 'T00:00:00')
    const dayOfWeek = date.getDay() // 0=Pazar, 1=Pazartesi...
    const hour = parseInt(apt.start_time?.slice(0, 2) || '0')
    dayHourMatrix[dayOfWeek][hour] += 1
    dayRevenue[dayOfWeek] += revenue
    hourRevenue[hour] += revenue
  }

  // İş Zekası seasonal datasını bekle — 12 ay gelir + YoY + demand
  const seasonal = await seasonalPromise
  const seasonalMap = new Map(seasonal.map(s => [s.month, s]))

  // Historical data — İş Zekası verisiyle birleştir (12 ay varsa onu, yoksa 6 aylık randevu fallback)
  const useSeasonal = seasonal.length >= 6 && seasonal.some(s => s.revenue > 0)
  const historical = useSeasonal
    ? seasonal.map(s => ({
        month: s.month,
        label: s.label,
        revenue: s.revenue,
        demand: s.demand,
        demand_note: s.demand_note,
        yoy_delta: s.yoy_delta,
      }))
    : months.map(m => {
        const s = seasonalMap.get(m.key)
        return {
          month: m.key,
          label: m.label,
          revenue: monthlyRevenue.get(m.key) || 0,
          demand: s?.demand ?? 'normal',
          demand_note: s?.demand_note ?? null,
          yoy_delta: s?.yoy_delta ?? null,
        }
      })

  // Doğrusal trend regresyonu
  const revenueValues = historical.map(h => h.revenue)
  const n = revenueValues.length
  const xMean = (n - 1) / 2
  const yMean = revenueValues.reduce((a, b) => a + b, 0) / n

  let numerator = 0
  let denominator = 0
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (revenueValues[i] - yMean)
    denominator += (i - xMean) ** 2
  }
  const slope = denominator !== 0 ? numerator / denominator : 0
  const intercept = yMean - slope * xMean

  // Residual (artık) standart sapması — belirsizlik bandı için
  let sumSq = 0
  for (let i = 0; i < n; i++) {
    const fitted = intercept + slope * i
    sumSq += (revenueValues[i] - fitted) ** 2
  }
  const residualStdev = n > 1 ? Math.sqrt(sumSq / n) : yMean * 0.2
  // Alt sınır: aylık ortalamanın %10'u (çok küçük veriyle sıfır bant oluşmasın)
  const baseBand = Math.max(residualStdev, yMean * 0.1, 1)

  // Sezonsal demand çarpanı: peak +10%, high +5%, low -10%, normal 0
  const demandMultiplier = (demand: 'peak' | 'high' | 'normal' | 'low'): number => {
    if (demand === 'peak') return 1.1
    if (demand === 'high') return 1.05
    if (demand === 'low') return 0.9
    return 1
  }

  // Aynı ay geçen yıl gerçekleşen gelir → anchor (varsa karışım uygulanır)
  const yearAgoRevenueFor = (year: number, month: number): number | null => {
    const key = `${year - 1}-${String(month).padStart(2, '0')}`
    const s = seasonalMap.get(key)
    return s && s.revenue > 0 ? s.revenue : null
  }

  const forecast: any[] = []
  for (let i = 0; i < forecastMonths; i++) {
    const xVal = n + i
    const trendValue = intercept + slope * xVal

    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() + i + 1)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const key = `${year}-${String(month).padStart(2, '0')}`
    const label = d.toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' })

    // Sezonsal bilgi (strategy.seasonal yoluyla — seasonal dataset bitti, sektör stratejisinden hesapla)
    // Eğer mevcut seasonalMap'te key yoksa, önce 12 ay önceki kaydı bulamayabiliriz.
    // Demand tahminini computeSeasonalTrend yapısındaki gibi strateji üzerinden çıkaralım:
    // En güvenli yol: aynı ay geçen yıl tahmini yap + trend çarpanı. Eğer YoY yoksa demand tag'ı uygula.
    const yearAgo = yearAgoRevenueFor(year, month)
    let forecastRevenue: number

    // Hafif karma model: %60 trend + %40 geçen yıl (varsa)
    if (yearAgo !== null) {
      // Yıllık büyüme oranı: son 3 ay YoY ortalaması (varsa)
      const recentYoY = seasonal.slice(-3).map(s => s.yoy_delta).filter(v => v != null) as number[]
      const avgYoY = recentYoY.length > 0
        ? recentYoY.reduce((a, b) => a + b, 0) / recentYoY.length / 100
        : 0
      const yoyProjection = yearAgo * (1 + avgYoY)
      forecastRevenue = 0.6 * trendValue + 0.4 * yoyProjection
    } else {
      forecastRevenue = trendValue
    }

    // Sezonsal demand çarpanı uygula (strateji tablosundan — aynı takvim ayı referans alınır)
    // seasonalMap'te bir yıl önceki ayın demand etiketi var
    const priorKey = `${year - 1}-${String(month).padStart(2, '0')}`
    const priorDemand = seasonalMap.get(priorKey)?.demand ?? 'normal'
    forecastRevenue *= demandMultiplier(priorDemand)

    // Belirsizlik bandı: uzak aylar için band genişler (√(i+1))
    const band = baseBand * Math.sqrt(i + 1)
    const lower = Math.max(0, Math.round(forecastRevenue - band))
    const upper = Math.max(0, Math.round(forecastRevenue + band))
    const revenue = Math.max(0, Math.round(forecastRevenue))

    forecast.push({
      month: key,
      label,
      revenue,
      lower,
      upper,
      demand: priorDemand,
    })
  }

  // Güven aralığı yüzdesi — kullanıcıya "±%X hata payı" gösterebilmek için
  const confidencePct = yMean > 0 ? Math.round((baseBand / yMean) * 100) : null

  // En yoğun gün
  const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
  const busiestDayIndex = dayRevenue.indexOf(Math.max(...dayRevenue))
  const busiestDay = dayNames[busiestDayIndex]

  // En yoğun saat
  const busiestHour = hourRevenue.indexOf(Math.max(...hourRevenue))
  const busiestHourLabel = `${busiestHour.toString().padStart(2, '0')}:00 - ${(busiestHour + 1).toString().padStart(2, '0')}:00`

  // Top 3 hizmet
  const topServices = Array.from(serviceRevenue.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3)

  // Yoğunluk haritası (günler × 7-22 arası saatler)
  const heatmapData = []
  for (let day = 0; day < 7; day++) {
    for (let hour = 7; hour <= 22; hour++) {
      heatmapData.push({
        day: dayNames[day],
        dayIndex: day,
        hour,
        count: dayHourMatrix[day][hour],
      })
    }
  }
  const maxHeatmapCount = Math.max(...heatmapData.map(d => d.count), 1)

  return NextResponse.json({
    historical,
    forecast,
    insights: {
      busiestDay,
      busiestHourLabel,
      topServices,
      nextMonthForecast: forecast[0]?.revenue || 0,
      nextMonthLower: forecast[0]?.lower ?? null,
      nextMonthUpper: forecast[0]?.upper ?? null,
      confidencePct,
      historicalMonths: historical.length,
    },
    heatmap: heatmapData,
    maxHeatmapCount,
  })
}
