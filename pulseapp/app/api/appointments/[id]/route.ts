import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verifyMembership(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  userId: string,
  businessId: string,
) {
  const { data } = await supabase
    .from('staff_members')
    .select('id, business_id')
    .eq('user_id', userId)
    .eq('business_id', businessId)
    .single()
  return data
}

function timeToMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function calculateEndTime(start: string, durationMinutes: number): string {
  const total = timeToMinutes(start) + durationMinutes
  const hh = Math.floor(total / 60)
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

// PATCH: Randevu güncelle (drag-drop için tarih/saat taşıma dahil)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await request.json()
  const { businessId, appointment_date, start_time, end_time } = body
  if (!businessId) return NextResponse.json({ error: 'businessId gerekli' }, { status: 400 })

  const staff = await verifyMembership(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const admin = createAdminClient()

  // Mevcut randevuyu çek (süre, personel için)
  const { data: existing, error: fetchErr } = await admin
    .from('appointments')
    .select('id, business_id, staff_id, start_time, end_time, appointment_date, services(duration_minutes)')
    .eq('id', params.id)
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Randevu bulunamadı' }, { status: 404 })
  }

  const updateData: Record<string, unknown> = {}
  if (appointment_date) updateData.appointment_date = appointment_date

  if (start_time) {
    updateData.start_time = start_time
    if (end_time) {
      updateData.end_time = end_time
    } else {
      // Mevcut süreyi koruyarak end_time hesapla
      const currentDuration =
        timeToMinutes(existing.end_time) - timeToMinutes(existing.start_time)
      const duration =
        currentDuration > 0
          ? currentDuration
          : ((existing.services as unknown as { duration_minutes: number } | null)?.duration_minutes ?? 30)
      updateData.end_time = calculateEndTime(start_time, duration)
    }
  } else if (end_time) {
    updateData.end_time = end_time
  }

  // Çakışma kontrolü (aynı personel için)
  const newDate = (updateData.appointment_date as string) ?? existing.appointment_date
  const newStart = (updateData.start_time as string) ?? existing.start_time
  const newEnd = (updateData.end_time as string) ?? existing.end_time

  if (existing.staff_id) {
    const { data: dayApts } = await admin
      .from('appointments')
      .select('id, start_time, end_time')
      .eq('business_id', businessId)
      .eq('staff_id', existing.staff_id)
      .eq('appointment_date', newDate)
      .in('status', ['pending', 'confirmed'])
      .is('deleted_at', null)

    const conflict = (dayApts ?? []).some((apt) => {
      if (apt.id === params.id) return false
      return (
        timeToMinutes(newStart) < timeToMinutes(apt.end_time) &&
        timeToMinutes(apt.start_time) < timeToMinutes(newEnd)
      )
    })
    if (conflict) {
      return NextResponse.json(
        { error: 'Bu personelin bu saatte başka bir randevusu var.' },
        { status: 409 },
      )
    }
  }

  const { data, error } = await admin
    .from('appointments')
    .update(updateData)
    .eq('id', params.id)
    .eq('business_id', businessId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ appointment: data })
}
