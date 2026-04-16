import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'

export async function GET(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter') || 'all'

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  let query = admin
    .from('appointments')
    .select(`
      id, appointment_date, start_time, end_time, status, notes,
      services(id, name, price, duration_minutes),
      staff_members(id, name)
    `)
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .is('deleted_at', null)

  if (filter === 'upcoming') {
    query = query
      .gte('appointment_date', today)
      .in('status', ['pending', 'confirmed'])
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true })
  } else if (filter === 'past') {
    query = query
      .or(`appointment_date.lt.${today},status.in.(completed,cancelled,no_show)`)
      .order('appointment_date', { ascending: false })
      .order('start_time', { ascending: false })
      .limit(50)
  } else {
    query = query
      .order('appointment_date', { ascending: false })
      .order('start_time', { ascending: false })
      .limit(100)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Randevular yüklenemedi' }, { status: 500 })
  }

  return NextResponse.json({ appointments: data || [] })
}
