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
    const { businessId } = body

    if (!businessId) {
      return NextResponse.json(
        { error: 'businessId gerekli' },
        { status: 400 },
      )
    }

    const { data: staff } = await supabase
      .from('staff_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('business_id', businessId)
      .in('role', ['owner', 'manager'])
      .single()

    if (!staff) {
      return NextResponse.json(
        { error: 'Bu işletme için yetkiniz yok' },
        { status: 403 },
      )
    }

    const admin = createAdminClient()

    const { error: updateError } = await admin
      .from('whatsapp_accounts')
      .update({
        status: 'disconnected',
        access_token_encrypted: '',
        updated_at: new Date().toISOString(),
      })
      .eq('business_id', businessId)

    if (updateError) {
      console.error('WhatsApp bağlantı kesme hatası:', updateError)
      return NextResponse.json(
        { error: 'Bağlantı kesme hatası' },
        { status: 500 },
      )
    }

    await admin
      .from('businesses')
      .update({
        whatsapp_number: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', businessId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('WhatsApp bağlantı kesme hatası:', error)
    return NextResponse.json(
      { error: error.message || 'Bağlantı kesme hatası' },
      { status: 500 },
    )
  }
}
