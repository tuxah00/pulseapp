import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/api/with-permission'

// GET: Doluluk oranı & verimlilik analizi
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'analytics')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const staffId = searchParams.get('staffId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const admin = createAdminClient()

  // İşletme çalışma saatlerini al
  const { data: business } = await admin
    .from('businesses')
    .select('working_hours')
    .eq('id', businessId)
    .single()

  const defaultWorkMinutes = 9 * 60 // 9 saat varsayılan

  // Randevuları al
  let query = admin
    .from('appointments')
    .select('id, appointment_date, start_time, end_time, status, staff_id, staff_members(name)')
    .eq('business_id', businessId)
    .is('deleted_at', null)

  if (staffId) query = query.eq('staff_id', staffId)
  if (from) query = query.gte('appointment_date', from)
  if (to) query = query.lte('appointment_date', to)

  const { data: appointments, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!appointments || appointments.length === 0) {
    return NextResponse.json({
      occupancy: { overall: 0, byStaff: [], byDay: [] },
      stats: { totalAppointments: 0, completed: 0, cancelled: 0, noShow: 0, completionRate: 0, cancelRate: 0, noShowRate: 0 },
    })
  }

  // İstatistikler
  const totalAppointments = appointments.length
  const completed = appointments.filter(a => a.status === 'completed').length
  const cancelled = appointments.filter(a => a.status === 'cancelled').length
  const noShow = appointments.filter(a => a.status === 'no_show').length

  // Günlük doluluk hesapla
  const dayMap = new Map<string, { bookedMinutes: number; count: number }>()
  const staffMap = new Map<string, { bookedMinutes: number; count: number; name: string }>()

  for (const apt of appointments) {
    if (apt.status === 'cancelled') continue

    // Randevu süresini hesapla
    let durationMinutes = 30 // varsayılan
    if (apt.start_time && apt.end_time) {
      const [sh, sm] = apt.start_time.split(':').map(Number)
      const [eh, em] = apt.end_time.split(':').map(Number)
      durationMinutes = (eh * 60 + em) - (sh * 60 + sm)
      if (durationMinutes <= 0) durationMinutes = 30
    }

    // Günlük
    const day = apt.appointment_date
    const dayData = dayMap.get(day) || { bookedMinutes: 0, count: 0 }
    dayData.bookedMinutes += durationMinutes
    dayData.count += 1
    dayMap.set(day, dayData)

    // Personel bazlı
    const staffName = (Array.isArray(apt.staff_members) ? apt.staff_members[0] : apt.staff_members) as { name: string } | null
    const sKey = apt.staff_id || 'unassigned'
    const sData = staffMap.get(sKey) || { bookedMinutes: 0, count: 0, name: staffName?.name || 'Atanmamış' }
    sData.bookedMinutes += durationMinutes
    sData.count += 1
    staffMap.set(sKey, sData)
  }

  // Çalışma saatlerini hesapla (basitleştirilmiş)
  const workingHours = business?.working_hours || {}
  const getWorkMinutes = (_dayOfWeek: number): number => {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
    const dayKey = days[_dayOfWeek]
    const dayHours = (workingHours as Record<string, { open: string; close: string } | null>)[dayKey]
    if (!dayHours) return 0
    const [oh, om] = dayHours.open.split(':').map(Number)
    const [ch, cm] = dayHours.close.split(':').map(Number)
    return (ch * 60 + cm) - (oh * 60 + om)
  }

  const byDay = Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, data]) => {
      const dayOfWeek = new Date(date).getDay()
      const availableMinutes = getWorkMinutes(dayOfWeek) || defaultWorkMinutes
      return {
        date,
        bookedMinutes: data.bookedMinutes,
        availableMinutes,
        occupancyRate: Math.min(100, Math.round((data.bookedMinutes / availableMinutes) * 100)),
        appointmentCount: data.count,
      }
    })

  const totalDays = dayMap.size || 1
  const totalBookedMinutes = Array.from(dayMap.values()).reduce((sum, d) => sum + d.bookedMinutes, 0)
  const totalAvailableMinutes = totalDays * defaultWorkMinutes
  const overallOccupancy = Math.min(100, Math.round((totalBookedMinutes / totalAvailableMinutes) * 100))

  const byStaff = Array.from(staffMap.entries()).map(([id, data]) => ({
    staffId: id,
    name: data.name,
    bookedMinutes: data.bookedMinutes,
    appointmentCount: data.count,
    occupancyRate: Math.min(100, Math.round((data.bookedMinutes / (totalDays * defaultWorkMinutes)) * 100)),
  }))

  return NextResponse.json({
    occupancy: { overall: overallOccupancy, byStaff, byDay },
    stats: {
      totalAppointments,
      completed,
      cancelled,
      noShow,
      completionRate: Math.round((completed / totalAppointments) * 100),
      cancelRate: Math.round((cancelled / totalAppointments) * 100),
      noShowRate: Math.round((noShow / totalAppointments) * 100),
    },
  })
}
