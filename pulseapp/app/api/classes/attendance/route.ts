import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/api/with-permission'

type SessionOwnership = { id: string; class: { business_id: string } | null }
type AttendanceOwnership = {
  id: string
  session: { class: { business_id: string } | null } | null
}

async function verifySessionOwnership(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  sessionId: string,
  businessId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('class_sessions')
    .select('id, class:classes!inner(business_id)')
    .eq('id', sessionId)
    .maybeSingle<SessionOwnership>()
  return data?.class?.business_id === businessId
}

async function verifyAttendanceOwnership(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  attendanceId: string,
  businessId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('class_attendance')
    .select('id, session:class_sessions!inner(class:classes!inner(business_id))')
    .eq('id', attendanceId)
    .maybeSingle<AttendanceOwnership>()
  return data?.session?.class?.business_id === businessId
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'classes')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const supabase = createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')

  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  if (!(await verifySessionOwnership(supabase, sessionId, businessId))) {
    return NextResponse.json({ error: 'Seans bulunamadı' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('class_attendance')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ attendance: data })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'classes')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const supabase = createServerSupabaseClient()
  const body = await req.json()

  if (!body.session_id) return NextResponse.json({ error: 'session_id gerekli' }, { status: 400 })
  if (!(await verifySessionOwnership(supabase, body.session_id, businessId))) {
    return NextResponse.json({ error: 'Seans bulunamadı' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('class_attendance')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ attendance: data })
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePermission(req, 'classes')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const supabase = createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  if (!(await verifyAttendanceOwnership(supabase, id, businessId))) {
    return NextResponse.json({ error: 'Katılım kaydı bulunamadı' }, { status: 404 })
  }

  const body = await req.json()
  const { data, error } = await supabase
    .from('class_attendance')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ attendance: data })
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission(req, 'classes')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const supabase = createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  if (!(await verifyAttendanceOwnership(supabase, id, businessId))) {
    return NextResponse.json({ error: 'Katılım kaydı bulunamadı' }, { status: 404 })
  }

  const { error } = await supabase.from('class_attendance').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
