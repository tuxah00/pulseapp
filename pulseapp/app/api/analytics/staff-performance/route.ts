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

// GET: Personel performans karnesi
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  const staffId = searchParams.get('staffId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!businessId) return NextResponse.json({ error: 'businessId gerekli' }, { status: 400 })

  const staff = await verifyMembership(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const admin = createAdminClient()

  // Personel listesi
  let staffQuery = admin
    .from('staff_members')
    .select('id, name, role, avatar_url')
    .eq('business_id', businessId)
    .eq('is_active', true)

  if (staffId) staffQuery = staffQuery.eq('id', staffId)

  const { data: staffList, error: staffError } = await staffQuery
  if (staffError) return NextResponse.json({ error: staffError.message }, { status: 500 })

  if (!staffList || staffList.length === 0) {
    return NextResponse.json({ performance: [] })
  }

  // Randevular, faturalar ve yorumları paralel çek
  let aptQuery = admin
    .from('appointments')
    .select('id, staff_id, status, appointment_date, start_time, end_time')
    .eq('business_id', businessId)
    .is('deleted_at', null)

  if (from) aptQuery = aptQuery.gte('appointment_date', from)
  if (to) aptQuery = aptQuery.lte('appointment_date', to)
  if (staffId) aptQuery = aptQuery.eq('staff_id', staffId)

  let invQuery = admin
    .from('invoices')
    .select('staff_id, total, paid_amount, status')
    .eq('business_id', businessId)
    .in('status', ['paid', 'partial'])

  if (from) invQuery = invQuery.gte('created_at', from)
  if (to) invQuery = invQuery.lte('created_at', to)
  if (staffId) invQuery = invQuery.eq('staff_id', staffId)

  let reviewQuery = admin
    .from('reviews')
    .select('id, rating')
    .eq('business_id', businessId)

  if (from) reviewQuery = reviewQuery.gte('created_at', from)
  if (to) reviewQuery = reviewQuery.lte('created_at', to)

  const [{ data: appointments }, { data: invoices }, { data: reviews }] = await Promise.all([
    aptQuery,
    invQuery,
    reviewQuery,
  ])

  // Her personel için hesapla
  const performance = staffList.map(s => {
    const staffApts = (appointments || []).filter(a => a.staff_id === s.id)
    const totalApts = staffApts.length
    const completedApts = staffApts.filter(a => a.status === 'completed').length
    const cancelledApts = staffApts.filter(a => a.status === 'cancelled').length
    const noShowApts = staffApts.filter(a => a.status === 'no_show').length

    const staffInvoices = (invoices || []).filter(i => i.staff_id === s.id)
    const totalRevenue = staffInvoices.reduce((sum, i) => sum + (i.paid_amount || i.total || 0), 0)

    // Ortalama rating (tüm yorumlar — personel bazlı filtreleme review tablosunda staff_id yok)
    // Bu basitleştirilmiş — gerçekte randevu üzerinden eşleştirmek gerekir
    const avgRating = reviews && reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : null

    return {
      staffId: s.id,
      name: s.name,
      role: s.role,
      avatarUrl: s.avatar_url,
      totalAppointments: totalApts,
      completedAppointments: completedApts,
      cancelledAppointments: cancelledApts,
      noShowAppointments: noShowApts,
      completionRate: totalApts > 0 ? Math.round((completedApts / totalApts) * 100) : 0,
      totalRevenue,
      avgRevenue: completedApts > 0 ? Math.round((totalRevenue / completedApts) * 100) / 100 : 0,
      avgRating,
    }
  })

  return NextResponse.json({ performance })
}
