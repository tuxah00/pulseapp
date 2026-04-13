import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — Portal kullanıcısının bilgilerini döndür
export async function GET(request: NextRequest) {
  const customerId = request.cookies.get('portal_customer_id')?.value
  const businessId = request.cookies.get('portal_business_id')?.value

  if (!customerId || !businessId) {
    return NextResponse.json({ error: 'Oturum bulunamadı' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Müşteri bilgilerini çek
  const { data: customer, error: custError } = await admin
    .from('customers')
    .select('id, name, phone, segment, birthday, notes')
    .eq('id', customerId)
    .eq('business_id', businessId)
    .eq('is_active', true)
    .single()

  if (custError || !customer) {
    return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 })
  }

  // İşletme bilgilerini çek
  const { data: business } = await admin
    .from('businesses')
    .select('id, name, logo_url, sector')
    .eq('id', businessId)
    .single()

  // Yaklaşan randevular (sonraki 3)
  const today = new Date().toISOString().split('T')[0]
  const { data: upcomingAppointments } = await admin
    .from('appointments')
    .select('id, appointment_date, start_time, end_time, status, services(name, price), staff_members(name)')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .gte('appointment_date', today)
    .in('status', ['pending', 'confirmed'])
    .is('deleted_at', null)
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(3)

  // Geçmiş randevular (son 5)
  const { data: pastAppointments } = await admin
    .from('appointments')
    .select('id, appointment_date, start_time, status, services(name, price), staff_members(name)')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .lt('appointment_date', today)
    .in('status', ['completed', 'cancelled', 'no_show'])
    .is('deleted_at', null)
    .order('appointment_date', { ascending: false })
    .limit(5)

  // Sadakat puanları
  const { data: loyaltyAccount } = await admin
    .from('loyalty_accounts')
    .select('points_balance, total_earned, total_redeemed')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .single()

  return NextResponse.json({
    customer,
    business,
    upcomingAppointments: upcomingAppointments || [],
    pastAppointments: pastAppointments || [],
    loyaltyPoints: loyaltyAccount?.points_balance || 0,
    loyaltyTotalEarned: loyaltyAccount?.total_earned || 0,
  })
}
