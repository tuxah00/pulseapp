import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requirePermission, requireWritePermission } from '@/lib/api/with-permission'

// GET: Fotoğraf listesi (müşteri veya protokol bazlı)
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'customers')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const customerId = searchParams.get('customerId')
  const protocolId = searchParams.get('protocolId')
  const appointmentId = searchParams.get('appointmentId')
  const photoType = searchParams.get('photoType')

  const supabase = createServerSupabaseClient()
  let query = supabase
    .from('customer_photos')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (customerId) query = query.eq('customer_id', customerId)
  if (protocolId) query = query.eq('protocol_id', protocolId)
  if (appointmentId) query = query.eq('appointment_id', appointmentId)
  if (photoType) query = query.eq('photo_type', photoType)

  const { data, error } = await query
  if (error) {
    // Migration 075 henüz uygulanmadıysa appointment_id kolonu yok — boş liste dön
    if (appointmentId && error.message?.includes('appointment_id')) {
      return NextResponse.json({ photos: [] })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ photos: data })
}

// POST: Fotoğraf kaydet (upload Supabase Storage üzerinden /api/photos/upload ile yapılır)
export async function POST(request: NextRequest) {
  const auth = await requireWritePermission(request, 'customers')
  if (!auth.ok) return auth.response
  const { businessId, staffId } = auth.ctx

  const body = await request.json()
  const { customerId, protocolId, sessionId, appointmentId, pairId, photoUrl, photoType, tags, notes, takenAt, isPublic, aiAnalysis } = body

  if (!customerId || !photoUrl || !photoType) {
    return NextResponse.json({ error: 'customerId, photoUrl, photoType zorunlu' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  const insertData: Record<string, unknown> = {
    business_id: businessId,
    customer_id: customerId,
    protocol_id: protocolId || null,
    session_id: sessionId || null,
    pair_id: pairId || null,
    photo_url: photoUrl,
    photo_type: photoType,
    tags: tags || [],
    notes: notes || null,
    taken_at: takenAt || new Date().toISOString().split('T')[0],
    uploaded_by: staffId,
    is_public: typeof isPublic === 'boolean' ? isPublic : false,
    ai_analysis: aiAnalysis ?? null,
  }
  // Migration 075 uygulandıktan sonra appointment_id aktif olur
  if (appointmentId) insertData.appointment_id = appointmentId

  let result = await supabase.from('customer_photos').insert(insertData).select().single()

  // Migration 075 henüz uygulanmadıysa appointment_id kolonu yok — olmadan yeniden dene
  if (result.error?.message?.includes('appointment_id')) {
    delete insertData.appointment_id
    result = await supabase.from('customer_photos').insert(insertData).select().single()
  }

  const { data, error } = result
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ photo: data }, { status: 201 })
}
