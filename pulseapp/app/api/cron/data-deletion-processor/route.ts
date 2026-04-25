import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/api/verify-cron'
import { createLogger } from '@/lib/utils/logger'
import { logSystemAction } from '@/lib/portal/audit'

export const dynamic = 'force-dynamic'

const log = createLogger({ route: 'api/cron/data-deletion-processor' })

/**
 * KVKK veri silme talep işleyicisi.
 *
 * `data_deletion_requests` tablosunda `status='pending'` ve
 * `scheduled_deletion_at <= now()` olan kayıtları işler:
 *
 *   1. status → 'processing' (idempotency için tek-uçucu transition)
 *   2. ai_business_memory + ai_embeddings + customer_photos vb. cascade
 *      (FK'lar `ON DELETE CASCADE` veya migration 061+062'deki KVKK trigger'lar
 *      üzerinden temizleniyor)
 *   3. customers hard delete → bağlı tüm tablolar otomatik silinir
 *   4. data_deletion_requests.status → 'completed', processed_at + completed_at set
 *   5. consent_records ayrı silinir (audit + denetim için müşteri silindikten sonra
 *      anonimleştirilebilir; mevcut akışta da customer_id null'lanmıyor — istek satırı
 *      kalır, status 'completed' olur)
 *
 * Vercel Pro açılınca `vercel.json`'a günlük 04:00 cron eklenecek
 * (`Ertelenen Aboneik Gerektiren Deploylar` listesinde takip).
 */
export async function GET(request: NextRequest) {
  const auth = verifyCronAuth(request)
  if (auth) return auth

  const admin = createAdminClient()
  const startedAt = Date.now()

  try {
    // 1) Bekleyen ve süresi dolmuş talepleri çek
    const { data: pending, error: fetchErr } = await admin
      .from('data_deletion_requests')
      .select('id, business_id, customer_id, customer_phone, scheduled_deletion_at')
      .eq('status', 'pending')
      .lte('scheduled_deletion_at', new Date().toISOString())
      .limit(100) // bir cron tetiklemesinde 100 talepten fazlası beklenmez; gerekirse batch

    if (fetchErr) {
      log.error({ err: fetchErr, phase: 'fetch' }, 'Talep listesi alınamadı')
      return NextResponse.json({ error: 'fetch_failed' }, { status: 500 })
    }

    const requests = pending ?? []
    if (requests.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, durationMs: Date.now() - startedAt })
    }

    let succeeded = 0
    let failed = 0
    const failures: Array<{ id: string; reason: string }> = []

    for (const req of requests) {
      try {
        // 2) status → 'processing' (idempotent transition)
        const { error: lockErr } = await admin
          .from('data_deletion_requests')
          .update({ status: 'processing' })
          .eq('id', req.id)
          .eq('status', 'pending')

        if (lockErr) {
          failed++
          failures.push({ id: req.id, reason: 'lock_failed' })
          continue
        }

        // 3) customer hard delete — cascade trigger'lar bağımlı tabloları temizler
        const { error: delErr } = await admin
          .from('customers')
          .delete()
          .eq('id', req.customer_id)
          .eq('business_id', req.business_id)

        if (delErr) {
          // status'u geri al, retry olabilsin
          await admin
            .from('data_deletion_requests')
            .update({ status: 'pending' })
            .eq('id', req.id)
          failed++
          failures.push({ id: req.id, reason: `customer_delete_failed: ${delErr.message}` })
          log.error({ err: delErr, requestId: req.id }, 'Müşteri silinemedi')
          continue
        }

        // 4) request → completed
        const now = new Date().toISOString()
        const { error: completeErr } = await admin
          .from('data_deletion_requests')
          .update({
            status: 'completed',
            processed_at: now,
            completed_at: now,
          })
          .eq('id', req.id)

        if (completeErr) {
          // veri silindi ama status güncellenemedi — yine de başarılı say
          log.warn({ err: completeErr, requestId: req.id }, 'Status completed olarak işaretlenemedi')
        }

        // 5) Audit log — sistem aktörü
        await logSystemAction({
          businessId: req.business_id,
          action: 'data_deletion_processed',
          resource: 'customer',
          resourceId: req.customer_id,
          details: { requestId: req.id, customerPhone: req.customer_phone || null },
        })

        succeeded++
      } catch (err) {
        failed++
        failures.push({ id: req.id, reason: err instanceof Error ? err.message : String(err) })
        log.error({ err, requestId: req.id }, 'Talep işlenirken beklenmeyen hata')
      }
    }

    return NextResponse.json({
      ok: true,
      processed: requests.length,
      succeeded,
      failed,
      failures,
      durationMs: Date.now() - startedAt,
    })
  } catch (err) {
    log.error({ err }, 'Beklenmeyen cron hatası')
    return NextResponse.json({ error: 'unexpected' }, { status: 500 })
  }
}
