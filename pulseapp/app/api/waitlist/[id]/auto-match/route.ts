import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
// RLS bypass: scan helper appointments + shifts + blocked_slots cross-table read yapıyor
import { createAdminClient } from '@/lib/supabase/admin'
import { scanAndNotifyWaitlistEntry } from '@/lib/waitlist/scan'

/**
 * POST /api/waitlist/[id]/auto-match
 *
 * Belirli bir bekleme listesi kaydı için takvimde manuel slot taraması.
 * Müşterinin tercihlerine uygun ilk boş slot bulunursa bildirim gönderilir.
 *
 * Frontend "Otomatik bul" butonu bu endpoint'i çağırır.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff_members')
    .select('business_id')
    .eq('user_id', user.id)
    .single()
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const result = await scanAndNotifyWaitlistEntry(createAdminClient(), staff.business_id, params.id)
  return NextResponse.json(result)
}
