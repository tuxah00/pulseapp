import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * GET /api/ai/actions?status=pending|scheduled|open|history|all&limit=50&countOnly=1
 * Kullanıcının kendi staff kaydına bağlı bekleyen/planlı AI aksiyonlarını listeler.
 * Hem asistan konuşmasından hem de İş Zekası "Uygula" butonundan gelen aksiyonlar tek yerde.
 * countOnly=1 → sadece pending_count döner (top-bar sayacı için hafif yol).
 */
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Oturum bulunamadı' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: staff } = await admin
    .from('staff_members')
    .select('id, business_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!staff) {
    return NextResponse.json({ error: 'Personel kaydı bulunamadı' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const statusParam = searchParams.get('status') || 'open'
  const limit = Math.min(Number(searchParams.get('limit') || 50), 200)
  const countOnly = searchParams.get('countOnly') === '1'

  // expires_at null olanları (kalıcı) + geleceğe dönük olanları say
  const nowIso = new Date().toISOString()
  const pendingCountQuery = admin
    .from('ai_pending_actions')
    .select('id', { count: 'exact', head: true })
    .eq('staff_id', staff.id)
    .eq('status', 'pending')
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)

  // Hızlı yol: sadece sayaç
  if (countOnly) {
    const { count } = await pendingCountQuery
    return NextResponse.json({ pending_count: count || 0 })
  }

  let listQuery = admin
    .from('ai_pending_actions')
    .select('id, action_type, payload, preview, status, scheduled_for, created_at, expires_at, executed_at, result')
    .eq('staff_id', staff.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (statusParam === 'pending') listQuery = listQuery.eq('status', 'pending')
  else if (statusParam === 'scheduled') listQuery = listQuery.eq('status', 'scheduled')
  else if (statusParam === 'open') listQuery = listQuery.in('status', ['pending', 'scheduled'])
  else if (statusParam === 'history') listQuery = listQuery.in('status', ['executed', 'cancelled', 'expired'])
  // 'all' → filtre yok

  // Liste + sayaç paralel (bağımsız sorgular)
  const [listResult, countResult] = await Promise.all([listQuery, pendingCountQuery])

  if (listResult.error) {
    return NextResponse.json({ error: listResult.error.message }, { status: 500 })
  }

  // Süresi dolmuş pending'leri UI'da "expired" olarak etiketle (history/open sekmelerinde)
  const wantsExpiredMapping = statusParam === 'pending' || statusParam === 'open' || statusParam === 'all'
  const now = Date.now()
  const actions = (listResult.data || []).map(a => {
    if (wantsExpiredMapping && a.status === 'pending' && a.expires_at && new Date(a.expires_at).getTime() < now) {
      return { ...a, status: 'expired' as const }
    }
    return a
  })

  return NextResponse.json({ actions, pending_count: countResult.count || 0 })
}
