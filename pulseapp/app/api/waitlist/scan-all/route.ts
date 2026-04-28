import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scanAndNotifyWaitlistEntry } from '@/lib/waitlist/scan'
import { expireStaleWaitlistHolds } from '@/lib/waitlist/cleanup'

/**
 * POST /api/waitlist/scan-all
 *
 * İşletmenin tüm aktif, bildirilmemiş bekleme listesi kayıtlarını tarar.
 * Her kayıt için takvimde uygun slot arar; bulursa müşteriye bildirim gönderir.
 *
 * Tetikleme noktaları:
 *   - Bekleme listesi sayfası açıldığında (otomatik, arka planda)
 *   - "Tümünü Tara" butonu tıklandığında (manuel)
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff_members')
    .select('id, name, business_id')
    .eq('user_id', user.id)
    .single()
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const admin = createAdminClient()

  // Süresi dolmuş hold'ları önce temizle — boşalan slotlar taramaya girer
  await expireStaleWaitlistHolds(admin, staff.business_id)

  // Tüm aktif, henüz bildirilmemiş girişleri FIFO sırasıyla çek
  const { data: entries } = await admin
    .from('waitlist_entries')
    .select('id')
    .eq('business_id', staff.business_id)
    .eq('is_active', true)
    .eq('is_notified', false)
    .order('created_at', { ascending: true })

  if (!entries?.length) {
    return NextResponse.json({ matched: 0, scanned: 0, total: 0 })
  }

  let matched = 0
  let scanned = 0

  for (const entry of entries) {
    try {
      const result = await scanAndNotifyWaitlistEntry(admin, staff.business_id, entry.id)
      scanned++
      if (result.matched) matched++
    } catch (err) {
      console.error('[waitlist/scan-all] tarama hatası:', entry.id, err)
    }
  }

  return NextResponse.json({ matched, scanned, total: entries.length })
}
