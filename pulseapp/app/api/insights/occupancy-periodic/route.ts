import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveDateRange } from '@/lib/insights/date-range'
import { generateInsight } from '@/lib/insights/generate'
import type { OccupancyBucket } from '@/lib/insights/templates'
import { createLogger } from '@/lib/utils/logger'
import type { DayHours, WorkingHours } from '@/types'

const log = createLogger({ route: 'api/insights/occupancy-periodic' })

/**
 * GET /api/insights/occupancy-periodic?businessId=&days=30&period=weekly|monthly|seasonal
 *
 * Period'a göre randevu dakikalarını personel saatlerine bölerek doluluk
 * oranı serisi üretir. Template eşlemesi düşük günleri/dönemleri yakalayarak
 * aksiyon önerir.
 */

type Period = 'weekly' | 'monthly' | 'seasonal'

const WEEKDAYS_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
const MONTHS_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
]
const DAY_KEYS: Array<keyof WorkingHours> = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm))
}

function dailyAvailableMinutes(
  workingHours: WorkingHours | null | undefined,
  staffCount: number,
  dayIndex: number, // 0=Sun..6=Sat
): number {
  if (!workingHours) return 0
  const key = DAY_KEYS[dayIndex]
  const hours = workingHours[key] as DayHours | null
  if (!hours) return 0
  return minutesBetween(hours.open, hours.close) * Math.max(1, staffCount)
}

function seasonOf(monthIdx: number): string {
  // 0=Jan..11=Dec
  if ([11, 0, 1].includes(monthIdx)) return 'Kış'
  if ([2, 3, 4].includes(monthIdx)) return 'İlkbahar'
  if ([5, 6, 7].includes(monthIdx)) return 'Yaz'
  return 'Sonbahar'
}

function periodKey(date: Date, period: Period): string {
  if (period === 'weekly') {
    return WEEKDAYS_TR[date.getDay()]
  }
  if (period === 'monthly') {
    return MONTHS_TR[date.getMonth()]
  }
  return seasonOf(date.getMonth())
}

function orderedKeys(period: Period, presentKeys: Set<string>): string[] {
  if (period === 'weekly') {
    // Monday-first
    const mondayFirst = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
    return mondayFirst.filter((k) => presentKeys.has(k))
  }
  if (period === 'monthly') {
    return MONTHS_TR.filter((k) => presentKeys.has(k))
  }
  return ['İlkbahar', 'Yaz', 'Sonbahar', 'Kış'].filter((k) => presentKeys.has(k))
}

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'analytics')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const range = resolveDateRange(searchParams)
  const periodParam = (searchParams.get('period') || 'weekly').toLowerCase()
  const period: Period =
    periodParam === 'monthly' || periodParam === 'seasonal' ? periodParam : 'weekly'
  const admin = createAdminClient()

  try {
    const [businessRes, staffRes, appointmentsRes] = await Promise.all([
      admin
        .from('businesses')
        .select('id, working_hours')
        .eq('id', businessId)
        .maybeSingle(),
      admin
        .from('staff_members')
        .select('id')
        .eq('business_id', businessId)
        .eq('is_active', true),
      admin
        .from('appointments')
        .select('id, appointment_date, start_time, end_time, status')
        .eq('business_id', businessId)
        .is('deleted_at', null)
        .in('status', ['completed', 'confirmed', 'pending'])
        .gte('appointment_date', range.from)
        .lte('appointment_date', range.to),
    ])

    if (businessRes.error) throw businessRes.error
    if (staffRes.error) throw staffRes.error
    if (appointmentsRes.error) throw appointmentsRes.error

    const workingHours = (businessRes.data?.working_hours ?? null) as WorkingHours | null
    const staffCount = Math.max(1, (staffRes.data ?? []).length)

    const booked = new Map<string, number>()
    const available = new Map<string, number>()

    // Booked: randevu süresi
    for (const apt of appointmentsRes.data ?? []) {
      const date = apt.appointment_date as string
      if (!date || !apt.start_time || !apt.end_time) continue
      const d = new Date(`${date}T00:00:00Z`)
      const key = periodKey(d, period)
      const mins = minutesBetween(apt.start_time as string, apt.end_time as string)
      booked.set(key, (booked.get(key) ?? 0) + mins)
    }

    // Available: range içindeki her gün için çalışma saati × personel
    const fromDate = new Date(`${range.from}T00:00:00Z`)
    const toDate = new Date(`${range.to}T00:00:00Z`)
    for (let d = new Date(fromDate); d <= toDate; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = periodKey(d, period)
      const mins = dailyAvailableMinutes(workingHours, staffCount, d.getUTCDay())
      available.set(key, (available.get(key) ?? 0) + mins)
    }

    const presentKeys = new Set([...booked.keys(), ...available.keys()])
    const orderedLabels = orderedKeys(period, presentKeys)

    const series: OccupancyBucket[] = orderedLabels.map((label) => {
      const b = booked.get(label) ?? 0
      const a = available.get(label) ?? 0
      return {
        label,
        bookedMinutes: b,
        availableMinutes: a,
        rate: a > 0 ? Math.min(1, b / a) : 0,
      }
    })

    const totalBooked = series.reduce((s, x) => s + x.bookedMinutes, 0)
    const totalAvailable = series.reduce((s, x) => s + x.availableMinutes, 0)
    const avgRate = totalAvailable > 0 ? totalBooked / totalAvailable : 0

    const lowestBucket =
      series.length > 0
        ? series.reduce((lo, x) => (x.rate < lo.rate ? x : lo), series[0])
        : null
    const highestBucket =
      series.length > 0
        ? series.reduce((hi, x) => (x.rate > hi.rate ? x : hi), series[0])
        : null

    const insight = generateInsight('occupancy', {
      period,
      series,
      avgRate,
      lowestBucket,
      highestBucket,
    })

    return NextResponse.json({
      range: { from: range.from, to: range.to, days: range.days },
      period,
      totals: {
        bookedMinutes: totalBooked,
        availableMinutes: totalAvailable,
        avgRate,
      },
      series,
      insight,
    })
  } catch (err) {
    log.error({ err, businessId }, 'occupancy-periodic error')
    return NextResponse.json(
      { error: 'Doluluk oranı hesaplanamadı' },
      { status: 500 },
    )
  }
}
