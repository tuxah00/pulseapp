import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/api/with-permission'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'classes')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const supabase = createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const classId = searchParams.get('classId')
  const date = searchParams.get('date')

  if (!classId || !date) return NextResponse.json({ error: 'classId and date required' }, { status: 400 })

  // Sınıfın bu işletmeye ait olduğunu doğrula
  const { data: cls } = await supabase
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('business_id', businessId)
    .maybeSingle()

  if (!cls) return NextResponse.json({ error: 'Sınıf bulunamadı' }, { status: 404 })

  const { data, error } = await supabase
    .from('class_sessions')
    .select('*')
    .eq('class_id', classId)
    .eq('session_date', date)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ session: data })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'classes')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const supabase = createServerSupabaseClient()
  const body = await req.json()

  // class_id zorunlu ve bu işletmeye ait olmalı
  if (!body.class_id) return NextResponse.json({ error: 'class_id gerekli' }, { status: 400 })

  const { data: cls } = await supabase
    .from('classes')
    .select('id')
    .eq('id', body.class_id)
    .eq('business_id', businessId)
    .maybeSingle()

  if (!cls) return NextResponse.json({ error: 'Sınıf bulunamadı' }, { status: 404 })

  const { data, error } = await supabase
    .from('class_sessions')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ session: data })
}
