import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { WorkingHours } from '@/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DAY_KEYS: Record<number, keyof WorkingHours> = {
  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
}

function generateSlots(open: string, close: string, durationMinutes: number): string[] {
  const slots: string[] = []
  const [openH, openM] = open.split(':').map(Number)
  const [closeH, closeM] = close.split(':').map(Number)
  let current = openH * 60 + openM
  const end = closeH * 60 + closeM

  while (current + durationMinutes <= end) {
    const h = Math.floor(current / 60).toString().padStart(2, '0')
    const m = (current % 60).toString().padStart(2, '0')
    slots.push(`${h}:${m}`)
    current += durationMinutes
  }
  return slots
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')           // "2026-03-20"
  const durationStr = searchParams.get('duration') // "60"
  const staffId = searchParams.get('staffId')      // optional

  if (!date || !durationStr) {
    return NextResponse.json({ error: 'date ve duration gerekli' }, { status: 400 })
  }

  const duration = parseInt(durationStr, 10)
  const dateObj = new Date(date + 'T00:00:00') // yerel saat olarak parse et (UTC shift önlenir)
  const dayKey = DAY_KEYS[dateObj.getDay()]

  // İşletme çalışma saatleri
  const { data: business } = await supabase
    .from('businesses')
    .select('working_hours')
    .eq('id', params.id)
    .eq('is_active', true)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })
  }

  const hours = (business.working_hours as WorkingHours)[dayKey]
  if (!hours) {
    return NextResponse.json({ slots: [], message: 'Bu gün kapalı' })
  }

  // Tüm teorik slotları oluştur
  const allSlots = generateSlots(hours.open, hours.close, duration)

  // O günkü mevcut randevuları çek
  let query = supabase
    .from('appointments')
    .select('start_time, end_time')
    .eq('business_id', params.id)
    .eq('appointment_date', date)
    .in('status', ['pending', 'confirmed'])

  if (staffId) query = query.eq('staff_id', staffId)

  const { data: existing } = await query

  // Çakışan slotları çıkar
  const occupied = new Set<string>()
  for (const appt of existing || []) {
    const [sh, sm] = appt.start_time.split(':').map(Number)
    const [eh, em] = appt.end_time.split(':').map(Number)
    let cur = sh * 60 + sm
    while (cur < eh * 60 + em) {
      const h = Math.floor(cur / 60).toString().padStart(2, '0')
      const m = (cur % 60).toString().padStart(2, '0')
      occupied.add(`${h}:${m}`)
      cur += 30
    }
  }

  const available = allSlots.filter(s => !occupied.has(s))

  return NextResponse.json({ slots: available, open: hours.open, close: hours.close })
}
