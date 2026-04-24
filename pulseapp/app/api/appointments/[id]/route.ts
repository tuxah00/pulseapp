import { NextRequest, NextResponse } from 'next/server'
import { requireWritePermission } from '@/lib/api/with-permission'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { validateBody } from '@/lib/api/validate'
import { appointmentPatchSchema } from '@/lib/schemas'

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
// Atomic koruma: move_appointment RPC fonksiyonu advisory lock ile TOCTOU race'ini engeller.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWritePermission(request, 'appointments')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx
  const supabase = createServerSupabaseClient()

  const result = await validateBody(request, appointmentPatchSchema)
  if (!result.ok) return result.response
  const { appointment_date, start_time, end_time } = result.data

  // Mevcut randevuyu çek (süre, personel için) — businessId cross-tenant filtre
  const { data: existing, error: fetchErr } = await supabase
    .from('appointments')
    .select('id, business_id, staff_id, start_time, end_time, appointment_date, services(duration_minutes)')
    .eq('id', params.id)
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Randevu bulunamadı' }, { status: 404 })
  }

  // Yeni tarih/saat değerlerini hesapla
  const newDate = appointment_date ?? existing.appointment_date
  let newStart = existing.start_time
  let newEnd = existing.end_time
  if (start_time) {
    newStart = start_time
    if (end_time) {
      newEnd = end_time
    } else {
      const currentDuration =
        timeToMinutes(existing.end_time) - timeToMinutes(existing.start_time)
      const duration =
        currentDuration > 0
          ? currentDuration
          : ((existing.services as unknown as { duration_minutes: number } | null)?.duration_minutes ?? 30)
      newEnd = calculateEndTime(start_time, duration)
    }
  } else if (end_time) {
    newEnd = end_time
  }

  // Atomic RPC — advisory lock + FOR UPDATE ile race koşulsuz conflict check + update
  const { data: rpcResult, error: rpcErr } = await supabase.rpc('move_appointment', {
    p_appointment_id: params.id,
    p_business_id: businessId,
    p_new_date: newDate,
    p_new_start: newStart.slice(0, 5), // HH:MM formatına indir (TIME kolonu)
    p_new_end: newEnd.slice(0, 5),
  })

  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 500 })
  }

  const res = rpcResult as { ok: boolean; error?: string } | null
  if (!res?.ok) {
    switch (res?.error) {
      case 'forbidden':
        return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
      case 'not_found':
        return NextResponse.json({ error: 'Randevu bulunamadı' }, { status: 404 })
      case 'conflict':
        return NextResponse.json(
          { error: 'Bu personelin bu saatte başka bir randevusu var.' },
          { status: 409 },
        )
      default:
        return NextResponse.json({ error: 'Taşıma başarısız' }, { status: 500 })
    }
  }

  // Güncel randevuyu döndür
  const { data: updated } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', params.id)
    .eq('business_id', businessId)
    .single()

  return NextResponse.json({ appointment: updated })
}
