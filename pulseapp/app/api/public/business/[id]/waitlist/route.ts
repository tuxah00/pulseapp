import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const supabase = createAdminClient()

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('90') && cleaned.length === 12) return `+${cleaned}`
  if (cleaned.startsWith('0') && cleaned.length === 11) return `+9${cleaned}`
  if (cleaned.length === 10) return `+90${cleaned}`
  if (!phone.startsWith('+')) return `+${cleaned}`
  return phone
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { customerName, customerPhone, serviceId, staffId, preferredDate } = body

    if (!customerName?.trim() || !customerPhone?.trim()) {
      return NextResponse.json(
        { error: 'Ad ve telefon zorunlu' },
        { status: 400 }
      )
    }

    // İşletmenin var olduğunu doğrula
    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', params.id)
      .eq('is_active', true)
      .single()

    if (!business) {
      return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })
    }

    const normalizedPhone = normalizePhone(customerPhone)

    // Mevcut müşteriyi bul
    const { data: existingCustomers } = await supabase
      .from('customers')
      .select('id')
      .eq('business_id', params.id)
      .eq('phone', normalizedPhone)
      .limit(1)

    const { error: insertError } = await supabase
      .from('waitlist_entries')
      .insert({
        business_id: params.id,
        customer_id: existingCustomers?.[0]?.id || null,
        customer_name: customerName.trim(),
        customer_phone: normalizedPhone,
        service_id: serviceId || null,
        staff_id: staffId || null,
        preferred_date: preferredDate || null,
        is_notified: false,
        is_active: true,
      })

    if (insertError) {
      console.error('Bekleme listesi kayıt hatası:', insertError)
      return NextResponse.json({ error: 'Kayıt oluşturulamadı' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Bekleme listesi API hatası:', err)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
