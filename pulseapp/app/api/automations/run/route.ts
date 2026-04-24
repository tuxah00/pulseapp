import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { runAutomation, type AutomationJobType } from '@/lib/automations/run'

const VALID_JOBS: AutomationJobType[] = ['reminders', 'birthday', 'review_requests', 'winback']

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  let body: { jobType?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  const jobType = body.jobType as AutomationJobType
  if (!VALID_JOBS.includes(jobType)) {
    return NextResponse.json({ error: 'Geçersiz otomasyon tipi' }, { status: 400 })
  }

  // Aktif staff kaydı + business
  const { data: staff } = await supabase
    .from('staff_members')
    .select('id, business_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!staff?.business_id) {
    return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 403 })
  }

  // Sadece manager+owner manuel tetik atabilsin
  if (staff.role !== 'owner' && staff.role !== 'manager') {
    return NextResponse.json({ error: 'Bu işlem için yetki gerekiyor' }, { status: 403 })
  }

  const result = await runAutomation(jobType, staff.business_id, 'manual', user.id)

  return NextResponse.json(result)
}

export async function GET(req: NextRequest) {
  // Son çalıştırma kayıtları (her job_type için en son 1)
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff_members')
    .select('business_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!staff?.business_id) return NextResponse.json({ runs: [] })

  // Her job_type için en son çalıştırma
  const { data: runs } = await supabase
    .from('automations_log')
    .select('id, job_type, triggered_by, result, duration_ms, error, created_at')
    .eq('business_id', staff.business_id)
    .order('created_at', { ascending: false })
    .limit(40)

  // Tekilleştir — her job_type'tan en son
  type RunRow = NonNullable<typeof runs>[number]
  const latestByJob = new Map<string, RunRow>()
  for (const r of runs || []) {
    if (!latestByJob.has(r.job_type as string)) latestByJob.set(r.job_type as string, r)
  }

  return NextResponse.json({ runs: Array.from(latestByJob.values()) })
}
