import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsAppMessage } from '@/lib/whatsapp/send'
import type { CustomerSegment } from '@/types'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const results = { segmentsUpdated: 0, winbackSent: 0, errors: 0 }

  // Tüm aktif işletmeleri çek
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name, settings')
    .eq('is_active', true)

  for (const business of businesses || []) {
    const winbackDays: number = business.settings?.winback_days ?? 60

    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, phone, total_visits, last_visit_at, segment, whatsapp_opted_in')
      .eq('business_id', business.id)
      .eq('is_active', true)

    for (const customer of customers || []) {
      const visits = customer.total_visits ?? 0
      const lastVisit = customer.last_visit_at ? new Date(customer.last_visit_at) : null

      // Visit bazlı temel segment
      let newSegment: CustomerSegment
      if (visits === 0) {
        newSegment = 'new'
      } else if (visits < 5) {
        newSegment = 'regular'
      } else {
        newSegment = 'vip'
      }

      // Winback override: son ziyarete göre risk/lost
      if (lastVisit) {
        const daysSince = Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
        if (daysSince >= winbackDays * 2) {
          newSegment = 'lost'
        } else if (daysSince >= winbackDays) {
          newSegment = 'risk'
        }
      }

      if (newSegment === customer.segment) continue

      const wasActive = customer.segment !== 'risk' && customer.segment !== 'lost'
      const nowRisk = newSegment === 'risk'

      try {
        await supabase
          .from('customers')
          .update({ segment: newSegment })
          .eq('id', customer.id)
        results.segmentsUpdated++

        // Yeni risk olan (daha önce aktifti) müşterilere win-back mesajı
        if (wasActive && nowRisk && customer.whatsapp_opted_in && customer.phone) {
          const message = `Merhaba ${customer.name}! 💙\n\n${business.name} olarak sizi özledik! Bir süredir görüşememiştik.\n\nSizi tekrar ağırlamaktan mutluluk duyarız. Randevu almak için bize yazabilirsiniz. 😊`

          const result = await sendWhatsAppMessage({
            to: customer.phone,
            body: message,
            businessId: business.id,
            customerId: customer.id,
            messageType: 'system',
          })

          if (result.success) {
            results.winbackSent++
          } else {
            results.errors++
            console.error(`Win-back mesaj hatası (müşteri: ${customer.id}):`, result.error)
          }
        }
      } catch (err) {
        results.errors++
        console.error(`Segment güncelleme hatası (müşteri: ${customer.id}):`, err)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    ...results,
  })
}
