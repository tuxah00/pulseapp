import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizePhone } from '@/lib/sms/send'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('business_id', params.id)
      .eq('phone', normalizedPhone)
      .single()

    const { error: insertError } = await supabase
      .from('waitlist_entries')
      .insert({
        business_id: params.id,
        customer_id: existing?.id || null,
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
