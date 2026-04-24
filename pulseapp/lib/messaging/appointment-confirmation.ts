import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/messaging/send'

/**
 * Müşteri EVET yanıtı (onay) regex'i — webhook'lar kullanır.
 * T2.1: Rakam seçimleri (1-5) disambiguation olduğu için "1" CONFIRM'dan çıkarıldı.
 */
export const CONFIRM_REGEX = /^(EVET|E|YES|ONAY|GEL[İI]YORUM|TAMAM|OK)$/i
/** Müşteri HAYIR yanıtı (iptal) regex'i — webhook'lar kullanır */
export const DECLINE_REGEX = /^(HAYIR|H|NO|[İI]PTAL|GEL[Ee]M[İI]YORUM|VAZGE[CÇ])$/i
/** Disambiguation: "1", "2", ... rakam yanıtı — birden fazla waiting randevu arasından seçim */
export const NUMERIC_CHOICE_REGEX = /^([1-5])$/

/**
 * Müşterinin EVET/HAYIR yanıtını bekleyen randevusuyla eşleştir ve işle.
 * SMS ve WhatsApp webhook'larında ortaklaştırılmış mantık.
 *
 * T2.1 — Birden fazla waiting randevu varsa disambiguation mesajı gönderir
 * ("hangi randevu için EVET dediniz?"). Rakam yanıtları (1-5) sonraki
 * webhook'ta `handleNumericChoice`'a yönlendirilir.
 */
export async function handleAppointmentConfirmationReply(
  admin: ReturnType<typeof createAdminClient>,
  customerId: string,
  businessId: string,
  customerPhone: string,
  isConfirm: boolean,
  channel: 'auto' | 'whatsapp' | 'sms' = 'auto',
): Promise<boolean> {
  const waiting = await fetchWaitingAppointments(admin, businessId, customerId)
  if (waiting.length === 0) return false

  const channelLabel = channel === 'whatsapp' ? 'WhatsApp' : 'SMS'

  // Birden fazla waiting randevu → disambiguation gönder, kullanıcı rakamla seçsin
  if (waiting.length > 1) {
    const lines = waiting.slice(0, 5).map((a, i) => {
      const dateStr = formatDateTr(a.appointment_date)
      const svc = a.services?.name ? ` — ${a.services.name}` : ''
      return `(${i + 1}) ${dateStr} ${a.start_time.slice(0, 5)}${svc}`
    })
    const action = isConfirm ? 'onaylamak' : 'iptal etmek'
    await sendMessage({
      to: customerPhone,
      body: `Birden fazla onay bekleyen randevunuz var. Hangi randevuyu ${action} istediğinizi sayıyla yanıtlayın:\n${lines.join('\n')}`,
      businessId,
      customerId,
      messageType: 'system',
      channel,
    })

    await admin.from('notifications').insert({
      business_id: businessId,
      type: 'ai_alert',
      title: `${channelLabel}: Birden fazla randevu için yanıt bekleniyor`,
      body: `${waiting[0].customers?.name || 'Müşteri'} "${isConfirm ? 'EVET' : 'HAYIR'}" yanıtı verdi; disambiguation gönderildi.`,
      related_id: customerId,
      related_type: 'customer',
    })
    return true
  }

  // Tek randevu — doğrudan işle
  return applyDecision(admin, waiting[0], customerPhone, businessId, customerId, isConfirm, channel)
}

/**
 * Müşteri "1"/"2"/... rakam yanıtı gönderdiğinde çağrılır — son disambiguation'daki
 * indekse göre ilgili randevuyu onayla veya iptal et.
 *
 * Sistem son gönderilen disambiguation mesajından `isConfirm` bilgisini `messages`
 * tablosu üzerinden çıkaramayacağı için şimdilik `isConfirm=true` varsayılır
 * (yaygın senaryo — müşteri onay için seçim yapar). Daha sofistike: `messages.content`
 * içinde "onaylamak" veya "iptal etmek" kelimesinin son disambig mesajında geçmesine
 * bakılabilir.
 */
export async function handleNumericChoiceReply(
  admin: ReturnType<typeof createAdminClient>,
  customerId: string,
  businessId: string,
  customerPhone: string,
  numericChoice: number,
  channel: 'auto' | 'whatsapp' | 'sms' = 'auto',
): Promise<boolean> {
  const waiting = await fetchWaitingAppointments(admin, businessId, customerId)
  if (waiting.length === 0) return false

  const idx = numericChoice - 1
  if (idx < 0 || idx >= waiting.length) return false

  // Son sistem mesajından eylemi (onay/iptal) çıkar
  const { data: lastSystem } = await admin
    .from('messages')
    .select('content')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .eq('direction', 'outbound')
    .eq('message_type', 'system')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const body = (lastSystem?.content as string | undefined) ?? ''
  const isConfirm = body.includes('onaylamak') ? true : body.includes('iptal etmek') ? false : true

  return applyDecision(admin, waiting[idx], customerPhone, businessId, customerId, isConfirm, channel)
}

interface WaitingApt {
  id: string
  appointment_date: string
  start_time: string
  customers?: { name?: string | null } | null
  services?: { name?: string | null } | null
}

async function fetchWaitingAppointments(
  admin: ReturnType<typeof createAdminClient>,
  businessId: string,
  customerId: string,
): Promise<WaitingApt[]> {
  const todayStr = new Date().toISOString().split('T')[0]

  const { data } = await admin
    .from('appointments')
    .select('id, appointment_date, start_time, customers(name), services(name)')
    .eq('customer_id', customerId)
    .eq('business_id', businessId)
    .eq('confirmation_status', 'waiting')
    .gte('appointment_date', todayStr)
    .in('status', ['confirmed', 'pending'])
    .is('deleted_at', null)
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(5)

  return (data ?? []) as WaitingApt[]
}

async function applyDecision(
  admin: ReturnType<typeof createAdminClient>,
  apt: WaitingApt,
  customerPhone: string,
  businessId: string,
  customerId: string,
  isConfirm: boolean,
  channel: 'auto' | 'whatsapp' | 'sms',
): Promise<true> {
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

function formatDateTr(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'long',
    })
  } catch {
    return iso
  }
}
