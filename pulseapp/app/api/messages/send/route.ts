import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
    }

    const body = await request.json()
    const { customerId, businessId, content, messageType = 'text' } = body

    if (!customerId || !businessId || !content) {
      return NextResponse.json(
        { error: 'customerId, businessId ve content gerekli' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    const { data: customer } = await admin
      .from('customers')
      .select('id, phone, name')
      .eq('id', customerId)
      .eq('business_id', businessId)
      .single()

    if (!customer) {
      return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 })
    }

    const { error: dbError } = await admin.from('messages').insert({
      business_id: businessId,
      customer_id: customerId,
      direction: 'outbound',
      channel: 'web',
      message_type: messageType,
      content,
    })

    if (dbError) {
      return NextResponse.json(
        { error: 'Mesaj kaydetme hatası', details: dbError.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, channel: 'web' })
  } catch (error: any) {
    console.error('Mesaj gönderme API hatası:', error)
    return NextResponse.json(
      { error: 'Mesaj gönderme hatası', details: error.message },
      { status: 500 },
    )
  }
}
