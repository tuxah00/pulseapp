import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Otomatik personel ataması.
 *
 * Verilen tarih/saat için:
 *  - Vardiya dışı (shift_type='off') personelleri hariç tutar
 *  - Aynı saatte çakışan randevusu olan personelleri hariç tutar
 *  - İlk uygun personeli seçer
 *
 * Side-effect: Hizmet süresini (`duration_minutes`) de döndürür ki çağıran route
 * tekrar `services` sorgusu yapmak zorunda kalmasın.
 */

export interface AutoAssignInput {
  businessId: string
  serviceId: string
  date: string       // YYYY-MM-DD
  startTime: string  // HH:MM
}

export type AutoAssignResult =
  | { ok: true; staffId: string | null; durationMinutes?: number }
  | { ok: false; error: string; status: number }

export async function autoAssignStaff(
  supabase: SupabaseClient,
  input: AutoAssignInput,
): Promise<AutoAssignResult> {
  const { businessId, serviceId, date, startTime } = input

  const { data: staffList } = await supabase
    .from('staff_members')
    .select('id')
    .eq('business_id', businessId)
    .eq('is_active', true)

  // Personel yoksa staffId=null ile devam et (createBooking staffId'yi null kabul eder)
  if (!staffList?.length) {
    return { ok: true, staffId: null }
  }

  const sIds = staffList.map((s) => s.id)

  const [{ data: offShifts }, { data: svc }, { data: allAppts }] =
    await Promise.all([
      supabase
        .from('shifts')
        .select('staff_id')
        .eq('business_id', businessId)
        .eq('shift_date', date)
        .eq('shift_type', 'off')
        .in('staff_id', sIds),
      supabase
        .from('services')
        .select('duration_minutes')
        .eq('id', serviceId)
        .single(),
      supabase
        .from('appointments')
        .select('staff_id, start_time, end_time')
        .eq('business_id', businessId)
        .eq('appointment_date', date)
        .in('status', ['pending', 'confirmed'])
        .is('deleted_at', null)
        .in('staff_id', sIds),
    ])

  if (!svc) {
    return { ok: false, error: 'Hizmet bulunamadı', status: 404 }
  }

  const [sh, sm] = startTime.split(':').map(Number)
  const reqStart = sh * 60 + sm
  const reqEnd = reqStart + svc.duration_minutes

  const offSet = new Set((offShifts || []).map((s) => s.staff_id))

  for (const s of staffList) {
    if (offSet.has(s.id)) continue
    const busy = (allAppts || [])
      .filter((a) => a.staff_id === s.id)
      .some((a) => {
        const [ash, asm] = a.start_time.split(':').map(Number)
        const [aeh, aem] = a.end_time.split(':').map(Number)
        return ash * 60 + asm < reqEnd && aeh * 60 + aem > reqStart
      })
    if (!busy) {
      return { ok: true, staffId: s.id, durationMinutes: svc.duration_minutes }
    }
  }

  return {
    ok: false,
    error: 'Bu saat dolu. Lütfen başka bir saat seçin.',
    status: 409,
  }
}
