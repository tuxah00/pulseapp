import { NextRequest, NextResponse } from 'next/server'
// RLS bypass: public endpoint, user session yok — businessId path param ile cross-tenant koruması sağlanır
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidUUID } from '@/lib/utils/validate'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { validateBody } from '@/lib/api/validate'
import { publicBookingSchema } from '@/lib/schemas'
import { sendSMS } from '@/lib/sms/send'
import { createLogger } from '@/lib/utils/logger'
import { createBooking } from '@/lib/booking/create-booking'

const log = createLogger({ route: 'api/public/business/[id]/book' })

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient()
  if (!isValidUUID(params.id)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  const rl = checkRateLimit(req, RATE_LIMITS.publicBooking)
  if (rl.limited) return rl.response

  const result = await validateBody(req, publicBookingSchema)
  if (!result.ok) return result.response
  const { name, phone, serviceId, staffId, date, startTime, notes } = result.data

  try {
    const booking = await createBooking(supabase, {
      businessId: params.id,
      name,
      phone,
      serviceId,
      staffId: staffId ?? null,
      date,
      startTime,
      notes: notes ?? null,  // publicBookingSchema undefined'a çevirir, ?? null DB için normalize eder
      source: 'web',
      withManageToken: true,
    })

    // Müşteriye SMS onay bildirimi (Twilio varsa)
    try {
      const { data: biz } = await supabase
        .from('businesses')
        .select('name')
        .eq('id', params.id)
        .single()

      const manageUrl = process.env.NEXT_PUBLIC_APP_URL && booking.manageToken
        ? `${process.env.NEXT_PUBLIC_APP_URL}/book/manage/${booking.manageToken}`
        : null

      const smsBody = [
        '✅ Randevunuz alındı!',
        `📋 Hizmet: ${booking.service.name}`,
        `📅 Tarih: ${date}`,
        `🕐 Saat: ${startTime} - ${booking.endTime}`,
        biz?.name ? `🏢 İşletme: ${biz.name}` : null,
        manageUrl ? `\nRandevunuzu görüntüleyin:\n${manageUrl}` : null,
      ].filter(Boolean).join('\n')

      await sendSMS({
        to: phone,
        body: smsBody,
        businessId: params.id,
        customerId: booking.customerId,
        messageType: 'system',
      })
    } catch (err) {
      log.error({ err }, 'Booking SMS hatası')
      // SMS hatası randevu oluşturmayı etkilemez
    }

    return NextResponse.json({
      success: true,
      appointmentId: booking.appointmentId,
      manageToken: booking.manageToken,
      message: 'Randevunuz başarıyla oluşturuldu!',
      details: {
        service: booking.service.name,
        date,
        startTime,
        endTime: booking.endTime,
      },
    })
  } catch (e: unknown) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
