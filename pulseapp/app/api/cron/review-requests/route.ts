import { NextRequest, NextResponse } from 'next/server'
// RLS bypass: arka plan görevi, aktif kullanıcı session'ı yok
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/messaging/send'
import { verifyCronAuth } from '@/lib/api/verify-cron'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/cron/review-requests' })

/**
 * İki katmanlı yorum talebi cron'u.
 *
 * Geçiş 1 — Deneyim yorumu (review_requested = false):
 *   Hizmetten kısa süre sonra (varsayılan 1 saat / 1 gün) müşteriye
 *   "kliniği nasıl buldun" anketi. Google'a yıldız yönlendirir.
 *
 * Geçiş 2 — Sonuç yorumu (result_review_requested = false):
 *   Hizmet sonuçları zamanla görünür olduğunda (burun estetiği 28 gün,
 *   implant 30 gün, saç ekimi 90 gün vb.) ikinci dalga yorum talebi.
 *   services.result_review_delay_days NULL ise bu adım atlanır.
 */
export async function GET(request: NextRequest) {
  const authErr = verifyCronAuth(request)
  if (authErr) return authErr

  const supabase = createAdminClient()
  const now = new Date()
  const results = { experience_sent: 0, result_sent: 0, errors: 0 }

  // Tek sorgu — hem deneyim hem sonuç yorumu için aday randevuları çek
  const { data: appointments } = await supabase
    .from('appointments')
    .select(`
      id, updated_at, review_requested, result_review_requested,
      service:services(id, name, experience_review_delay_days, result_review_delay_days),
      customers(id, name, phone),
      businesses(id, name, google_maps_url, settings)
    `)
    .eq('status', 'completed')
    .is('deleted_at', null)
    .or('review_requested.eq.false,result_review_requested.eq.false')

  for (const apt of appointments || []) {
    const customer = apt.customers as any
    const business = apt.businesses as any
    const service = apt.service as any

    if (!customer?.phone || !business?.id) continue
    if (!business.settings?.auto_review_request) continue

    const completedAt = new Date(apt.updated_at).getTime()

    // ─── Geçiş 1: Deneyim yorumu ───
    if (!apt.review_requested) {
      // Hizmet bazlı override > işletme genel ayarı
      const delayDays = service?.experience_review_delay_days
      const delayMinutes = delayDays != null
        ? delayDays * 24 * 60
        : (business.settings.review_request_delay_minutes ?? 60)

      // delayDays === null (hizmette explicit "yok" denmişse) deneyim yorumu da atlanır
      const skipExperience = service && service.experience_review_delay_days === null
      const readyAt = new Date(completedAt + delayMinutes * 60 * 1000)

      if (!skipExperience && readyAt <= now) {
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
          // Başarılı veya başarısız — sürekli denemesin diye işaretle
          await supabase
            .from('appointments')
            .update({ review_requested: true })
            .eq('id', apt.id)

          if (smsResult.success) {
            results.experience_sent++
          } else {
            results.errors++
            log.error({ err: smsResult.error, appointmentId: apt.id }, 'Deneyim yorumu SMS hatası')
          }
        } catch (err) {
          results.errors++
          log.error({ err, appointmentId: apt.id }, 'Deneyim yorumu istek hatası')
        }
      }
    }

    // ─── Geçiş 2: Sonuç yorumu (gecikmeli) ───
    if (!apt.result_review_requested && service?.result_review_delay_days != null) {
      const resultReadyAt = new Date(completedAt + service.result_review_delay_days * 24 * 60 * 60 * 1000)
      if (resultReadyAt <= now) {
        const googleLink = business.google_maps_url
        const serviceName = service.name || 'tedaviniz'
        const message = googleLink
          ? `Merhaba ${customer.name}! 🌟\n\n${business.name}'de aldığınız ${serviceName} sonuçları artık netleşmiş olmalı.\nSonuçlardan memnun kaldıysanız deneyiminizi paylaşmak ister misiniz?\n\n⭐ Google'da yorum yapın:\n${googleLink}\n\nUzun vadeli geri bildirimleriniz başkalarına ışık tutuyor 🙏`
          : `Merhaba ${customer.name}! 🌟\n\n${business.name}'de aldığınız ${serviceName} sonuçlarından memnun musunuz? Geri bildiriminiz bizim için çok değerli 🙏`

        try {
          const smsResult = await sendMessage({
            to: customer.phone,
            body: message,
            businessId: business.id,
            customerId: customer.id,
            messageType: 'system',
          })
          await supabase
            .from('appointments')
            .update({ result_review_requested: true })
            .eq('id', apt.id)

          if (smsResult.success) {
            results.result_sent++
          } else {
            results.errors++
            log.error({ err: smsResult.error, appointmentId: apt.id }, 'Sonuç yorumu SMS hatası')
          }
        } catch (err) {
          results.errors++
          log.error({ err, appointmentId: apt.id }, 'Sonuç yorumu istek hatası')
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    ...results,
  })
}
