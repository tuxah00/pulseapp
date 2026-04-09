import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Kimlik doğrulama
    const authClient = createServerSupabaseClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
    }

    const body = await request.json()
    const { user_id, business_name, sector, phone, city } = body

    if (!user_id || !business_name || !sector) {
      return NextResponse.json(
        { error: 'Eksik bilgi: user_id, business_name ve sector zorunlu.' },
        { status: 400 }
      )
    }

    // Gönderilen user_id'nin oturum açan kullanıcıyla eşleştiğini doğrula
    if (user_id !== user.id) {
      return NextResponse.json({ error: 'Yetkisiz: kullanıcı doğrulaması başarısız' }, { status: 403 })
    }

    const supabase = createAdminClient()

    // Supabase fonksiyonunu çağır
    const { data, error } = await supabase.rpc('create_business_for_user', {
      p_user_id: user_id,
      p_business_name: business_name,
      p_sector: sector,
      p_phone: phone || null,
      p_city: city || null,
    })

    if (error) {
      console.error('İşletme oluşturma hatası:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ business_id: data })
  } catch (err) {
    console.error('Onboarding hatası:', err)
    return NextResponse.json(
      { error: 'Sunucu hatası.' },
      { status: 500 }
    )
  }
}
