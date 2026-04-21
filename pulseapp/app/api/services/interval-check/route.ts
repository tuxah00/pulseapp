import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// GET: Müşteri bir hizmeti son ne zaman almış ve önerilen tekrar aralığından önce mi?
// Kullanım: /api/services/interval-check?businessId=X&customerId=Y&serviceId=Z
//
// Response:
// { hasWarning: false }  → uyarı yok (daha önce almamış veya interval dolmuş)
// { hasWarning: true, lastDate, daysSince, intervalDays, daysRemaining,
//   serviceName, message }  → uyarı göster
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  const customerId = searchParams.get('customerId')
  const serviceId = searchParams.get('serviceId')

  if (!businessId || !customerId || !serviceId) {
    return NextResponse.json({ error: 'businessId, customerId ve serviceId gerekli' }, { status: 400 })
  }

  // Üyelik kontrolü
  const { data: staff } = await supabase
    .from('staff_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('business_id', businessId)
    .single()
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  // Hizmetin önerilen aralığını çek
  const { data: service } = await supabase
    .from('services')
    .select('id, name, recommended_interval_days')
    .eq('id', serviceId)
    .eq('business_id', businessId)
    .single()

  if (!service || !service.recommended_interval_days) {
    // Önerilen aralık tanımlı değil → uyarı yok
    return NextResponse.json({ hasWarning: false })
  }

  // Müşterinin bu hizmeti en son aldığı tarihi bul (tamamlanmış randevular)
  const { data: lastAppointment } = await supabase
    .from('appointments')
    .select('appointment_date')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .eq('service_id', serviceId)
    .eq('status', 'completed')
    .is('deleted_at', null)
    .order('appointment_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lastAppointment) {
    // Daha önce almamış → uyarı yok
    return NextResponse.json({ hasWarning: false })
  }

  const lastDate = new Date(lastAppointment.appointment_date as string)
  const now = new Date()
  // Sadece gün farkını hesapla (saat dikkate alınmasın)
  const lastDay = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate())
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const daysSince = Math.floor((today.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24))
  const intervalDays = service.recommended_interval_days

  if (daysSince >= intervalDays) {
    // Aralık dolmuş → uyarı yok
    return NextResponse.json({ hasWarning: false, lastDate: lastAppointment.appointment_date, daysSince })
  }

  const daysRemaining = intervalDays - daysSince
  const lastDateStr = lastDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

  return NextResponse.json({
    hasWarning: true,
    lastDate: lastAppointment.appointment_date,
    daysSince,
    intervalDays,
    daysRemaining,
    serviceName: service.name,
    message: `Bu müşteri "${service.name}" hizmetini ${lastDateStr} tarihinde aldı (${daysSince} gün önce). Önerilen tekrar aralığı ${intervalDays} gün — erken randevu alıyor, ${daysRemaining} gün daha beklenmesi öneriliyor.`,
  })
}
