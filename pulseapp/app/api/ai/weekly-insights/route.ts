import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getOpenAIClient, ASSISTANT_MODEL } from '@/lib/ai/openai-client'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { createLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

const log = createLogger({ route: 'api/ai/insights' })

interface InsightItem {
  type: 'warning' | 'opportunity' | 'success'
  text: string
}

interface InsightsResponse {
  period: string
  stats: {
    appointments: number
    new_customers: number
    no_shows: number
    top_service: string | null
    risk_customers: number
    occupancy_by_day: Record<string, number>
  }
  insights: InsightItem[]
  actions: { label: string; type: string }[]
  generated_at: string
}

const DAY_TR: Record<string, string> = {
  mon: 'Pazartesi', tue: 'Salı', wed: 'Çarşamba',
  thu: 'Perşembe', fri: 'Cuma', sat: 'Cumartesi', sun: 'Pazar',
}

export async function GET(req: NextRequest) {
  try {
    const rl = checkRateLimit(req, RATE_LIMITS.ai)
    if (rl.limited) return rl.response

    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

    // İşletmeyi bul
    const { data: staff } = await supabase
      .from('staff_members')
      .select('business_id')
      .eq('user_id', user.id)
      .single()

    if (!staff) return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })
    const businessId = staff.business_id

    if (!process.env.OPENAI_API_KEY) {
      // Return stats without AI if API key is missing
      log.error({}, 'OPENAI_API_KEY is not configured')
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('name, sector')
      .eq('id', businessId)
      .single()

    // Son 7 gün tarih aralığı
    const now = new Date()
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoStr = weekAgo.toISOString().split('T')[0]
    const nowStr = now.toISOString().split('T')[0]

    // Randevular
    const { data: appointments } = await supabase
      .from('appointments')
      .select('id, status, appointment_date, service_id, start_time')
      .eq('business_id', businessId)
      .gte('appointment_date', weekAgoStr)
      .lte('appointment_date', nowStr)

    const totalAppointments = appointments?.length || 0
    const noShows = appointments?.filter(a => a.status === 'no_show').length || 0

    // Hizmet sayımı (en popüler)
    const serviceCount: Record<string, number> = {}
    for (const a of appointments || []) {
      if (a.service_id) serviceCount[a.service_id] = (serviceCount[a.service_id] || 0) + 1
    }
    const topServiceId = Object.entries(serviceCount).sort((a: [string, number], b: [string, number]) => b[1] - a[1])[0]?.[0] || null
    let topServiceName: string | null = null
    if (topServiceId) {
      const { data: svc } = await supabase.from('services').select('name').eq('id', topServiceId).single()
      topServiceName = svc?.name || null
    }

    // Gün bazlı doluluk
    const occupancyByDay: Record<string, number> = {}
    for (const a of appointments || []) {
      const day = new Date(a.appointment_date).toLocaleDateString('tr-TR', { weekday: 'short' })
      occupancyByDay[day] = (occupancyByDay[day] || 0) + 1
    }

    // Yeni müşteriler (bu hafta oluşturulmuş)
    const { count: newCustomers } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('is_active', true)
      .gte('created_at', weekAgo.toISOString())

    // Risk müşteriler (60+ gün gelmemiş, aktif)
    const sixtyDaysAgo = new Date(now)
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
    const { count: riskCustomers } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('is_active', true)
      .gt('total_visits', 0)
      .lt('last_visit_at', sixtyDaysAgo.toISOString())

    // En yoğun gün
    const busiestDay = Object.entries(occupancyByDay).sort((a, b) => b[1] - a[1])[0]?.[0] || null
    const busiestCount = busiestDay ? occupancyByDay[busiestDay] : 0

    // En sakin gün
    const quietestDay = Object.entries(occupancyByDay).sort((a, b) => a[1] - b[1])[0]?.[0] || null
    const quietestCount = quietestDay ? occupancyByDay[quietestDay] : 0

    const noShowRate = totalAppointments > 0 ? Math.round((noShows / totalAppointments) * 100) : 0

    let aiData: { insights: InsightItem[]; actions: { label: string; type: string }[] } = {
      insights: [],
      actions: [],
    }

    if (process.env.OPENAI_API_KEY) {
      try {
        // OpenAI 4o Mini'ye gönder
        const prompt = `
İşletme: ${business?.name} (${business?.sector})
Dönem: ${weekAgoStr} - ${nowStr} (son 7 gün)

Veriler:
- Toplam randevu: ${totalAppointments}
- No-show: ${noShows} (%${noShowRate})
- Yeni müşteri: ${newCustomers || 0}
- Risk müşteri (60+ gün gelmeyen): ${riskCustomers || 0}
- En çok talep gören hizmet: ${topServiceName || 'Bilinmiyor'}
- En yoğun gün: ${busiestDay || '-'} (${busiestCount} randevu)
- En sakin gün: ${quietestDay || '-'} (${quietestCount} randevu)

Lütfen bu verilere göre Türkçe 3 iş içgörüsü üret. Her biri farklı tipte olsun:
- "warning": Dikkat edilmesi gereken olumsuz bir durum
- "opportunity": Gelir artırıcı bir fırsat
- "success": Tebrik edilecek bir başarı

Ayrıca 2 aksiyon öner.

Yanıtı SADECE JSON formatında ver, başka hiçbir şey yazma:
{
  "insights": [
    {"type": "warning", "text": "..."},
    {"type": "opportunity", "text": "..."},
    {"type": "success", "text": "..."}
  ],
  "actions": [
    {"label": "...", "type": "winback"},
    {"label": "...", "type": "campaign"}
  ]
}
`

        const openai = getOpenAIClient()
        const completion = await openai.chat.completions.create({
          model: ASSISTANT_MODEL,
          max_tokens: 512,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        })

        const text = completion.choices[0]?.message?.content || ''
        try {
          const jsonMatch = text.match(/\{[\s\S]*\}/)
          if (jsonMatch) aiData = JSON.parse(jsonMatch[0])
        } catch (parseErr) {
          log.error({ err: parseErr, raw: text }, 'AI JSON parse hatası')
        }
      } catch (aiErr) {
        log.error({ err: aiErr }, 'OpenAI API hatası')
        // AI fails but we still return stats
      }
    }

    const periodStart = weekAgo.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
    const periodEnd = now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

    const response: InsightsResponse = {
      period: `${periodStart} - ${periodEnd}`,
      stats: {
        appointments: totalAppointments,
        new_customers: newCustomers || 0,
        no_shows: noShows,
        top_service: topServiceName,
        risk_customers: riskCustomers || 0,
        occupancy_by_day: occupancyByDay,
      },
      insights: aiData.insights || [],
      actions: aiData.actions || [],
      generated_at: new Date().toISOString(),
    }

    return NextResponse.json(response)
  } catch (err) {
    log.error({ err }, 'Insights error')
    return NextResponse.json({ error: 'Rapor oluşturulamadı', details: err instanceof Error ? err.message : 'Bilinmeyen hata' }, { status: 500 })
  }
}
