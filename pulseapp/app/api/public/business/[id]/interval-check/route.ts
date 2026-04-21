import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidUUID } from '@/lib/utils/validate'

// Public: Müşteri randevu alırken son kez aldığı hizmete bakıp uyarı üretir.
// Kullanım: POST /api/public/business/[id]/interval-check
// body: { phone: string, serviceId: string }
// phone ile customer bulunur; auth gerektirmez.
//
// Response:
// { hasWarning: false }  → uyarı yok (daha önce almamış veya interval dolmuş)
// { hasWarning: true, lastDate, daysSince, intervalDays, daysRemaining,
//   serviceName, message }
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isValidUUID(params.id)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  const body = await request.json().catch(() => null) as { phone?: string; serviceId?: string } | null
  if (!body?.phone || !body?.serviceId) {
    return NextResponse.json({ hasWarning: false })
  }
  if (!isValidUUID(body.serviceId)) {
    return NextResponse.json({ hasWarning: false })
  }

  const admin = createAdminClient()

  // Hizmetin önerilen aralığını çek
  const { data: service } = await admin
    .from('services')
    .select('id, name, recommended_interval_days')
    .eq('id', body.serviceId)
    .eq('business_id', params.id)
    .single()

  if (!service || !service.recommended_interval_days) {
    return NextResponse.json({ hasWarning: false })
  }

  // Telefondan müşteri bul (aynı işletme için)
  const phoneDigits = body.phone.replace(/\D/g, '')
  if (phoneDigits.length < 6) {
    return NextResponse.json({ hasWarning: false })
  }

  const { data: customer } = await admin
    .from('customers')
    .select('id')
    .eq('business_id', params.id)
    .ilike('phone', `%${phoneDigits.slice(-10)}%`)
    .limit(1)
    .maybeSingle()

  if (!customer) {
    return NextResponse.json({ hasWarning: false })
  }

  const { data: lastAppointment } = await admin
    .from('appointments')
    .select('appointment_date')
    .eq('business_id', params.id)
    .eq('customer_id', customer.id)
    .eq('service_id', body.serviceId)
    .eq('status', 'completed')
    .is('deleted_at', null)
    .order('appointment_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lastAppointment) {
    return NextResponse.json({ hasWarning: false })
  }

  const lastDate = new Date(lastAppointment.appointment_date as string)
  const now = new Date()
  const lastDay = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate())
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const daysSince = Math.floor((today.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24))
  const intervalDays = service.recommended_interval_days

  if (daysSince >= intervalDays) {
    return NextResponse.json({ hasWarning: false })
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
    message: `${service.name} hizmetini ${lastDateStr} tarihinde (${daysSince} gün önce) almışsınız. Önerilen tekrar aralığı ${intervalDays} gün — ${daysRemaining} gün daha beklemeniz önerilir.`,
  })
}
