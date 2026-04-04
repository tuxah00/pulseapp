import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verifyMembership(supabase: ReturnType<typeof createServerSupabaseClient>, userId: string, businessId: string) {
  const { data } = await supabase
    .from('staff_members')
    .select('id, business_id')
    .eq('user_id', userId)
    .eq('business_id', businessId)
    .single()
  return data
}

// GET: Fotoğraf listesi (müşteri veya protokol bazlı)
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  const customerId = searchParams.get('customerId')
  const protocolId = searchParams.get('protocolId')
  const photoType = searchParams.get('photoType')

  if (!businessId) return NextResponse.json({ error: 'businessId gerekli' }, { status: 400 })

  const staff = await verifyMembership(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const admin = createAdminClient()
  let query = admin
    .from('customer_photos')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (customerId) query = query.eq('customer_id', customerId)
  if (protocolId) query = query.eq('protocol_id', protocolId)
  if (photoType) query = query.eq('photo_type', photoType)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ photos: data })
}

// POST: Fotoğraf yükle (URL kaydı — upload Supabase Storage üzerinden yapılır)
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await request.json()
  const { businessId, customerId, protocolId, sessionId, photoUrl, photoType, tags, notes, takenAt } = body

  if (!businessId || !customerId || !photoUrl || !photoType) {
    return NextResponse.json({ error: 'businessId, customerId, photoUrl, photoType zorunlu' }, { status: 400 })
  }

  const staff = await verifyMembership(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('customer_photos')
    .insert({
      business_id: businessId,
      customer_id: customerId,
      protocol_id: protocolId || null,
      session_id: sessionId || null,
      photo_url: photoUrl,
      photo_type: photoType,
      tags: tags || [],
      notes: notes || null,
      taken_at: takenAt || new Date().toISOString().split('T')[0],
      uploaded_by: staff.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ photo: data }, { status: 201 })
}
