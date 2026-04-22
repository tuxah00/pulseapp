import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/ai/actions' })

export const runtime = 'nodejs'

/**
 * GET /api/ai/actions?status=pending|scheduled|open|history|all&limit=50&countOnly=1
 * Kullanıcının kendi staff kaydına bağlı bekleyen/planlı AI aksiyonlarını listeler.
 * countOnly=1 → sadece pending_count döner (top-bar sayacı için hafif yol).
 */
export async function GET(req: NextRequest) {
  const rl = checkRateLimit(req, RATE_LIMITS.ai)
  if (rl.limited) return rl.response

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

  const nowIso = new Date().toISOString()

  // Aktif pending sayısını hesapla:
  // Tüm pending kayıtlardan süresi dolmuş olanları (expires_at < now) çıkar.
  // NOT NULL + lt yerine OR kullanmıyoruz — ISO timestamp'li .or() Supabase'de
  // güvenilir şekilde çalışmadığından iki ayrı sorguyla çözdük.
  async function countActivePending() {
    const [allResult, expiredResult] = await Promise.all([
      admin
        .from('ai_pending_actions')
        .select('id', { count: 'exact', head: true })
        .eq('staff_id', staff!.id)
        .eq('status', 'pending'),
      admin
        .from('ai_pending_actions')
        .select('id', { count: 'exact', head: true })
        .eq('staff_id', staff!.id)
        .eq('status', 'pending')
        .not('expires_at', 'is', null)
        .lt('expires_at', nowIso),
    ])
    return (allResult.count || 0) - (expiredResult.count || 0)
  }

  // Hızlı yol: sadece sayaç
  if (countOnly) {
    const pendingCount = await countActivePending()
    return NextResponse.json({ pending_count: pendingCount })
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

  const [listResult, pendingCount] = await Promise.all([
    listQuery,
    countActivePending(),
  ])

  if (listResult.error) {
    log.error({ err: listResult.error, staffId: staff.id }, 'AI aksiyonları listelenemedi')
    return NextResponse.json({ error: listResult.error.message }, { status: 500 })
  }

  // Süresi dolmuş pending'leri UI'da "expired" olarak etiketle
  const wantsExpiredMapping = statusParam === 'pending' || statusParam === 'open' || statusParam === 'all'
  const now = Date.now()
  const actions = (listResult.data || []).map(a => {
    if (wantsExpiredMapping && a.status === 'pending' && a.expires_at && new Date(a.expires_at).getTime() < now) {
      return { ...a, status: 'expired' as const }
    }
    return a
  })

  return NextResponse.json({ actions, pending_count: pendingCount })
}
