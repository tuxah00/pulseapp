import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logAuditServer } from '@/lib/utils/audit'
import { validateBody } from '@/lib/api/validate'
import { feedbackPatchSchema } from '@/lib/schemas'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/feedback' })

async function getStaffInfo(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  userId: string,
  businessId: string,
) {
  const { data } = await supabase
    .from('staff_members')
    .select('id, name, business_id')
    .eq('user_id', userId)
    .eq('business_id', businessId)
    .single()
  return data
}

// GET: İşletmenin tüm geri bildirimlerini döner
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId gerekli' }, { status: 400 })

  const staff = await getStaffInfo(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const { data, error } = await supabase
    .from('feedback')
    .select(`
      id, business_id, customer_id, customer_name, customer_phone,
      type, subject, message, status, response, responded_at, responded_by_staff_id,
      source, created_at, updated_at
    `)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ feedback: data || [] })
}

// PATCH: Geri bildirime yanıt yaz / durumunu güncelle
export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const parsed = await validateBody(request, feedbackPatchSchema)
  if (!parsed.ok) return parsed.response
  const { businessId, id, response, status } = parsed.data

  const staff = await getStaffInfo(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const update: Record<string, unknown> = {}
  const details: Record<string, string | number | boolean | null> = {}

  if (response !== undefined) {
    update.response = response
    update.responded_at = new Date().toISOString()
    update.responded_by_staff_id = staff.id
    update.status = status ?? 'resolved'
    details.action = 'respond'
    details.status = String(update.status)
  } else if (status) {
    update.status = status
    details.action = 'status_change'
    details.status = status
  }

  const { data, error } = await supabase
    .from('feedback')
    .update(update)
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .single()

  if (error) {
    log.error({ err: error, businessId, id }, 'Geri bildirim güncellenemedi')
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAuditServer({
    businessId,
    staffId: staff.id,
    staffName: staff.name,
    action: 'update',
    resource: 'feedback',
    resourceId: id,
    details,
  })

  return NextResponse.json({ feedback: data })
}
