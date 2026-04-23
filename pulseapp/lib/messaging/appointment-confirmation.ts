import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/messaging/send'

/** Müşteri EVET yanıtı (onay) regex'i — webhook'lar kullanır */
export const CONFIRM_REGEX = /^(EVET|E|YES|1|ONAY|GEL[İI]YORUM|TAMAM|OK)$/i
/** Müşteri HAYIR yanıtı (iptal) regex'i — webhook'lar kullanır */
export const DECLINE_REGEX = /^(HAYIR|H|NO|0|[İI]PTAL|GEL[Ee]M[İI]YORUM|VAZGE[CÇ])$/i

/**
 * Müşterinin EVET/HAYIR yanıtını en yakın "waiting" randevusuyla eşleştir ve işle.
 * SMS ve WhatsApp webhook'larında ortaklaştırılmış mantık.
 */
export async function handleAppointmentConfirmationReply(
  admin: ReturnType<typeof createAdminClient>,
  customerId: string,
  businessId: string,
  customerPhone: string,
  isConfirm: boolean,
  channel: 'auto' | 'whatsapp' | 'sms' = 'auto'
): Promise<boolean> {
  const todayStr = new Date().toISOString().split('T')[0]

  const { data: waitingApts } = await admin
    .from('appointments')
    .select('id, customers(name)')
    .eq('customer_id', customerId)
    .eq('business_id', businessId)
    .eq('confirmation_status', 'waiting')
    .gte('appointment_date', todayStr)
    .in('status', ['confirmed', 'pending'])
    .is('deleted_at', null)
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(1)

  const apt = waitingApts?.[0] as { id: string; customers?: { name?: string | null } | null } | undefined
  if (!apt) return false

  const customerName = apt.customers?.name || ''
  const channelLabel = channel === 'whatsapp' ? 'WhatsApp' : 'SMS'

  if (isConfirm) {
    await admin
      .from('appointments')
      .update({ confirmation_status: 'confirmed_by_customer', status: 'confirmed' })
      .eq('id', apt.id)

    await sendMessage({
      to: customerPhone,
      body: `Teşekkürler ${customerName} ✅ Randevunuz onaylandı. Sizi bekliyoruz!`,
      businessId,
      customerId,
      messageType: 'system',
      channel,
    })
  } else {
    await admin
      .from('appointments')
      .update({
        confirmation_status: 'declined',
        status: 'cancelled',
        cancellation_reason: `Müşteri ${channelLabel} ile iptal etti`,
      })
      .eq('id', apt.id)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    await sendMessage({
      to: customerPhone,
      body: `Randevunuz iptal edildi. Yeni randevu almak için: ${appUrl}/book/${businessId}`,
      businessId,
      customerId,
      messageType: 'system',
      channel,
    })
  }

  return true
}
