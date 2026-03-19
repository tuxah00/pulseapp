import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
    }

    const businessId = request.nextUrl.searchParams.get('businessId')
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
      .limit(1)
      .single()

    if (!staff) {
      return NextResponse.json(
        { error: 'Bu işletme için yetkiniz yok' },
        { status: 403 },
      )
    }

    const { data: account } = await supabase
      .from('whatsapp_accounts')
      .select(
        'id, business_id, phone_number, display_name, status, quality_rating, messaging_limit, connected_at',
      )
      .eq('business_id', businessId)
      .single()

    if (!account) {
      return NextResponse.json({
        connected: false,
        account: null,
      })
    }

    return NextResponse.json({
      connected: account.status === 'active',
      account: {
        id: account.id,
        phoneNumber: account.phone_number,
        displayName: account.display_name,
        status: account.status,
        qualityRating: account.quality_rating,
        messagingLimit: account.messaging_limit,
        connectedAt: account.connected_at,
      },
    })
  } catch (error: any) {
    console.error('WhatsApp durum sorgulama hatası:', error)
    return NextResponse.json(
      { error: error.message || 'Durum sorgulama hatası' },
      { status: 500 },
    )
  }
}
