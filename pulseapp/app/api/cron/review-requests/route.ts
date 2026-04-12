import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/messaging/send'
import { verifyCronAuth } from '@/lib/api/verify-cron'

export async function GET(request: NextRequest) {
  const authErr = verifyCronAuth(request)
  if (authErr) return authErr

  const supabase = createAdminClient()
  const now = new Date()
  const results = { sent: 0, errors: 0 }

  const { data: appointments } = await supabase
    .from('appointments')
    .select(`
      id, updated_at,
      customers(id, name, phone),
      businesses(id, name, google_maps_url, settings)
    `)
    .eq('status', 'completed')
    .eq('review_requested', false)

  for (const apt of appointments || []) {
    const customer = apt.customers as any
    const business = apt.businesses as any

    if (!customer?.phone || !business?.id) continue
    if (!business.settings?.auto_review_request) continue

    const delayMinutes = business.settings.review_request_delay_minutes ?? 30
    const readyAt = new Date(new Date(apt.updated_at).getTime() + delayMinutes * 60 * 1000)
    if (readyAt > now) continue

    const googleLink = business.google_maps_url
    const message = googleLink
      ? `Merhaba ${customer.name}! 😊\n\n${business.name} ziyaretiniz için teşekkürler.\nDeneyiminizi paylaşmak ister misiniz?\n\n⭐ Google'da yorum yapın:\n${googleLink}\n\nGörüşleriniz bizim için çok değerli! 🙏`
      : `Merhaba ${customer.name}! 😊\n\n${business.name} ziyaretiniz için teşekkürler. Hizmetimizden memnun kaldıysanız bizi tavsiye etmeyi unutmayın! 🙏`

    try {
      const smsResult = await sendMessage({
        to: customer.phone,
        body: message,
        businessId: business.id,
        customerId: customer.id,
        messageType: 'system',
      })

      if (smsResult.success) {
        await supabase
          .from('appointments')
          .update({ review_requested: true })
          .eq('id', apt.id)
        results.sent++
      } else {
        // SMS başarısız olsa bile işaretle ki sürekli denemesin
        await supabase
          .from('appointments')
          .update({ review_requested: true })
          .eq('id', apt.id)
        results.errors++
        console.error(`Yorum SMS hatası (${apt.id}):`, smsResult.error)
      }
    } catch (err) {
      results.errors++
      console.error(`Yorum istek hatası (${apt.id}):`, err)
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    ...results,
  })
}
