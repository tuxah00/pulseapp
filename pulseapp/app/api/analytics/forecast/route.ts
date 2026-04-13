import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — Gelir tahmini ve iş zekası
// Params: ?months=3 (kaç ay tahmin)
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'analytics')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const forecastMonths = Math.min(parseInt(searchParams.get('months') || '3'), 6)

  const admin = createAdminClient()

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

  // Historical data (son 6 ay)
  const historical = months.map(m => ({
    month: m.key,
    label: m.label,
    revenue: monthlyRevenue.get(m.key) || 0,
  }))

  // Doğrusal trend ile tahmin
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

  const forecast = []
  for (let i = 0; i < forecastMonths; i++) {
    const xVal = n + i
    const forecastRevenue = Math.max(0, Math.round(intercept + slope * xVal))

    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() + i + 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' })

    forecast.push({ month: key, label, revenue: forecastRevenue })
  }

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
    },
    heatmap: heatmapData,
    maxHeatmapCount,
  })
}
