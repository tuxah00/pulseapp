import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const DEFAULT_RESERVATION_DURATION = 90 // minutes

const ALLOWED_FIELDS = [
  'business_id', 'customer_name', 'customer_phone', 'guest_count',
  'table_number', 'reservation_date', 'reservation_time', 'status', 'notes',
] as const

function pickAllowedFields(body: Record<string, unknown>) {
  const result: Record<string, unknown> = {}
  for (const key of ALLOWED_FIELDS) {
    if (key in body) result[key] = body[key]
  }
  return result
}

/**
 * Parse "HH:MM" time string into total minutes since midnight.
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * Check if a new reservation conflicts with existing ones on the same table.
 * Returns the conflicting reservation time string if conflict found, null otherwise.
 */
async function checkTableConflict(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  businessId: string,
  tableNumber: string,
  reservationDate: string,
  reservationTime: string,
  durationMinutes: number,
  excludeId?: string,
): Promise<string | null> {
  let query = supabase
    .from('table_reservations')
    .select('id, reservation_time')
    .eq('business_id', businessId)
    .eq('reservation_date', reservationDate)
    .eq('table_number', tableNumber)
    .in('status', ['pending', 'confirmed', 'seated'])

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data: existing } = await query

  if (!existing || existing.length === 0) return null

  const newStart = timeToMinutes(reservationTime)

  for (const res of existing) {
    const existingStart = timeToMinutes(res.reservation_time)
    const diff = Math.abs(newStart - existingStart)
    if (diff < durationMinutes) {
      return res.reservation_time
    }
  }

  return null
}

/**
 * Fetch reservation_duration_minutes from business settings.
 */
async function getReservationDuration(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  businessId: string,
): Promise<number> {
  const { data } = await supabase
    .from('businesses')
    .select('settings')
    .eq('id', businessId)
    .single()

  return data?.settings?.reservation_duration_minutes ?? DEFAULT_RESERVATION_DURATION
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')
  const date = searchParams.get('date') // YYYY-MM-DD

  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })

  let query = supabase
    .from('table_reservations')
    .select('*')
    .eq('business_id', businessId)
    .order('reservation_time', { ascending: true })

  if (date) query = query.eq('reservation_date', date)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reservations: data })
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const rawBody = await req.json()

  // Zorunlu alan kontrolü
  if (!rawBody.business_id || !rawBody.customer_name || !rawBody.table_number || !rawBody.reservation_date || !rawBody.reservation_time) {
    return NextResponse.json({ error: 'Zorunlu alanlar eksik: business_id, customer_name, table_number, reservation_date, reservation_time' }, { status: 400 })
  }

  const body = pickAllowedFields(rawBody)

  // Conflict check for table reservations
  const bizId = body.business_id as string
  const tableNo = body.table_number as string
  const resDate = body.reservation_date as string
  const resTime = body.reservation_time as string

  if (bizId && tableNo && resDate && resTime) {
    const duration = await getReservationDuration(supabase, bizId)
    const conflictTime = await checkTableConflict(supabase, bizId, tableNo, resDate, resTime, duration)
    if (conflictTime) {
      return NextResponse.json(
        { error: `Bu masa (${tableNo}) seçilen saatte zaten rezerve edilmiş. Çakışan rezervasyon saati: ${conflictTime}` },
        { status: 409 },
      )
    }
  }

  const { data, error } = await supabase
    .from('table_reservations')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reservation: data })
}

export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const rawBody = await req.json()
  const body = pickAllowedFields(rawBody)

  // Conflict check for table reservations (exclude current reservation)
  const bizId = body.business_id as string
  const tableNo = body.table_number as string
  const resDate = body.reservation_date as string
  const resTime = body.reservation_time as string

  if (bizId && tableNo && resDate && resTime) {
    const duration = await getReservationDuration(supabase, bizId)
    const conflictTime = await checkTableConflict(supabase, bizId, tableNo, resDate, resTime, duration, id)
    if (conflictTime) {
      return NextResponse.json(
        { error: `Bu masa (${tableNo}) seçilen saatte zaten rezerve edilmiş. Çakışan rezervasyon saati: ${conflictTime}` },
        { status: 409 },
      )
    }
  }

  const { data, error } = await supabase
    .from('table_reservations')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reservation: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('table_reservations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
